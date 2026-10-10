import { EmptyBlock, Shell } from "@/components/Chrome";
import { COPY } from "@/lib/copy";
import { Router } from "@/lib/router";
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
];

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
