import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import type { Pitch, Profile } from "@/lib/types";
import type { WebsiteAudit } from "@/lib/website-audit";

const pitchSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const record = value as Record<string, unknown>;
    return {
      ...record,
      identifiedProblem: record.identifiedProblem ?? record.problem,
      whatsappText: record.whatsappText ?? record.whatsappMessage,
    };
  },
  z.object({
    identifiedProblem: z.string().min(10),
    opportunity: z.string().min(10),
    emailSubject: z.string().min(5).max(90),
    emailBody: z.string().min(80),
    whatsappText: z.string().min(20).max(600),
  }),
);

export interface PitchLead {
  business_name: string;
  niche: string | null;
  website: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  high_ticket: boolean;
}

function buildPrompt(lead: PitchLead, profile: Profile | null, audit: WebsiteAudit) {
  const sender = {
    name: profile?.full_name?.trim() || "the founder",
    company: profile?.company_name?.trim() || "an independent software studio",
    title: profile?.sender_title?.trim() || "Founder & Software Engineer",
  };

  return `You are a senior software consultant writing a hyper-personalized cold outreach pitch.

## Sender
- Name: ${sender.name}
- Company: ${sender.company}
- Title: ${sender.title}
- Offer: custom web apps, internal tools, booking systems, and workflow automation built by a senior developer — leaner and cheaper than bloated agency retainers.

## Prospect
- Business: ${lead.business_name}
- Niche: ${lead.niche || "local business"}
- Location: ${lead.location || "unknown"}
- Website: ${lead.website || "none on file"}
- High-value target: ${lead.high_ticket ? "yes" : "no"}
- Sales notes: ${lead.notes || "none"}

## Website audit signals
${audit.reachable ? audit.notes : audit.notes}
${audit.signals.length ? audit.signals.map((signal) => `- ${signal}`).join("\n") : "- No strong technical signals detected from the homepage."}

## Rules
1. Identify ONE concrete, believable operational or digital bottleneck. Never invent specific facts (revenue, traffic, staff count). Frame uncertain signals as questions.
2. Position custom software/web development as the direct fix. Be specific about the outcome (more booked appointments, fewer manual DMs, faster quotes), not the tech stack.
3. Email: 90-140 words, plain text, no markdown, no bullet lists, no corporate fluff, one clear CTA for a 10-minute call. Sound like a busy human, not a marketer.
4. Subject: under 60 characters, specific, lowercase-ish, no clickbait, no emojis, no "Re:".
5. WhatsApp: under 55 words, casual, one sentence of context, one question. No links, no emojis.
6. Never mention AI, audits, or that you scraped their site. Say "I took a look at your site" at most.
7. If there is no website, focus on the missed bookings/inquiries and offer a simple high-converting site.
8. Sign the email with the sender's first name only.

Return JSON only.`;
}

export interface GeminiOptions {
  apiKey?: string | null;
  model?: string | null;
}

export async function generatePitch(
  lead: PitchLead,
  profile: Profile | null,
  audit: WebsiteAudit,
  options: GeminiOptions = {},
): Promise<Pitch> {
  const apiKey = options.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "No Gemini API key is available. Add yours in Settings → API keys.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: options.model || process.env.GEMINI_MODEL || "gemini-2.5-flash",
    contents: buildPrompt(lead, profile, audit),
    config: {
      temperature: 0.85,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          identifiedProblem: {
            type: Type.STRING,
            description: "One concrete digital or operational bottleneck observed.",
          },
          opportunity: {
            type: Type.STRING,
            description: "The specific custom software solution and outcome.",
          },
          emailSubject: {
            type: Type.STRING,
            description: "Cold email subject line under 60 characters.",
          },
          emailBody: {
            type: Type.STRING,
            description: "Plain-text cold email, 90-140 words, no markdown.",
          },
          whatsappText: {
            type: Type.STRING,
            description: "Casual WhatsApp opener under 55 words.",
          },
        },
        required: ["identifiedProblem", "opportunity", "emailSubject", "emailBody", "whatsappText"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gemini returned an invalid JSON response.");
    parsed = JSON.parse(match[0]);
  }

  const validated = pitchSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("Gemini returned a pitch with missing fields. Try again.");
  }

  return validated.data;
}
