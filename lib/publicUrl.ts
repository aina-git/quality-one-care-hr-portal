export function publicBaseUrl(request: Request): string {
  const headers = request.headers;
  const forwardedHost = headers.get("x-forwarded-host") ?? headers.get("host");
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto ?? (forwardedHost.includes("localhost") ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export function publicUrl(path: string, request: Request): URL {
  return new URL(path, publicBaseUrl(request));
}
