/**
 * Outgoing email through Resend's HTTP API. No SDK: one POST is all it takes,
 * and a missing key simply means "not configured" so callers can fall back to
 * the user's own mail app.
 */

export interface OutgoingEmail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly replyTo?: string | null;
}

export type SendResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: string };

export const isEmailConfigured = (): boolean =>
  Boolean(process.env.AUTH_RESEND_KEY && process.env.RESEND_FROM_EMAIL);

export const sendEmail = async (email: OutgoingEmail): Promise<SendResult> => {
  const key = process.env.AUTH_RESEND_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !payload.id) {
      return { ok: false, error: payload.message ?? `HTTP ${response.status}` };
    }
    return { ok: true, id: payload.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Envoi impossible" };
  }
};
