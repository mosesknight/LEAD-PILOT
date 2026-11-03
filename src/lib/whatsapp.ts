export function normalizeWhatsAppNumber(phone: string | null | undefined) {
  if (!phone) return null;
  let digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length <= 11) {
    digits = digits.slice(1);
  }
  return digits.length >= 7 ? digits : null;
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppWebLink(phone: string | null | undefined, message: string) {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return null;
  return `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;
}
