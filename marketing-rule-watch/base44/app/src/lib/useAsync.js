import { useCallback, useEffect, useState } from "react";

// Runs a loader on mount and when deps change. `reload` is for user-initiated retries only.
export function useAsync(loader, deps) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    loader()
      .then((data) => !cancelled && setState({ status: "ready", data, error: null }))
      .catch((error) => {
        console.warn("Load failed:", error?.message ?? error);
        if (!cancelled) setState({ status: "error", data: null, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}

export function pageTitle(page) {
  const heading = page.markdown?.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  try {
    const { hostname, pathname } = new URL(page.url);
    return pathname === "/" ? hostname : pathname;
  } catch {
    return page.url;
  }
}
