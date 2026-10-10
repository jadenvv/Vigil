// Minimal history-API router. The template ships without react-router, and four routes
// don't justify a new dependency. Base44 hosting serves index.html for every path.
import { createContext, useContext, useEffect, useState } from "react";

const RouteContext = createContext({ path: "/", params: {} });

export function navigate(to, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function matchRoute(pattern, path) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    else if (patternParts[i] !== pathParts[i]) return null;
  }
  return params;
}

// routes: [{ path: "/flag/:id", element: <FlagDetail /> }, ...]; the first match wins.
export function Router({ routes, fallback }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  for (const route of routes) {
    const params = matchRoute(route.path, path);
    if (params) return <RouteContext.Provider value={{ path, params }}>{route.element}</RouteContext.Provider>;
  }
  return fallback;
}

export function useParams() {
  return useContext(RouteContext).params;
}

export function Link({ to, onClick, children, ...rest }) {
  const handleClick = (event) => {
    onClick?.(event);
    const isModified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
    if (event.defaultPrevented || isModified) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export function Redirect({ to }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}
