import type { LeadStage } from "@/lib/types";

export const APP_NAME = "LeadPilot";
export const APP_TAGLINE = "50 leads a day. Zero excuses. Zero cost.";
export const DEFAULT_DAILY_QUOTA = 50;

export const STAGE_META: Record<
  LeadStage,
  {
    label: string;
    short: string;
    description: string;
    dot: string;
    badge: string;
    bar: string;
    kanban: string;
  }
> = {
  discovered: {
    label: "Discovered",
    short: "New",
    description: "Researched but not contacted yet.",
    dot: "bg-sky-400",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    bar: "bg-sky-400",
    kanban: "from-sky-400/70",
  },
  email_pitched: {
    label: "Email Pitched",
    short: "Email",
    description: "Personalized cold email delivered.",
    dot: "bg-violet-400",
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-300",
    bar: "bg-violet-400",
    kanban: "from-violet-400/70",
  },
  whatsapp_pitched: {
    label: "WhatsApp Pitched",
    short: "WhatsApp",
    description: "Direct WhatsApp message opened.",
    dot: "bg-emerald-400",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    bar: "bg-emerald-400",
    kanban: "from-emerald-400/70",
  },
  follow_up: {
    label: "Follow-up Sent",
    short: "Follow-up",
    description: "A second touch is in flight.",
    dot: "bg-amber-400",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    bar: "bg-amber-400",
    kanban: "from-amber-400/70",
  },
  proposal_sent: {
    label: "Proposal Sent",
    short: "Proposal",
    description: "Scope and pricing delivered.",
    dot: "bg-orange-400",
    badge: "border-orange-400/30 bg-orange-400/10 text-orange-300",
    bar: "bg-orange-400",
    kanban: "from-orange-400/70",
  },
  closed_won: {
    label: "Closed / Won",
    short: "Won",
    description: "Signed. Ship it.",
    dot: "bg-teal-300",
    badge: "border-teal-300/30 bg-teal-300/10 text-teal-200",
    bar: "bg-teal-300",
    kanban: "from-teal-300/80",
  },
};

export const STAGE_ORDER: LeadStage[] = [
  "discovered",
  "email_pitched",
  "whatsapp_pitched",
  "follow_up",
  "proposal_sent",
  "closed_won",
];

export const NICHES = [
  "Dental Clinic",
  "Medical Spa",
  "Law Firm",
  "Real Estate Agency",
  "Restaurant",
  "Fitness Studio",
  "Salon & Barber",
  "Home Services",
  "Auto Dealer",
  "E-commerce Brand",
  "SaaS Startup",
  "Logistics Company",
  "Accounting Firm",
  "Interior Design",
  "Travel Agency",
  "Other",
];

export const QUICK_WHATSAPP_TEMPLATE =
  "Hi {{business}}, I noticed {{problem}}. I build custom {{solution}} for {{niche}} businesses. Worth a quick 10-minute chat this week?";

export const AUDIT_SIGNALS = [
  "No website found",
  "Website not mobile responsive",
  "No online booking or ordering",
  "Outdated design / poor UX",
  "Slow or broken pages",
  "No clear call-to-action",
  "No lead capture form",
  "Weak local SEO signals",
];

export const CSV_TEMPLATE = `business_name,niche,website,email,phone,location,notes,high_ticket
Bright Smile Dental,Dental Clinic,https://brightsmile.example.com,hello@brightsmile.example.com,+15551234567,Austin TX,"No online booking visible on site",true
Peak Fitness Studio,Fitness Studio,,owner@peakfitness.example.com,+15559876543,Denver CO,"Runs classes through Instagram DMs",false
`;

export const DISCOVERY_MIN_COUNT = 1;
export const DISCOVERY_MAX_COUNT = 20;
export const DISCOVERY_DEFAULT_COUNT = 10;

export const DISCOVERY_EXAMPLES = [
  "Dental clinics in Austin with no online booking",
  "Independent fitness studios in Denver that take bookings via Instagram DMs",
  "Law firms in Toronto with outdated websites and no contact form",
];
