function configuredAuthUrl() {
  return process.env.BETTER_AUTH_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
}

function parseHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function parseAuthority(value: string | null) {
  if (!value || value.includes(",")) return null;
  const url = parseHttpUrl(`http://${value}`);
  if (!url || url.pathname !== "/" || url.search || url.hash) return null;
  return url.host.toLowerCase();
}

function isLoopbackHost(host: string) {
  const hostname = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function loopbackAlias(host: string) {
  const parsed = parseHttpUrl(`http://${host}`);
  if (!parsed || !isLoopbackHost(parsed.host)) return null;
  const port = parsed.port ? `:${parsed.port}` : "";
  if (parsed.hostname === "localhost") return `127.0.0.1${port}`;
  if (parsed.hostname === "127.0.0.1") return `localhost${port}`;
  return null;
}

export function trustedOriginsForRequest(request?: Request) {
  const configured = parseHttpUrl(configuredAuthUrl());
  const allowed = new Set<string>();
  if (configured) {
    allowed.add(configured.origin);
    const alias = loopbackAlias(configured.host);
    if (alias && configured.protocol === "http:") allowed.add(`http://${alias}`);
  }

  const allowedHosts = new Set<string>();
  if (configured) allowedHosts.add(configured.host.toLowerCase());
  if (configured) {
    const alias = loopbackAlias(configured.host);
    if (alias) allowedHosts.add(alias.toLowerCase());
  }

  if (!request) return [...allowed];

  const requestUrl = parseHttpUrl(request.url);
  const hostHeader = parseAuthority(request.headers.get("host"));
  if (requestUrl && allowedHosts.has(requestUrl.host.toLowerCase())) {
    allowed.add(requestUrl.origin);
  }
  if (requestUrl && hostHeader && allowedHosts.has(hostHeader)) {
    allowed.add(`${requestUrl.protocol}//${hostHeader}`);
  }

  const forwardedHost = parseAuthority(request.headers.get("x-forwarded-host"));
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (forwardedHost && allowedHosts.has(forwardedHost) && (forwardedProtocol === "http" || forwardedProtocol === "https")) {
    const forwardedOrigin = `${forwardedProtocol}://${forwardedHost}`;
    if (configured?.origin === forwardedOrigin || (isLoopbackHost(forwardedHost) && forwardedProtocol === "http")) {
      allowed.add(forwardedOrigin);
    }
  }

  return [...allowed];
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const parsedOrigin = parseHttpUrl(origin);
  if (!origin || !parsedOrigin || parsedOrigin.origin !== origin) return false;
  return trustedOriginsForRequest(request).includes(parsedOrigin.origin);
}

export function errorResponse(error: unknown, fallback = "The request could not be completed.") {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message || fallback }, { status: 400 });
}

export function unauthorized() {
  return Response.json({ error: "Sign in required." }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "Admin access required." }, { status: 403 });
}
