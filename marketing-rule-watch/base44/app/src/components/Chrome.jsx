// Shared page chrome: footer on every screen, demo banner, and the loading / error / empty states.
import { useLayoutEffect, useRef } from "react";
import "@/components/hero/schemes.css";
import { COPY } from "@/lib/copy";
import { Link } from "@/lib/router";

// Site navigation. Evals and About join the bar once their pages are routed in App.jsx.
const NAV_ITEMS = [
  { to: "/", label: "Home", match: (path) => path === "/" },
  {
    to: "/demo",
    label: "Live demo",
    match: (path) => path === "/demo" || /^\/(flag|firm|page)\//.test(path),
  },
  { to: "/evals", label: "Evals", match: (path) => path.startsWith("/evals"), routed: false },
  { to: "/about", label: "About", match: (path) => path.startsWith("/about"), routed: false },
].filter((item) => item.routed !== false);

// Each page renders its own Shell, so the bar remounts on navigation. Remembering where the indicator was
// lets it glide from the previous item to the new one instead of jumping.
let lastIndicator = null;

function SiteNav() {
  const listRef = useRef(null);
  const indicatorRef = useRef(null);
  const path = window.location.pathname;
  const active = NAV_ITEMS.findIndex((item) => item.match(path));

  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const link = listRef.current?.querySelectorAll("a")[active];
    if (!indicator) return;
    if (!link) {
      indicator.style.opacity = "0";
      lastIndicator = null;
      return;
    }
    // A 1px bar scaled to the link's width: only transform changes, so the glide stays on the compositor.
    const next = { x: link.offsetLeft, w: link.offsetWidth };
    const toTransform = ({ x, w }) => `translateX(${x}px) scaleX(${w})`;
    indicator.style.opacity = "1";
    indicator.style.transform = toTransform(next);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (lastIndicator && !reduceMotion && (lastIndicator.x !== next.x || lastIndicator.w !== next.w)) {
      indicator.animate([{ transform: toTransform(lastIndicator) }, { transform: toTransform(next) }], {
        duration: 360,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
    }
    lastIndicator = next;
  }, [active]);

  return (
    <nav aria-label="Main" className="-mr-2 min-w-0 overflow-x-auto">
      <ul ref={listRef} className="relative flex items-center text-sm">
        {NAV_ITEMS.map((item, i) => (
          <li key={item.to}>
            <Link
              to={item.to}
              aria-current={i === active ? "page" : undefined}
              className={`block whitespace-nowrap rounded-md px-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500 sm:px-3 ${
                i === active ? "text-[color:var(--h-fg)]" : "text-[color:var(--h-muted)] hover:text-[color:var(--h-fg)]"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-[color:var(--h-fg)] opacity-0"
        />
      </ul>
    </nav>
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
    <div role="note" className="border-b border-night-700 bg-night-950 px-4 py-2 text-center text-sm font-medium text-paper-50">
      {COPY.demoBanner}
    </div>
  );
}

// `hero` renders full width between the header and the page column, e.g. a coloured hero band.
export function Shell({ demo = false, hero = null, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper-50 text-night-950">
      {demo && <DemoBanner />}
      {/* Dark on every page, so the bar and the Dusk night bands on Home and the demo read as one surface. */}
      <header className={`hero-scope ${hero ? "" : "border-b border-[color:var(--h-border)]"}`} data-scheme="dusk-night">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
          <Link to="/" className="inline-block shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500">
            <img src="/vigil-lockup-reversed.svg" alt={`${COPY.appName} home`} className="h-6 w-auto" />
          </Link>
          <SiteNav />
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
