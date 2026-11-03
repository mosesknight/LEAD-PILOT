export const LEADS_CHANGED_EVENT = "leadpilot:leads-changed";

export function notifyLeadsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
}
