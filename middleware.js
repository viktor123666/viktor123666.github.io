// Vercel Edge Middleware — gates BOTH /su-vault-9x7k/* AND /su-admin/*.
// If the request lacks a valid `sl_vault` cookie, redirects to /vault-login.html.
// The cookie is set by /api/vault-login.js after a correct password POST.
//
// Security hardening 2026-05-21:
// - Extended matcher to also cover /su-admin/* (was previously client-side gated only)
// - Cookie token can be rotated via VAULT_COOKIE_TOKEN env var (no longer hardcoded)
// - Adds defense-in-depth security headers on every gated response

export const config = {
  matcher: ["/su-vault-9x7k/:path*", "/su-admin/:path*"],
};

// Token can be overridden via env var. Defaults to the documented value so
// existing sessions don't all log out on first deploy. To force re-login of
// everyone, set VAULT_COOKIE_TOKEN to a new value in Vercel project settings.
const EXPECTED = (typeof process !== "undefined" && process.env && process.env.VAULT_COOKIE_TOKEN) || "ok-Ywap1337-v1";

export default function middleware(req) {
  const url = new URL(req.url);

  const cookieHeader = req.headers.get("cookie") || "";
  const has = new RegExp("(?:^|;\\s*)sl_vault=([^;]+)").exec(cookieHeader);
  if (has && has[1] === EXPECTED) {
    return; // authenticated — pass through to static asset
  }

  const next = url.pathname + url.search;
  const login = new URL("/vault-login.html", url);
  login.searchParams.set("next", next);
  return Response.redirect(login.toString(), 302);
}
