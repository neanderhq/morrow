import { validEmail } from "./policy";

type EmailConfig = { apiKey: string; from: string; endpoint: string };

export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.MORROW_RESEND_API_KEY?.trim();
  const from = process.env.MORROW_EMAIL_FROM?.trim();
  if (!apiKey || !from || !validEmail(from)) return null;
  const testEndpoint = process.env.MORROW_TEST_EMAIL_ENDPOINT;
  if (!testEndpoint) return { apiKey, from, endpoint: "https://api.resend.com/emails" };

  // The disposable runtime exercises the real HTTP adapter without letting an
  // alternate endpoint receive real sender credentials.
  try {
    const url = new URL(testEndpoint);
    if (url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port &&
        !url.username && !url.password && url.pathname === "/emails" && !url.search && !url.hash &&
        from.endsWith(".test") && apiKey.startsWith("morrow-fixture-")) return { apiKey, from, endpoint: url.href };
  } catch {}
  return null;
}

type DispatchResult =
  | { status: "accepted"; id: string; reason: null }
  | { status: "failed" | "unknown"; id: null; reason: string };

export async function sendRejectionEmail(config: EmailConfig, id: string, message: {
  recipient: string; sender: string; subject: string; body: string;
}): Promise<DispatchResult> {
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        authorization: "Bearer " + config.apiKey,
        "content-type": "application/json",
        "idempotency-key": "morrow-rejection/" + id,
      },
      body: JSON.stringify({ from: message.sender, to: [message.recipient], subject: message.subject, text: message.body }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && typeof result?.id === "string" && result.id.trim() && result.id.length <= 255) {
      return { status: "accepted", id: result.id, reason: null };
    }
    if ([400, 401, 403, 404, 422, 429].includes(response.status) && typeof result?.name === "string") {
      return { status: "failed", id: null, reason: "The email provider declined this request. Check the sender configuration or provider dashboard before retrying." };
    }
  } catch {}
  return { status: "unknown", id: null, reason: "The provider outcome is uncertain. Check the provider dashboard before taking any further action." };
}
