import { lazy, Suspense } from "react";
import { EmptyBlock, Shell } from "@/components/Chrome";
import { COPY } from "@/lib/copy";
import { Router } from "@/lib/router";
import About from "@/pages/About";
import Dashboard from "@/pages/Dashboard";
import Evals from "@/pages/Evals";
import Exam from "@/pages/Exam";
import FlagDetail from "@/pages/FlagDetail";
import History from "@/pages/History";
import Home from "@/pages/Home";
import { DemoInbox, FirmInbox } from "@/pages/Inbox";
import Setup from "@/pages/Setup";

const routes = [
  { path: "/", element: <Home /> },
  { path: "/demo", element: <DemoInbox /> },
  { path: "/firm/:id", element: <FirmInbox /> },
  { path: "/firm/:id/exam", element: <Exam /> },
  { path: "/flag/:id", element: <FlagDetail /> },
  { path: "/page/:id/history", element: <History /> },
  { path: "/setup", element: <Setup /> },
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/evals", element: <Evals /> },
  { path: "/about", element: <About /> },
];

// Dev-only hero lab. import.meta.env.DEV is false in production builds, so the route and its code are dropped.
if (import.meta.env.DEV) {
  const HeroLab = lazy(() => import("@/pages/HeroLab"));
  routes.push({
    path: "/hero-lab",
    element: (
      <Suspense fallback={null}>
        <HeroLab />
      </Suspense>
    ),
  });
}

export default function App() {
  return (
    <Router
      routes={routes}
      fallback={
        <Shell>
          <EmptyBlock title={COPY.notFound} />
        </Shell>
      }
    />
  );
}
