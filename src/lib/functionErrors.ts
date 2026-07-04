const GENERIC_FUNCTION_ERROR = "Edge Function returned a non-2xx status code";

const cleanMessage = (message: unknown, fallback: string) => {
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  if (!trimmed || trimmed.includes(GENERIC_FUNCTION_ERROR)) return fallback;
  if (/supabase|service_role|jwt|postgres|stack|trace|deno|apikey/i.test(trimmed)) return fallback;
  return trimmed;
};

export async function getFunctionErrorMessage(
  error: any,
  data: any,
  fallback = "Request failed. Please try again.",
) {
  if (data?.error) return cleanMessage(data.error, fallback);

  const response = error?.context;
  if (response && typeof response.clone === "function") {
    try {
      const body = await response.clone().json();
      if (body?.error) return cleanMessage(body.error, fallback);
    } catch {
      try {
        const text = await response.clone().text();
        return cleanMessage(text, fallback);
      } catch {}
    }
  }

  return cleanMessage(error?.message, fallback);
}