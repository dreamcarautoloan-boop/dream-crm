import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

/**
 * Only set an explicit cookie domain for known custom domains that need
 * cross-subdomain sharing. Public shared hosting suffixes (like
 * onrender.com, vercel.app, etc.) must NOT be used as a cookie domain —
 * browsers silently reject cookies scoped to public suffixes.
 */
function getParentDomain(hostname: string): string | undefined {
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  const PUBLIC_SUFFIXES = ["onrender.com", "vercel.app", "netlify.app", "manuspre.computer"];
  if (PUBLIC_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith("." + suffix))) {
    return undefined;
  }

  const parts = hostname.split(".");
  if (parts.length < 3) {
    return undefined;
  }

  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req),
  };
}