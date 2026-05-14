import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Derive the canonical public origin from the request.
 * Behind Cloudflare → Cloud Run, the Host header is the internal Cloud Run URL.
 * We use x-forwarded-host (if present) or fall back to the Origin/Referer headers
 * to determine the actual public domain the user is accessing.
 */
export function getCanonicalOrigin(req: Request): string {
  // 1. x-forwarded-host is the most reliable (set by Cloudflare/LB)
  const xfh = req.headers["x-forwarded-host"];
  if (xfh) {
    const host = Array.isArray(xfh) ? xfh[0] : xfh.split(",")[0].trim();
    const proto = isSecureRequest(req) ? "https" : "http";
    return `${proto}://${host}`;
  }

  // 2. Origin header (set by browser on same-origin requests)
  const origin = req.headers["origin"];
  if (origin && typeof origin === "string" && origin.startsWith("http")) {
    return origin;
  }

  // 3. Referer header (fallback)
  const referer = req.headers["referer"];
  if (referer && typeof referer === "string") {
    try {
      const url = new URL(referer);
      return url.origin;
    } catch {}
  }

  // 4. Last resort: use req.protocol + req.get('host')
  return `${req.protocol}://${req.get("host")}`;
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    // Use "lax" instead of "none" - this is a first-party cookie (same domain),
    // so "lax" is correct and doesn't require secure:true.
    // "none" was causing issues because it requires secure:true, and behind
    // Cloud Run proxy the secure detection can be unreliable.
    sameSite: "lax",
    secure,
  };
}
