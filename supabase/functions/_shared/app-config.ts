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

export function getSupabaseProjectUrl() {
  const configured =
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("VITE_SUPABASE_URL");

  if (!configured) {
    throw new Error("SUPABASE_URL is not configured");
  }

  return trimTrailingSlash(configured);
}

export function buildSupabaseFunctionUrl(functionName: string) {
  const normalizedName = functionName.replace(/^\/+/, "");
  return `${getSupabaseProjectUrl()}/functions/v1/${normalizedName}`;
}

export function buildSupabasePublicStorageUrl(bucket: string, assetPath: string) {
  const normalizedBucket = bucket.replace(/^\/+|\/+$/g, "");
  const [pathname, query] = assetPath.replace(/^\/+/, "").split("?");
  const baseUrl = `${getSupabaseProjectUrl()}/storage/v1/object/public/${normalizedBucket}/${pathname}`;
  return query ? `${baseUrl}?${query}` : baseUrl;
}

export function getEmailLogoUrl() {
  return buildSupabasePublicStorageUrl("email-assets", "logo.png?v=1");
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
