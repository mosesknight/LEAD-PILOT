import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface WebsiteAudit {
  reachable: boolean;
  url: string | null;
  title: string | null;
  description: string | null;
  signals: string[];
  notes: string;
}

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    return PRIVATE_V4.some((pattern) => pattern.test(address));
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower === "::"
    );
  }
  return true;
}

async function assertPublicHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".localhost")
  ) {
    throw new Error("Private host blocked");
  }

  if (isIP(lower)) {
    if (isPrivateAddress(lower)) throw new Error("Private IP blocked");
    return;
  }

  const records = await lookup(lower, { all: true, verbatim: true });
  if (!records.length) throw new Error("Host not found");
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("Private address blocked");
  }
}

function extract(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function auditWebsite(rawUrl: string | null | undefined): Promise<WebsiteAudit> {
  const empty: WebsiteAudit = {
    reachable: false,
    url: null,
    title: null,
    description: null,
    signals: [],
    notes: "No website on file.",
  };

  if (!rawUrl?.trim()) return empty;

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { ...empty, notes: "The website URL could not be parsed." };
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return { ...empty, notes: "Only http and https websites can be audited." };
  }

  let current = target;
  let response: Response | null = null;

  for (let hop = 0; hop < 3; hop += 1) {
    try {
      await assertPublicHost(current.hostname);
      const result = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: {
          "user-agent": "LeadPilotAuditBot/1.0 (+https://leadpilot.app)",
          accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      });

      if (result.status >= 300 && result.status < 400) {
        const location = result.headers.get("location");
        if (!location) break;
        current = new URL(location, current);
        if (!["http:", "https:"].includes(current.protocol)) break;
        continue;
      }

      response = result;
      break;
    } catch {
      return {
        ...empty,
        url: target.toString(),
        notes: "The website could not be reached by the audit bot.",
      };
    }
  }

  if (!response || !response.ok) {
    return {
      ...empty,
      url: current.toString(),
      notes: "The website did not return a successful page.",
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return {
      ...empty,
      url: current.toString(),
      notes: "The site did not return an HTML page.",
    };
  }

  const html = (await response.text()).slice(0, 220_000);
  const lower = html.toLowerCase();

  const title = decodeEntities(
    extract(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "",
  ) || null;
  const description = decodeEntities(
    extract(
      html,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    ) ??
      extract(
        html,
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
      ) ??
      "",
  ) || null;
  const h1 = decodeEntities(extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? "") || null;
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasBooking = /(calendly|acuity|booking|book now|reserve|appointment|opentable|resy|squareup|schedul)/i.test(
    html,
  );
  const hasForm = /<form[\s>]/i.test(lower);
  const hasPhone = /(tel:|\+?\d[\d\s().-]{7,}\d)/i.test(html);
  const hasAnalytics = /(gtag\(|googletagmanager|plausible|posthog|fathom)/i.test(lower);
  const cms =
    /wp-content|wordpress/i.test(lower)
      ? "WordPress"
      : /wix\.com|wixsite/i.test(lower)
        ? "Wix"
        : /cdn\.shopify\.com|shopify/i.test(lower)
          ? "Shopify"
          : /squarespace/i.test(lower)
            ? "Squarespace"
            : /webflow/i.test(lower)
              ? "Webflow"
              : null;

  const signals: string[] = [];
  if (!viewport) signals.push("No mobile viewport meta tag (likely poor mobile UX)");
  if (!title) signals.push("Missing page title");
  if (!description) signals.push("Missing meta description (weak search snippet)");
  if (!hasBooking) signals.push("No online booking or ordering flow detected");
  if (!hasForm) signals.push("No lead-capture form detected");
  if (!hasAnalytics) signals.push("No analytics/tracking detected");
  if (!hasPhone) signals.push("No click-to-call phone number detected");
  if (cms) signals.push(`Built on ${cms}`);
  if (title && h1 && !title.toLowerCase().includes(h1.toLowerCase().slice(0, 12))) {
    signals.push("Page heading and title are misaligned");
  }

  const details = [
    title ? `Title: ${title}` : null,
    description ? `Description: ${description}` : null,
    h1 ? `H1: ${h1}` : null,
    cms ? `Platform: ${cms}` : null,
    `Mobile viewport: ${viewport ? "yes" : "no"}`,
    `Online booking: ${hasBooking ? "yes" : "no"}`,
    `Lead form: ${hasForm ? "yes" : "no"}`,
    `Analytics: ${hasAnalytics ? "yes" : "no"}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    reachable: true,
    url: current.toString(),
    title,
    description,
    signals: signals.slice(0, 8),
    notes: details,
  };
}
