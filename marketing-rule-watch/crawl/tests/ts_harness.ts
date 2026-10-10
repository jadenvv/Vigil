// Driven by test_ts_port.py: reads a JSON job on stdin, prints results as JSON.
import { chunk, fetchPage, guessChannel, sha256Hex } from "../base44/brightdata.ts";

const job = JSON.parse(await new Promise<string>((res) => {
  let s = ""; process.stdin.on("data", (d) => (s += d)); process.stdin.on("end", () => res(s));
}));

const out: Record<string, unknown> = {
  channels: job.urls.map(guessChannel),
  sha: await Promise.all(job.texts.map(sha256Hex)),
  chunks: job.texts.map((t: string) => chunk(t, job.max_chars)),
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const sent: unknown[] = [];
const mock = async (_u: string, init: RequestInit) => {
  const body = JSON.parse(init.body as string);
  sent.push(body);
  if (body.url.endsWith("/fail")) return new Response("blocked", { status: 502 });
  return body.data_format === "screenshot" ? new Response(PNG) : new Response("# Hi\n\nThere");
};
const ok = await fetchPage("https://firm.example/blog/x", { token: "t", zone: "z", screenshot: true, fetchFn: mock });
let err = "";
try { await fetchPage("https://firm.example/fail", { token: "t", zone: "z", fetchFn: mock }); } catch (e) { err = (e as Error).message; }
out.fetch = { page: ok.page, screenshot_len: ok.screenshot?.length ?? 0, log_lines: ok.log.length, err, sent };
console.log(JSON.stringify(out));
