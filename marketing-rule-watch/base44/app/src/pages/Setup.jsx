// Team-only screen: find a firm's pages with `discover`, pick which to check, then `scan` and `detect` them.
// Testers never see this; /demo reads stored rows only.
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChannelChip } from "@/components/Badges";
import { EmptyBlock, ErrorBlock, LoadingBlock, Shell } from "@/components/Chrome";
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

function errorText(error) {
  return error?.response?.data?.error ?? error?.message ?? "Unknown error";
}

// Mirrors siteBase() in base44/shared/discover.ts so /setup and discover agree on a firm's site:
// "https://www.Example.com/firm/index.html?x=1" -> siteUrl "https://www.example.com/firm/",
// matchKey "example.com/firm". A trailing file (index.html, *.php…) means its folder. The path is kept
// because a firm can live under a path (GitHub Pages), and it is part of the match key so two firms
// sharing a host never merge. Matching ignores "www.".
function normalizeSite(raw) {
  const empty = { siteUrl: "", host: "", display: "", matchKey: "" };
  const trimmed = raw.trim();
  if (!trimmed) return empty;
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return empty;
  }
  if (!parsed.host.includes(".")) return empty;
  let path = parsed.pathname.replace(/\/[^/]*\.[a-z0-9]+$/i, "/");
  if (!path.endsWith("/")) path += "/";
  const host = parsed.host.toLowerCase();
  const pathKey = path.replace(/\/+$/, "");
  return {
    siteUrl: `${parsed.protocol}//${host}${path}`,
    host: parsed.hostname.toLowerCase(),
    display: `${host}${pathKey}`,
    matchKey: `${host.replace(/^www\./, "")}${pathKey}`,
  };
}

const withoutTrailingSlash = (url) => url.replace(/\/+$/, "");

// discover logs "plain_get <status> … <url>", or "plain_get ERR:<name> … <url>" for DNS failures and timeouts.
// An error or 4xx/5xx on the site's start URL means it didn't resolve or respond.
function homepageFailed(log, siteUrl) {
  return log.some((line) => {
    const match = line.match(/^plain_get (?:(\d{3})|ERR:\S+) .* (https?:\/\/\S+)$/);
    if (!match || withoutTrailingSlash(match[2]) !== withoutTrailingSlash(siteUrl)) return false;
    return !match[1] || Number(match[1]) >= 400;
  });
}

// Reuse an existing non-demo firm for the same domain so re-scans don't create duplicates.
// The demo firm is never reused: a scan must not change what testers see.
async function findOrCreateFirm({ name, domain, advisorNames }) {
  const [plain, withWww] = await Promise.all([
    base44.entities.Firm.filter({ domain }),
    base44.entities.Firm.filter({ domain: `www.${domain}` }),
  ]);
  const reusable = [...plain, ...withWww].find((firm) => !firm.is_demo);
  if (reusable) return { firm: reusable, reused: true };
  const firm = await base44.entities.Firm.create({ name, domain, advisor_names: advisorNames, is_demo: false });
  return { firm, reused: false };
}

function SetupForm() {
  const [form, setForm] = useState({ name: "", site: "", advisors: "", includeSearch: false });
  const [discovery, setDiscovery] = useState({ status: "idle" });
  const [selected, setSelected] = useState(() => new Set());
  const [manualText, setManualText] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const update = (key) => (event) =>
    setForm((f) => ({ ...f, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const append = (line) => setLog((lines) => [...lines, line]);

  const found = discovery.status === "ready" ? discovery.urls : [];
  const onSite = found.filter((item) => item.source === "site");
  const elsewhere = found.filter((item) => item.source !== "site");
  const manualUrls = parseList(manualText);
  const toScan = [...new Set([...found.filter((item) => selected.has(item.url)).map((item) => item.url), ...manualUrls])];
  const tooMany = toScan.length > MAX_URLS;
  const { siteUrl, host, display, matchKey } = normalizeSite(form.site);

  const handleFind = async (event) => {
    event?.preventDefault();
    if (!form.name.trim() || !siteUrl || discovery.status === "loading") return;
    setForm((f) => ({ ...f, site: display }));
    setDiscovery({ status: "loading" });
    setOutcome(null);
    setLog([]);
    try {
      const res = await base44.functions.invoke("discover", {
        name: form.name.trim(),
        domain: host,
        site: siteUrl,
        include_search: form.includeSearch,
      });
      const urls = Array.isArray(res.data?.urls) ? res.data.urls : [];
      // Own-site pages start checked (up to the scan limit); pages found elsewhere start unchecked
      // because search can return other firms with similar names.
      setSelected(new Set(urls.filter((item) => item.source === "site").slice(0, MAX_URLS).map((item) => item.url)));
      const log = Array.isArray(res.data?.log) ? res.data.log : [];
      setDiscovery({ status: "ready", urls, unreachable: homepageFailed(log, siteUrl), searchesUsed: res.data?.searches_used ?? 0 });
    } catch (error) {
      setDiscovery({ status: "error", message: errorText(error) });
    }
  };

  const setGroup = (items, checked) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const item of items) checked ? next.add(item.url) : next.delete(item.url);
      return next;
    });
  const toggle = (url) =>
    setSelected((current) => {
      const next = new Set(current);
      next.has(url) ? next.delete(url) : next.add(url);
      return next;
    });

  // Sequential and no retries: Bright Data and LLM credits are finite.
  const handleScan = async () => {
    if (running || tooMany || !toScan.length) return;
    setRunning(true);
    setLog([]);
    setOutcome(null);
    try {
      const { firm, reused } = await findOrCreateFirm({
        name: form.name.trim(),
        domain: matchKey,
        advisorNames: parseList(form.advisors),
      });
      append(reused ? `Adding to existing firm ${firm.name}` : `Created firm ${firm.name}`);
      // Remember what the firm already had, so detect runs only on pages this scan created or re-fetched.
      const before = new Map((await base44.entities.Page.filter({ firm_id: firm.id })).map((p) => [p.id, p.fetched_at]));
      // Each URL takes 10-13 s with a screenshot, so small batches keep every call under the function time limit.
      let created = 0;
      const failed = [];
      for (let start = 0; start < toScan.length; start += SCAN_BATCH_SIZE) {
        const batch = toScan.slice(start, start + SCAN_BATCH_SIZE);
        append(`Scanning ${start + 1}-${start + batch.length} of ${toScan.length}…`);
        try {
          const scan = (await base44.functions.invoke("scan", { firm_id: firm.id, urls: batch })).data;
          created += scan.created ?? 0;
          failed.push(...(scan.failed ?? []));
        } catch (error) {
          // A failed batch is reported, not retried: credits are finite.
          failed.push(...batch.map((url) => ({ url, error: errorText(error) })));
        }
        append(`Scanned ${Math.min(start + batch.length, toScan.length)} of ${toScan.length}`);
      }
      if (created === 0) {
        setOutcome({ created: 0, failed });
        return;
      }
      append(`Scan stored ${created} ${created === 1 ? "page" : "pages"}`);
      for (const failure of failed) append(`Could not fetch ${failure.url}: ${failure.error}`);

      const pages = (await base44.entities.Page.filter({ firm_id: firm.id })).filter(
        (page) => !before.has(page.id) || before.get(page.id) !== page.fetched_at,
      );
      let flagTotal = 0;
      for (const [i, page] of pages.entries()) {
        append(`Checking page ${i + 1} of ${pages.length}: ${page.url}`);
        try {
          const detect = (await base44.functions.invoke("detect", { page_id: page.id })).data;
          flagTotal += detect.created ?? 0;
        } catch (error) {
          append(`Check failed for ${page.url}: ${errorText(error)}`);
        }
      }
      append(`Done: ${flagTotal} potential ${flagTotal === 1 ? "issue" : "issues"} for review`);
      setOutcome({ created, failed, firmId: firm.id });
    } catch (error) {
      append(`Stopped: ${errorText(error)}`);
    } finally {
      setRunning(false);
    }
  };

  const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
  const primary = "rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50";
  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={handleFind} className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Scan a firm</h1>
        <label className="block text-sm">
          Firm name
          <input className={input} value={form.name} onChange={update("name")} required disabled={running} />
        </label>
        <label className="block text-sm">
          Website
          <input
            className={input}
            value={form.site}
            onChange={update("site")}
            placeholder="example.com or https://example.com/firm/"
            required
            disabled={running}
          />
          {form.site.trim() && display && display !== form.site.trim() && (
            <span data-testid="domain-hint" className="mt-1 block text-xs text-slate-500">
              Will check {display}
            </span>
          )}
        </label>
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">Advisor names (optional)</summary>
          <input
            className={input}
            value={form.advisors}
            onChange={update("advisors")}
            placeholder="Comma or line separated"
            disabled={running}
          />
        </details>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.includeSearch} onChange={update("includeSearch")} disabled={running} />
          Also search LinkedIn and review sites (uses search credits)
        </label>
        <button type="submit" disabled={running || discovery.status === "loading"} className={primary}>
          {discovery.status === "loading" ? "Finding pages…" : "Find pages"}
        </button>
      </form>

      {discovery.status === "loading" && (
        <div className="space-y-3">
          <p role="status" className="text-sm text-slate-600">
            {form.includeSearch
              ? "Finding pages and searching the web. This takes about 40 seconds."
              : "Finding pages on the site…"}
          </p>
          <LoadingBlock rows={3} />
        </div>
      )}
      {discovery.status === "error" && (
        <ErrorBlock message={`We couldn't find pages: ${discovery.message}`} onRetry={() => handleFind()} />
      )}

      {discovery.status === "ready" && (
        <section className="space-y-4" aria-label="Pages to check">
          {discovery.unreachable && (
            <p role="status" data-testid="unreachable" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              We couldn't reach {display}, so only its start page is listed. Check the website, or add URLs manually.
            </p>
          )}
          {found.length === 0 ? (
            <EmptyBlock title={`No pages found on ${display}. Add URLs manually.`} />
          ) : (
            <>
              <UrlGroup
                title="On your site"
                items={onSite}
                selected={selected}
                onToggle={toggle}
                onSetAll={(checked) => setGroup(onSite, checked)}
                disabled={running}
              />
              <UrlGroup
                title="Elsewhere on the web"
                note="Check that these are about your firm before scanning."
                items={elsewhere}
                selected={selected}
                onToggle={toggle}
                onSetAll={(checked) => setGroup(elsewhere, checked)}
                disabled={running}
              />
            </>
          )}
          <details className="text-sm" open={found.length === 0}>
            <summary className="cursor-pointer text-slate-600">Add a URL manually</summary>
            <textarea
              aria-label="URLs to add, one per line"
              className={`${input} h-28 font-mono`}
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              placeholder="https://example.com/page"
              disabled={running}
            />
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleScan} disabled={running || tooMany || !toScan.length} className={primary}>
              {running ? "Scanning…" : `Scan ${toScan.length} ${toScan.length === 1 ? "page" : "pages"}`}
            </button>
            <span data-testid="selected-count" className={`text-sm ${tooMany ? "text-red-700" : "text-slate-600"}`}>
              {toScan.length} selected (max {MAX_URLS})
            </span>
          </div>
        </section>
      )}

      {log.length > 0 && (
        <ol aria-live="polite" className="space-y-1 rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      )}
      {outcome?.created === 0 && (
        <div role="alert" data-testid="no-pages" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">No pages could be stored</p>
          <ul className="mt-2 space-y-1 text-xs">
            {outcome.failed.map((failure) => (
              <li key={failure.url} className="break-all">
                {failure.url}: {failure.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      {outcome?.firmId && (
        <Link to={`/firm/${outcome.firmId}`} className="inline-block text-sm underline">
          Open the findings
        </Link>
      )}
    </div>
  );
}

// Search results are noisy (look-alike firms, personal profiles), so their host is shown first and bold.
function UrlLabel({ item }) {
  if (item.source === "site") return <span className="break-all">{item.url}</span>;
  let host = item.url;
  let rest = "";
  try {
    const parsed = new URL(item.url);
    host = parsed.host;
    rest = `${parsed.pathname}${parsed.search}`;
  } catch {
    // Not a parseable URL: show it whole.
  }
  return (
    <span className="break-all">
      <span className="font-semibold">{host}</span>
      <span className="text-slate-500">{rest === "/" ? "" : rest}</span>
    </span>
  );
}

function UrlGroup({ title, note, items, selected, onToggle, onSetAll, disabled }) {
  if (!items.length) return null;
  const count = items.filter((item) => selected.has(item.url)).length;
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-4">
      <legend className="px-1 text-sm font-medium">
        {title} <span className="font-normal text-slate-500">({count} of {items.length})</span>
      </legend>
      {note && <p className="mb-2 text-xs text-amber-800">{note}</p>}
      <div className="mb-2 flex gap-3 text-xs">
        <button type="button" className="underline" onClick={() => onSetAll(true)} disabled={disabled}>
          Select all
        </button>
        <button type="button" className="underline" onClick={() => onSetAll(false)} disabled={disabled}>
          Select none
        </button>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.url}>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(item.url)}
                onChange={() => onToggle(item.url)}
                disabled={disabled}
              />
              <span className="flex flex-wrap items-center gap-2">
                <ChannelChip channel={item.channel} />
                <UrlLabel item={item} />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
