// Single source of truth for which email domains may use the app.
// To add or remove a domain, change this list only.
export const ALLOWED_EMAIL_DOMAINS = ['broadwaylive.in', 'broadwaylive.co.in']

// Exact domain match (so "x@evil-broadwaylive.in" or "x@sub.broadwaylive.in" do NOT pass)
export function isAllowedEmail(email) {
  const e = (email || '').trim().toLowerCase()
  const at = e.lastIndexOf('@')
  return at > 0 && ALLOWED_EMAIL_DOMAINS.includes(e.slice(at + 1))
}

// e.g. "@broadwaylive.in or @broadwaylive.co.in"
export const ALLOWED_DOMAINS_TEXT = ALLOWED_EMAIL_DOMAINS.map(d => '@' + d).join(' or ')
