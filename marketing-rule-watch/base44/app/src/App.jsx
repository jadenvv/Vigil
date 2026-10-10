import { EmptyBlock, Shell } from "@/components/Chrome";
import { COPY } from "@/lib/copy";
import { Redirect, Router } from "@/lib/router";
import Exam from "@/pages/Exam";
import FlagDetail from "@/pages/FlagDetail";
import { DemoInbox, FirmInbox } from "@/pages/Inbox";
import Setup from "@/pages/Setup";

const routes = [
  { path: "/", element: <Redirect to="/demo" /> },
  { path: "/demo", element: <DemoInbox /> },
  { path: "/firm/:id", element: <FirmInbox /> },
  { path: "/firm/:id/exam", element: <Exam /> },
  { path: "/flag/:id", element: <FlagDetail /> },
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
