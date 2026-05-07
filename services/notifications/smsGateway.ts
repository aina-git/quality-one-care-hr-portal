// SMS-via-email gateway: maps a US phone number + carrier to the email
// address that the carrier accepts to forward as an SMS to that number.
// Used as a free interim SMS channel until a real SMS provider is wired in.

export const SMS_CARRIERS = [
  { value: "att", label: "AT&T", domain: "txt.att.net" },
  { value: "verizon", label: "Verizon", domain: "vtext.com" },
  { value: "t_mobile", label: "T-Mobile", domain: "tmomail.net" },
  { value: "sprint", label: "Sprint", domain: "messaging.sprintpcs.com" },
  { value: "boost", label: "Boost Mobile", domain: "sms.myboostmobile.com" },
  { value: "us_cellular", label: "US Cellular", domain: "email.uscc.net" },
  { value: "cricket", label: "Cricket", domain: "sms.cricketwireless.net" },
  { value: "metro_pcs", label: "Metro PCS", domain: "mymetropcs.com" },
  { value: "google_voice", label: "Google Voice", domain: "msg.fi.google.com" },
  { value: "xfinity_mobile", label: "Xfinity Mobile", domain: "vtext.com" },
  { value: "mint_mobile", label: "Mint Mobile", domain: "tmomail.net" },
  { value: "straight_talk", label: "Straight Talk", domain: "vtext.com" },
  { value: "tracfone", label: "TracFone", domain: "mmst5.tracfone.com" }
] as const;

export type SmsCarrierValue = (typeof SMS_CARRIERS)[number]["value"];

function digitsOnly(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Build the email-to-SMS gateway address for an applicant.
 *
 * Priority:
 *   1. smsEmailOverride if set (manual override, e.g. for international
 *      carriers we don't have a domain for)
 *   2. phone digits + carrier domain
 *   3. null if neither is sufficient
 */
export function resolveSmsEmailAddress(opts: {
  phone: string | null | undefined;
  phoneCarrier: string | null | undefined;
  smsEmailOverride: string | null | undefined;
}): string | null {
  const override = (opts.smsEmailOverride ?? "").trim();
  if (override.includes("@")) return override;

  const digits = digitsOnly(opts.phone ?? "");
  // US gateways expect 10 digits (drop leading 1 if present).
  const last10 = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (last10.length !== 10) return null;

  const carrier = (opts.phoneCarrier ?? "").toLowerCase();
  if (!carrier) return null;
  const match = SMS_CARRIERS.find((c) => c.value === carrier);
  if (!match) return null;

  return `${last10}@${match.domain}`;
}

/**
 * Most carrier gateways strip subjects, charge per-segment, and limit to
 * 160 chars per segment. Trim aggressively for SMS messages.
 */
export function trimForSms(input: string, max = 320): string {
  const single = input.replace(/\s+/g, " ").trim();
  if (single.length <= max) return single;
  return single.slice(0, max - 3) + "...";
}
