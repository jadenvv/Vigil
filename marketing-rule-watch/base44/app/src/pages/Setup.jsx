// Team-only screen: create a firm, crawl its URLs with `scan`, then run `detect` per page.
// Testers never see this; /demo reads stored rows only.
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { EmptyBlock, LoadingBlock, Shell } from "@/components/Chrome";
import { Link } from "@/lib/router";

const MAX_URLS = 25;
const SCAN_BATCH_SIZE = 5;

function parseList(text) {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function Setup() {
  const [auth, setAuth] = useState("checking");

  useEffect(() => {
    base44.auth
      .isAuthenticated()
      .then((isLoggedIn) => setAuth(isLoggedIn ? "in" : "out"))
      .catch(() => setAuth("out"));
  }, []);

  return (
    <Shell>
      {auth === "checking" && <LoadingBlock rows={2} />}
      {auth === "out" && (
        <>
          <EmptyBlock
            title="Sign in to scan a firm"
            detail={
              <button
                type="button"
                onClick={() => base44.auth.loginWithProvider("google", window.location.href)}
                className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
              >
                Sign in with Google
              </button>
            }
          />
          <p className="mt-3 text-center text-xs text-slate-500">
            For the team only. If sign-in fails, Google login isn't enabled in the app's auth settings yet.
          </p>
        </>
      )}
      {auth === "in" && <SetupForm />}
    </Shell>
  );
}

function SetupForm() {
  const [form, setForm] = useState({ name: "", domain: "", advisors: "", urls: "" });
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [firmId, setFirmId] = useState(null);
  const urls = parseList(form.urls);
  const tooMany = urls.length > MAX_URLS;

  const append = (line) => setLog((lines) => [...lines, line]);
  const update = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  // Sequential and no retries: Bright Data and LLM credits are finite.
  const handleScan = async (event) => {
    event.preventDefault();
    if (running || tooMany || !urls.length || !form.name.trim() || !form.domain.trim()) return;
    setRunning(true);
    setLog([]);
    setFirmId(null);
    try {
      const firm = await base44.entities.Firm.create({
        name: form.name.trim(),
        domain: form.domain.trim(),
        advisor_names: parseList(form.advisors),
        is_demo: false,
      });
      append(`Created firm ${firm.name}`);
      // Each URL takes 10-13 s with a screenshot, so small batches keep every call under the function time limit.
      let created = 0;
      const failed = [];
      for (let start = 0; start < urls.length; start += SCAN_BATCH_SIZE) {
        const batch = urls.slice(start, start + SCAN_BATCH_SIZE);
        append(`Scanning ${start + 1}-${start + batch.length} of ${urls.length}…`);
        try {
          const scan = (await base44.functions.invoke("scan", { firm_id: firm.id, urls: batch })).data;
          created += scan.created ?? 0;
          failed.push(...(scan.failed ?? []));
        } catch (error) {
          // A failed batch is reported, not retried: credits are finite.
          const reason = error?.response?.data?.error ?? error.message;
          failed.push(...batch.map((url) => ({ url, error: reason })));
        }
        append(`Scanned ${Math.min(start + batch.length, urls.length)} of ${urls.length}`);
      }
      append(`Scan stored ${created} pages`);
      for (const failure of failed) append(`Could not fetch ${failure.url}: ${failure.error}`);

      const pages = await base44.entities.Page.filter({ firm_id: firm.id });
      let flagTotal = 0;
      for (const [i, page] of pages.entries()) {
        append(`Checking page ${i + 1} of ${pages.length}: ${page.url}`);
        try {
          const detect = (await base44.functions.invoke("detect", { page_id: page.id })).data;
          flagTotal += detect.created ?? 0;
        } catch (error) {
          append(`Check failed for ${page.url}: ${error?.response?.data?.error ?? error.message}`);
        }
      }
      append(`Done: ${flagTotal} potential issues for review`);
      setFirmId(firm.id);
    } catch (error) {
      append(`Stopped: ${error?.response?.data?.error ?? error.message}`);
    } finally {
      setRunning(false);
    }
  };

  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
  return (
    <form onSubmit={handleScan} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Scan a firm</h1>
      <label className="block text-sm">
        Firm name
        <input className={input} value={form.name} onChange={update("name")} required />
      </label>
      <label className="block text-sm">
        Domain
        <input className={input} value={form.domain} onChange={update("domain")} placeholder="example.com" required />
      </label>
      <label className="block text-sm">
        Advisor names (comma or line separated)
        <input className={input} value={form.advisors} onChange={update("advisors")} />
      </label>
      <label className="block text-sm">
        URLs to scan, one per line (up to {MAX_URLS})
        <textarea className={`${input} h-40 font-mono`} value={form.urls} onChange={update("urls")} required />
      </label>
      {tooMany && <p className="text-sm text-red-700">That is {urls.length} URLs. The limit is {MAX_URLS}.</p>}
      <button
        type="submit"
        disabled={running || tooMany}
        className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {running ? "Scanning…" : "Scan"}
      </button>
      {log.length > 0 && (
        <ol aria-live="polite" className="space-y-1 rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
      {firmId && (
        <Link to={`/firm/${firmId}`} className="inline-block text-sm underline">
          Open the findings
        </Link>
      )}
    </form>
  );
}
