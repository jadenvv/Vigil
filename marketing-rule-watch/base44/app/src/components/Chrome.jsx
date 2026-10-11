// Shared page chrome: footer on every screen, demo banner, and the loading / error / empty states.
import { Show, SignInButton, UserButton } from "@clerk/react";
import { clerkEnabled } from "@/lib/clerk";
import { COPY } from "@/lib/copy";
import { Link } from "@/lib/router";

// Clerk controls render only when the workspace is configured (a publishable key exists);
// the "My reviews" link is always there — signed out, the route explains instead of erroring.
function ReviewerControls() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            type="button"
            className="rounded-md border border-night-200 px-3 py-1.5 text-night-700 hover:bg-paper-100"
          >
            {COPY.signIn}
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}

export function Footer() {
  return (
    <footer className="mt-12 border-t border-paper-200 py-6 text-center text-sm text-night-600">
      {COPY.footer}
    </footer>
  );
}

export function DemoBanner() {
  return (
    <div role="note" className="bg-night-950 px-4 py-2 text-center text-sm font-medium text-paper-50">
      {COPY.demoBanner}
    </div>
  );
}

// `hero` renders full width between the header and the page column, e.g. a coloured hero band.
export function Shell({ demo = false, hero = null, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper-50 text-night-950">
      {demo && <DemoBanner />}
      <header className="border-b border-paper-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="inline-block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500">
            <img src="/vigil-lockup.svg" alt={`${COPY.appName} home`} className="h-6 w-auto" />
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link to="/reviews" className="rounded text-night-600 hover:text-night-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500">
              {COPY.navReviews}
            </Link>
            {clerkEnabled && <ReviewerControls />}
          </nav>
        </div>
      </header>
      {hero}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6">{children}</main>
      <Footer />
    </div>
  );
}

export function LoadingBlock({ rows = 3 }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-paper-200" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message = COPY.loadError, onRetry }) {
  return (
    <div role="alert" className="rounded-lg border border-ember-100 bg-ember-100 p-4 text-sm text-ember-700">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-ember-700 px-3 py-1.5 text-white hover:bg-ember-600"
        >
          {COPY.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ title, detail }) {
  return (
    <div className="rounded-lg border border-paper-200 bg-white p-8 text-center">
      <p className="font-medium">{title}</p>
      {detail && <p className="mt-2 text-sm text-night-600">{detail}</p>}
    </div>
  );
}
