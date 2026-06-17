export function maskEmail(email: string | undefined): string {
  if (!email) return "-";
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const prefix = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 3);
  return `${prefix}***@${domain}`;
}
