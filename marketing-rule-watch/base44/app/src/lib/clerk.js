// Clerk powers only the reviewer workspace ("My reviews"). Base44 auth stays untouched and keeps
// guarding admin operations; the anonymous /demo path never loads Clerk state.
// The publishable key is public by design; secret keys never reach the browser.
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

// Without a key there is no ClerkProvider, so review routes show a "not configured" state
// instead of a broken sign-in. Local dev: base44/app/.env.local with VITE_CLERK_PUBLISHABLE_KEY.
export const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);
