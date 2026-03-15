const DEFAULT_APP_BASE_URL = "https://app.thegreekcarnivore.com";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAppBaseUrl() {
  const configured =
    Deno.env.get("APP_BASE_URL") ||
    Deno.env.get("SITE_URL") ||
    DEFAULT_APP_BASE_URL;

  return trimTrailingSlash(configured);
}

export function buildAppUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

export function getRequestOriginOrAppBaseUrl(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return getAppBaseUrl();
  return trimTrailingSlash(origin);
}
