// Demo decisions are session-scoped: the UI derives a flag's status only from Decision rows
// carrying this browser's session_id, so every tester starts clean.
// localStorage can throw (private windows, blocked storage), so fall back to memory.

const STORAGE_KEY = "mrw_session_id";
let memorySessionId: string | null = null;

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // randomUUID needs a secure context; fall through to the non-crypto id.
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Idempotency key for one reviewer decision intent: double clicks and retried submits share it,
// a fresh decision gets a new one. Server-side dedupe uses it; it is not a session identifier.
export function newRequestId(): string {
  return newId();
}

export function getSessionId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = newId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Storage unavailable: one id per page load is enough for a demo session.
    if (!memorySessionId) memorySessionId = newId();
    return memorySessionId;
  }
}
