import { GoogleGenAI } from "@google/genai";

import { normalizeWebsite } from "@/lib/format";
import type { DiscoveredLead, DiscoveryCriteria } from "@/lib/types";

export interface DiscoveryOptions {
  apiKey?: string | null;
  model?: string | null;
}

export interface DiscoveryResult {
  leads: DiscoveredLead[];
  notice: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{5,24}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pick(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function clip(value: string | null, max: number) {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function cleanWebsite(value: string | null) {
  if (!value) return null;
  const candidate =
    value
      .split(/[\s;,]+/)
      .find((part) => part.includes(".") && !part.includes("@")) ?? value;
  const normalized = normalizeWebsite(candidate);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanEmail(value: string | null) {
  if (!value) return null;
  const candidate = value.replace(/^mailto:/i, "").split(/[\s,;]/)[0]?.trim() ?? "";
  return EMAIL_PATTERN.test(candidate) ? candidate : null;
}

function cleanPhone(value: string | null) {
  if (!value) return null;
  const candidate = value.replace(/^tel:/i, "").trim();
  return PHONE_PATTERN.test(candidate) ? candidate : null;
}

function cleanSource(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function toDiscoveredLead(value: unknown, criteria: DiscoveryCriteria): DiscoveredLead | null {
  if (!isRecord(value)) return null;

  const contact = isRecord(value.contact) ? value.contact : null;
  const businessName = clip(
    pick(value, ["business_name", "businessName", "name", "company", "business"]),
    200,
  );
  if (!businessName) return null;

  const website = cleanWebsite(pick(value, ["website", "url", "site", "website_url"]));
  const email = cleanEmail(
    pick(value, ["email", "contact_email", "email_address", "contactEmail"]) ??
      (contact ? pick(contact, ["email", "contact_email"]) : null),
  );
  const phone = cleanPhone(
    pick(value, ["phone", "telephone", "phone_number", "whatsapp"]) ??
      (contact ? pick(contact, ["phone", "telephone", "whatsapp"]) : null),
  );

  return {
    business_name: businessName,
    niche: clip(pick(value, ["niche", "industry", "category"]) ?? criteria.niche, 120),
    website,
    email,
    phone,
    location: clip(
      pick(value, ["location", "city", "address", "area"]) ?? criteria.location,
      200,
    ),
    notes: clip(
      pick(value, ["notes", "reason", "why", "signals", "digital_gaps", "pitch_angle"]),
      600,
    ),
    source: cleanSource(pick(value, ["source", "source_url", "sourceUrl", "citation", "url_source"])),
  };
}

function toList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed)) {
    for (const key of ["leads", "results", "businesses", "data"]) {
      const list = parsed[key];
      if (Array.isArray(list)) return list;
    }
  }
  return [];
}

function extractBalanced(text: string, start: number) {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "[" || char === "{") {
      stack.push(char);
    } else if (char === "]" || char === "}") {
      const open = stack.pop();
      if ((char === "]" && open !== "[") || (char === "}" && open !== "{")) {
        return null;
      }
      if (!stack.length) return text.slice(start, index + 1);
    }
  }

  return null;
}

function parseJsonList(text: string): unknown[] {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  const starts: number[] = [];
  for (let index = 0; index < cleaned.length; index += 1) {
    if (cleaned[index] === "[") starts.push(index);
  }
  for (let index = 0; index < cleaned.length; index += 1) {
    if (cleaned[index] === "{") starts.push(index);
  }

  for (const start of starts) {
    const candidate = extractBalanced(cleaned, start);
    if (!candidate) continue;
    for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        return toList(JSON.parse(attempt));
      } catch {
        continue;
      }
    }
  }

  throw new Error("The discovery agent returned an unreadable response. Try again.");
}

function buildPrompt(criteria: DiscoveryCriteria) {
  const brief = criteria.prompt.trim();
  return `You are an autonomous B2B lead research agent. Use Google Search to find real, currently operating businesses that match the criteria below.

## Search brief
- Target industry / niche: ${criteria.niche || "any local business"}
- Location: ${criteria.location || "anywhere"}
- Desired number of leads: ${criteria.count}
- Extra instructions from the user: ${brief || "none"}

## How to search
- Run multiple searches that combine the niche, the location, and intent terms such as "contact", "email", "book now", "services", "owner".
- Prefer independent local businesses, not franchises, national chains, or directory aggregators.
- Favour prospects with a website but a weak digital presence: no online booking, outdated design, no contact form, or no clear call to action.
- Contact details are important for outreach. Look for a publicly listed email address and phone number, ideally on the business's own website or a trusted directory.

## Hard rules
- Only include businesses you actually found in search results.
- Never invent a business, a website, an email address, or a phone number.
- Only include an email or phone number if it appears verbatim in a public source. Never construct addresses such as info@domain.
- Use null for any field you cannot verify.
- Do not repeat the same business twice.
- Do not include a business if you cannot confirm it is real.

## Output
Return only a JSON array, no markdown and no commentary. Each object must use exactly these keys:
[
  {
    "business_name": "string",
    "niche": "string or null",
    "website": "https://... or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "notes": "one or two sentences on why this is a good fit and any digital gaps you noticed",
    "source": "https://... or null"
  }
]

Return up to ${criteria.count} businesses. If fewer real businesses are available, return fewer rather than inventing any.`;
}

const OSM_BUSINESS_CLASSES = new Set([
  "amenity",
  "shop",
  "office",
  "tourism",
  "leisure",
  "healthcare",
  "craft",
  "club",
  "company",
  "industrial",
]);

export async function discoverFromOpenStreetMap(
  criteria: DiscoveryCriteria,
): Promise<DiscoveredLead[]> {
  const subject = (criteria.niche || criteria.prompt.trim()).slice(0, 160);
  const query = [subject, criteria.location].filter(Boolean).join(" ");
  if (!query) return [];

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    limit: String(Math.min(40, Math.max(criteria.count * 3, 10))),
    "accept-language": "en",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "user-agent": `LeadPilotLeadDiscovery/1.0 (+${
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        })`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`OpenStreetMap search failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];

  const seen = new Set<string>();
  const leads: DiscoveredLead[] = [];

  for (const item of payload) {
    if (!isRecord(item)) continue;

    const name =
      typeof item.name === "string" && item.name.trim() ? item.name.trim() : null;
    if (!name) continue;

    const category =
      typeof item.category === "string"
        ? item.category
        : typeof item.class === "string"
          ? item.class
          : null;
    const type = typeof item.type === "string" ? item.type : null;
    const extratags = isRecord(item.extratags) ? item.extratags : {};
    const address = isRecord(item.address) ? item.address : {};

    const website = cleanWebsite(
      pick(extratags, ["website", "contact:website", "url"]),
    );
    const email = cleanEmail(pick(extratags, ["email", "contact:email"]));
    const phone = cleanPhone(
      pick(extratags, ["phone", "contact:phone", "contact:mobile"]),
    );

    if (!website && !email && !phone && (!category || !OSM_BUSINESS_CLASSES.has(category))) {
      continue;
    }

    const city = [address.city, address.town, address.village, address.suburb].find(
      (value): value is string => typeof value === "string" && Boolean(value),
    );

    const locality = [city, address.state, address.country]
      .filter((value): value is string => typeof value === "string" && Boolean(value))
      .join(", ");

    const location = locality || criteria.location || null;
    const key = (website || `${name}|${location ?? ""}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const osmType = typeof item.osm_type === "string" ? item.osm_type : null;
    const osmId =
      typeof item.osm_id === "string" || typeof item.osm_id === "number"
        ? String(item.osm_id)
        : null;

    leads.push({
      business_name: name.slice(0, 200),
      niche: clip(criteria.niche || type, 120),
      website,
      email,
      phone,
      location: clip(location, 200),
      notes: clip(
        `OpenStreetMap listing${category ? ` (${category}${type ? `/${type}` : ""})` : ""}. Verify contact details before outreach.`,
        600,
      ),
      source:
        osmType && osmId
          ? cleanSource(`https://www.openstreetmap.org/${osmType}/${osmId}`)
          : null,
    });

    if (leads.length >= criteria.count) break;
  }

  return leads;
}

export async function discoverLeads(
  criteria: DiscoveryCriteria,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const apiKey = options.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("No Gemini API key is available. Add yours in Settings → API keys.");
  }

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 40_000 } });
  const response = await ai.models.generateContent({
    model: options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: buildPrompt(criteria),
    config: {
      temperature: 0.4,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text;
  if (!text) throw new Error("The discovery agent returned an empty response.");

  const parsed = parseJsonList(text);
  const seen = new Set<string>();
  const leads: DiscoveredLead[] = [];

  for (const item of parsed) {
    const lead = toDiscoveredLead(item, criteria);
    if (!lead) continue;

    const key = (lead.website || `${lead.business_name}|${lead.location ?? ""}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    leads.push(lead);

    if (leads.length >= criteria.count) break;
  }

  const notice =
    leads.length === 0
      ? "No matching businesses were found. Try a broader niche, a different location, or fewer constraints."
      : leads.length < criteria.count
        ? `The agent found ${leads.length} verifiable lead${leads.length === 1 ? "" : "s"} out of ${criteria.count} requested. Broaden the search for more.`
        : null;

  return { leads, notice };
}
