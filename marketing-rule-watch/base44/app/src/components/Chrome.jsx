// Shared page chrome: footer on every screen, demo banner, and the loading / error / empty states.
import { COPY } from "@/lib/copy";

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

export function Shell({ demo = false, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper-50 text-night-950">
      {demo && <DemoBanner />}
      <header className="border-b border-paper-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <img src="/vigil-lockup.svg" alt={COPY.appName} className="h-6 w-auto" />
        </div>
      </header>
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
