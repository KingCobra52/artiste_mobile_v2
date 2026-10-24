/** Normalize before comparing origins; backslashes and encoded redirects are rejected. */
export function safeNextPath(value: unknown, fallback = "/market"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return fallback;
  try {
    let decoded = value;
    for (let i = 0; i < 3; i++) decoded = decodeURIComponent(decoded);
    if (/[\\\u0000-\u0020]/.test(decoded) || decoded.startsWith("//"))
      return fallback;
    const parsed = new URL(value, "https://artiste.invalid");
    if (
      parsed.origin !== "https://artiste.invalid" ||
      /^\/(auth|login|signup|onboarding|recover|reset-password)(\/|$)/.test(
        parsed.pathname,
      )
    )
      return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
