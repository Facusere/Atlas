/**
 * Escapes HTML special characters before inserting untrusted strings into templates.
 */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

/**
 * Validates that an external URL uses HTTPS before assigning it to media attributes.
 */
export function safeUrl(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

/**
 * Validates ISO 3166-1 alpha-3 country codes.
 */
export function isIso3(code) {
  return typeof code === "string" && /^[A-Z]{3}$/.test(code);
}
