// Shared page chrome: footer on every screen, demo banner, and the loading / error / empty states.
import { COPY } from "@/lib/copy";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
      {COPY.footer}
    </footer>
  );
}

export function DemoBanner() {
  return (
    <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
      {COPY.demoBanner}
    </div>
  );
}

export function Shell({ demo = false, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {demo && <DemoBanner />}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3 text-sm font-semibold tracking-tight">{COPY.appName}</div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <Footer />
    </div>
  );
}

export function LoadingBlock({ rows = 3 }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message = COPY.loadError, onRetry }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-900 px-3 py-1.5 text-white hover:bg-red-800"
        >
          {COPY.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyBlock({ title, detail }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="font-medium">{title}</p>
      {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}
