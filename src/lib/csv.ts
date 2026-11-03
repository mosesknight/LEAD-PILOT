import type { LeadInput } from "@/lib/types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  return rows;
}

const HEADER_ALIASES: Record<string, keyof LeadInput> = {
  business: "business_name",
  business_name: "business_name",
  name: "business_name",
  company: "business_name",
  niche: "niche",
  industry: "niche",
  category: "niche",
  website: "website",
  site: "website",
  url: "website",
  email: "email",
  "email address": "email",
  phone: "phone",
  telephone: "phone",
  mobile: "phone",
  whatsapp: "phone",
  location: "location",
  city: "location",
  area: "location",
  notes: "notes",
  note: "notes",
  comment: "notes",
  high_ticket: "high_ticket",
  "high ticket": "high_ticket",
  hot: "high_ticket",
  vip: "high_ticket",
  deal_value: "deal_value",
  value: "deal_value",
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function truthy(value: string) {
  return /^(1|true|yes|y|hot|vip|high)$/i.test(value.trim());
}

export function rowsToLeads(rows: string[][]): LeadInput[] {
  if (!rows.length) return [];

  const firstRow = rows[0].map(normalizeHeader);
  const hasHeader = firstRow.some((cell) =>
    ["business_name", "business", "name", "company", "email", "website"].includes(
      cell.replace(/\s+/g, "_"),
    ) ||
    ["business name", "business", "name", "company", "email", "website"].includes(cell),
  );

  const defaultOrder: (keyof LeadInput)[] = [
    "business_name",
    "niche",
    "website",
    "email",
    "phone",
    "location",
    "notes",
    "high_ticket",
  ];

  const columns = hasHeader
    ? firstRow.map((cell) => HEADER_ALIASES[cell] ?? HEADER_ALIASES[cell.replace(/\s+/g, "_")])
    : defaultOrder;

  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const lead: LeadInput = { business_name: "" };
      columns.forEach((key, index) => {
        if (!key) return;
        const value = row[index]?.trim();
        if (!value) return;
        if (key === "high_ticket") {
          lead.high_ticket = truthy(value);
        } else if (key === "deal_value") {
          const parsed = Number(value.replace(/[^\d.]/g, ""));
          if (Number.isFinite(parsed)) lead.deal_value = parsed;
        } else {
          lead[key] = value;
        }
      });
      return lead;
    })
    .filter((lead) => lead.business_name.trim().length > 0);
}
