// Google adapters (Gmail send/read, Calendar free/busy + events with Meet). NOT TESTED against live Google: needs OAuth credentials.
import { addMin } from "./ist.ts";
import type { CalendarPort, MailPort } from "./schedule/auto.ts";
import type { Thread } from "./schedule/store.ts";

export const googleConnected = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN && process.env.MAILBOX_EMAIL);
async function token(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: process.env.GOOGLE_REFRESH_TOKEN!, grant_type: "refresh_token" }) });
  if (!r.ok) throw new Error(`Google token refresh failed: ${r.status}`);
  return (await r.json()).access_token;
}
const api = async (url: string, init: RequestInit = {}) => {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Google API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};
export const googleCalendar: CalendarPort = {
  async freeBusy(start, end) {
    const j = await api("https://www.googleapis.com/calendar/v3/freeBusy", { method: "POST", body: JSON.stringify({ timeMin: start.toISOString(), timeMax: end.toISOString(), items: [{ id: "primary" }] }) });
    return (j.calendars.primary.busy as { start: string; end: string }[]).map(b => ({ start: new Date(b.start), end: new Date(b.end) }));
  },
  async createEvent(o) {
    const j = await api("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", { method: "POST", body: JSON.stringify({
      summary: o.summary, start: { dateTime: o.start.toISOString() }, end: { dateTime: o.end.toISOString() }, attendees: o.attendees.map(email => ({ email })),
      conferenceData: { createRequest: { requestId: `aic-${o.start.getTime()}-${o.attendees[0]}`, conferenceSolutionKey: { type: "hangoutsMeet" } } } }) });
    return { id: j.id, meetLink: j.hangoutLink, calendarLink: j.htmlLink };
  },
};
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const raw = (to: string, subject: string, body: string, extra = "") => b64(`From: ${process.env.MAILBOX_EMAIL}\r\nTo: ${to}\r\nSubject: ${subject}\r\n${extra}Content-Type: text/plain; charset=UTF-8\r\n\r\n${body}`);
export async function sendFirstEmail(to: string, subject: string, body: string) {
  const j = await api("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", body: JSON.stringify({ raw: raw(to, subject, body) }) });
  return { gmailThreadId: j.threadId as string };
}
export const googleMail: MailPort = {
  async newReplies(t: Thread) {
    const gid = (t as any).gmailThreadId as string | undefined; if (!gid) return [];
    const j = await api(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${gid}?format=full`);
    return (j.messages as any[]).filter(m => !m.labelIds?.includes("SENT") && m.payload.headers.some((h: any) => h.name.toLowerCase() === "from" && h.value.toLowerCase().includes(t.founderEmail.toLowerCase())))
      .map(m => ({ id: m.id as string, text: Buffer.from((m.payload.parts?.find((p: any) => p.mimeType === "text/plain")?.body?.data ?? m.payload.body?.data ?? ""), "base64url").toString("utf8") }));
  },
  async sendInThread(t: Thread, body: string) {
    const gid = (t as any).gmailThreadId as string;
    await api("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", body: JSON.stringify({ threadId: gid, raw: raw(t.founderEmail, "Re: your application", body) }) });
  },
};
export const horizon = (now: Date) => addMin(now, 60 * 24 * 60);
