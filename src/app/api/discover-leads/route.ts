import { NextResponse } from "next/server";
import { z } from "zod";

import {
  DISCOVERY_DEFAULT_COUNT,
  DISCOVERY_MAX_COUNT,
  DISCOVERY_MIN_COUNT,
} from "@/lib/constants";
import { discoverFromOpenStreetMap, discoverLeads } from "@/lib/discovery";
import type { DiscoveredLead, DiscoveryCriteria } from "@/lib/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchUserSecrets,
  resolveGeminiCredentials,
} from "@/lib/user-integrations";

export const maxDuration = 60;

function describeFailure(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("429") ||
    lower.includes("quota")
  ) {
    return {
      status: 429,
      error:
        "Gemini quota exceeded for this API key. Update it in Settings → API keys, check your plan and rate limits, or try again later.",
    };
  }
  if (lower.includes("api key") && (lower.includes("invalid") || lower.includes("not valid"))) {
    return {
      status: 503,
      error: "The Gemini API key was rejected. Update it in Settings → API keys.",
    };
  }
  if (
    lower.includes("google_search") ||
    lower.includes("google search") ||
    lower.includes("grounding")
  ) {
    return {
      status: 502,
      error:
        "This Gemini model or key cannot use Google Search grounding. Try the default gemini-2.5-flash model or a key with grounding access.",
    };
  }
  return { status: 502, error: message };
}

async function safeOpenStreetMapFallback(
  criteria: DiscoveryCriteria,
): Promise<DiscoveredLead[] | null> {
  try {
    const leads = await discoverFromOpenStreetMap(criteria);
    return leads.length ? leads : null;
  } catch {
    return null;
  }
}

function fallbackNotice(reason: "empty" | "unavailable") {
  return reason === "empty"
    ? "Gemini found no verifiable businesses, so we searched the OpenStreetMap directory instead. Verify contact details before outreach."
    : "Gemini search is unavailable right now (quota, key or model tier), so we searched the OpenStreetMap directory instead. Verify contact details before outreach.";
}

const requestSchema = z.object({
  niche: z.string().trim().max(120).optional().default(""),
  location: z.string().trim().max(160).optional().default(""),
  count: z
    .number()
    .int()
    .min(DISCOVERY_MIN_COUNT)
    .max(DISCOVERY_MAX_COUNT)
    .optional()
    .default(DISCOVERY_DEFAULT_COUNT),
  prompt: z.string().trim().max(600).optional().default(""),
});

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured. Add your keys to .env.local." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the search criteria and try again." },
      { status: 400 },
    );
  }

  const criteria = parsed.data;
  if (!criteria.niche && !criteria.prompt) {
    return NextResponse.json(
      { error: "Enter a niche or describe the customers you want to find." },
      { status: 400 },
    );
  }

  const secrets = await fetchUserSecrets(supabase, user.id);
  const gemini = resolveGeminiCredentials(secrets);

  if (!gemini.apiKey) {
    const osm = await safeOpenStreetMapFallback(criteria);
    if (osm) {
      return NextResponse.json({
        leads: osm,
        notice:
          "No Gemini API key is configured, so we searched the OpenStreetMap directory instead. Verify contact details before outreach.",
      });
    }
    return NextResponse.json(
      {
        error:
          "No Gemini API key is available. Add your free key in Settings → API keys to run AI lead discovery.",
      },
      { status: 503 },
    );
  }

  try {
    const result = await discoverLeads(criteria, {
      apiKey: gemini.apiKey,
      model: gemini.model,
    });

    if (!result.leads.length) {
      const osm = await safeOpenStreetMapFallback(criteria);
      if (osm) {
        return NextResponse.json({
          leads: osm,
          notice: fallbackNotice("empty"),
        });
      }
    }

    return NextResponse.json({
      leads: result.leads,
      notice: result.notice,
    });
  } catch (error) {
    const osm = await safeOpenStreetMapFallback(criteria);
    if (osm) {
      return NextResponse.json({
        leads: osm,
        notice: fallbackNotice("unavailable"),
      });
    }

    const message =
      error instanceof Error ? error.message : "Lead discovery failed. Try again.";
    const failure = describeFailure(message);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}
