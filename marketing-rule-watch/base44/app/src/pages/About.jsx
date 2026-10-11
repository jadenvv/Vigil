// /about: our mission and who we are. Read mode: one calm column, no data loading.
// Quotes are verbatim from research/feedback_changes.md; the "what we changed" rows are only the ones
// marked shipped there. No names or photos: we have no consent recorded.
import { useEffect, useState } from "react";
import { Shell } from "@/components/Chrome";
import { Link } from "@/lib/router";

const STEPS = [
  {
    title: "Crawled with Bright Data",
    body: "Vigil finds the pages your firm and its advisers publish or adopt, including adviser, press and third-party pages, and captures each one with the time it was fetched.",
  },
  {
    title: "Checked against Marketing Rule checks",
    body: "Each page is read for language that may conflict with the SEC Marketing Rule, such as a guarantee or a testimonial without its disclosure. A flag is kept only if its quote appears exactly on the page.",
  },
  {
    title: "AI suggests a rewrite",
    body: "When the reviewer asks for one, Vigil drafts a rewrite of the flagged sentence. It stays a draft. Nothing publishes on its own.",
  },
  {
    title: "A person decides",
    body: "The reviewer approves, edits or dismisses each flag. Every decision is logged with the time it was made.",
  },
];

const PRINCIPLES = [
  {
    title: "Every flag shows its evidence",
    body: "The exact quote from the page, the capture, and when it was captured. If we can't show the quote, we don't show the flag.",
  },
  {
    title: "A “potential issue for review”, not a verdict",
    body: "Vigil points at language worth a second look. Whether it is a problem is a judgement for the compliance officer.",
  },
  {
    title: "A person approves every change",
    body: "Vigil suggests. The compliance officer decides, and nothing goes out without them.",
  },
  {
    title: "We measure ourselves and publish the caveats",
    body: "Every detector change is scored against a test set. Most of that set is synthetic text we wrote, and we say so wherever we show a number.",
  },
];

// Shipped (✅) rows only, from research/feedback_changes.md.
const CHANGES = [
  {
    heard: "Keyword lists miss new wording.",
    who: "Compliance tester",
    changed:
      "Vigil reads meaning, not a word list. On ten cases we wrote from the testers’ own words, it caught 5 of 5 issues; a keyword list caught none.",
  },
  {
    heard: "They want the captured ad, and a way to find it live themselves.",
    who: "Regulator-side tester",
    changed:
      "Each flag shows a screenshot, the capture time, a link to the live page, the page as captured, and a page fingerprint. “Re-check now” fetches the page again and says whether the quote is still there.",
  },
  {
    heard: "Repeated false positives would kill trust.",
    who: "Regulator-side tester",
    changed:
      "We put precision first. On our synthetic test set, clean documents flagged went from 28% with a keyword list to 0%. A wrong flag takes one click to dismiss, and the dismissal is logged.",
  },
  {
    heard: "Examiners use what’s online to question the firm.",
    who: "Compliance tester",
    changed:
      "A printable “Before your exam” summary lists every open flag with its quote, page and capture date.",
  },
];

const TOOLS = [
  { name: "Base44", use: "runs the whole app: the screens, the data and the scan." },
  { name: "Bright Data", use: "crawls and captures the pages." },
  { name: "Daytona", use: "runs the calculation check." },
];

function Eyebrow({ children }) {
  return <p className="text-xs font-medium uppercase tracking-[0.08em] text-night-600">{children}</p>;
}

function Section({ id, eyebrow, title, children }) {
  return (
    <section aria-labelledby={id} className="space-y-5 border-t border-paper-200 pt-10">
      <div className="space-y-2">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-night-950">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TesterQuote({ text, who }) {
  return (
    <figure className="space-y-2">
      <blockquote className="rounded-r-md border-l-[3px] border-lamp-500 bg-lamp-100 px-4 py-3 font-mono text-sm leading-relaxed text-night-950">
        &ldquo;{text}&rdquo;
      </blockquote>
      <figcaption className="text-sm text-night-600">{who}</figcaption>
    </figure>
  );
}

// One entrance: the column fades up once. Under prefers-reduced-motion it is simply there.
function useEntered() {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  return entered;
}

export default function About() {
  const entered = useEntered();
  return (
    <Shell>
      <article
        className={`mx-auto max-w-2xl space-y-14 pb-4 pt-4 motion-safe:transition motion-safe:duration-500 motion-safe:ease-out sm:pt-8 ${
          entered ? "opacity-100" : "motion-safe:translate-y-2 motion-safe:opacity-0"
        }`}
      >
        <header className="space-y-5">
          <Eyebrow>Our mission &amp; about us</Eyebrow>
          <h1 className="text-balance text-[2rem] font-semibold leading-tight tracking-tight text-night-950 sm:text-4xl">
            Catch what slipped past review, with evidence a person can check.
          </h1>
          <p className="text-pretty text-base leading-relaxed text-night-700 sm:text-lg">
            Vigil helps compliance officers at small SEC-registered investment advisory firms find what their
            firm has published online that may conflict with the SEC Marketing Rule. Each potential issue comes
            with the exact quote, a capture of the page, and the time it was captured, so a person can verify it
            before deciding anything.
          </p>
        </header>

        <Section id="about-problem" eyebrow="The problem" title="What we set out to test">
          <ul className="space-y-5 text-base leading-relaxed text-night-700">
            <li>
              <span className="font-medium text-night-950">Content published outside the review workflow.</span>{" "}
              We wanted to test whether the risk sits in pages nobody routes for review: adviser profiles, old blog
              posts, third-party pages. One compliance tester told us their unreviewed content is mostly staff
              venting, which isn&rsquo;t marketing, so we narrowed Vigil to content the firm and its advisers
              publish or adopt.
            </li>
            <li>
              <span className="font-medium text-night-950">Proving what a page said on a past date.</span> We wanted
              to test whether firms can show what a page said when an examiner asks. Vigil keeps each capture with
              its time and a fingerprint of the page.
            </li>
            <li>
              <span className="font-medium text-night-950">Keyword lists miss new wording.</span> A compliance tester
              put it this way:
            </li>
          </ul>
          <TesterQuote
            text="When you find new things, find new words that mean the same thing, you're just adding to that list of words"
            who="A compliance tester"
          />
        </Section>

        <Section id="about-how" eyebrow="How Vigil works" title="Four steps, and a person at the end">
          <ol className="space-y-6">
            {STEPS.map(({ title, body }, i) => (
              <li key={title} className="grid grid-cols-[1.75rem,1fr] gap-x-3">
                <span className="pt-0.5 font-mono text-sm tabular-nums text-night-400">{i + 1}</span>
                <div className="space-y-1">
                  <h3 className="font-semibold text-night-950">{title}</h3>
                  <p className="text-base leading-relaxed text-night-700">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="about-principles" eyebrow="Our principles" title="What we hold ourselves to">
          <dl className="space-y-6">
            {PRINCIPLES.map(({ title, body }) => (
              <div key={title} className="space-y-1">
                <dt className="font-semibold text-night-950">{title}</dt>
                <dd className="text-base leading-relaxed text-night-700">{body}</dd>
              </div>
            ))}
          </dl>
          <TesterQuote
            text="I would never act on a tool like that without doing additional research"
            who="A regulator-side tester, on why the capture matters"
          />
        </Section>

        <Section id="about-changes" eyebrow="Talking to users" title="What we changed because of testers">
          <p className="text-base leading-relaxed text-night-700">
            We ran short calls with testers during the hackathon. Neither of the first two was our exact user, so
            we treat what they said as direction, not proof. These changes are live in the app.
          </p>
          <ul className="divide-y divide-paper-200 rounded-[10px] border border-paper-200 bg-white">
            {CHANGES.map(({ heard, who, changed }) => (
              <li key={heard} className="space-y-2 p-4 sm:p-5">
                <p className="font-medium text-night-950">{heard}</p>
                <p className="text-xs text-night-600">{who}</p>
                <p className="text-sm leading-relaxed text-night-700">
                  <span className="font-medium text-night-950">What we changed: </span>
                  {changed}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="about-us" eyebrow="About us" title="Who built this">
          <p className="text-base leading-relaxed text-night-700">
            Vigil was built in one day by a team of four at the Talk to Users hackathon, SF Tech Week, on
            October 10, 2026.
          </p>
          <ul className="space-y-2 text-base leading-relaxed text-night-700">
            {TOOLS.map(({ name, use }) => (
              <li key={name}>
                <span className="font-medium text-night-950">{name}</span> {use}
              </li>
            ))}
          </ul>
          <p>
            <Link
              to="/demo"
              className="rounded text-sm font-medium text-night-950 underline decoration-night-300 underline-offset-4 hover:decoration-night-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp-500"
            >
              See the demo firm&rsquo;s inbox &rarr;
            </Link>
          </p>
        </Section>

        <aside className="space-y-1 border-t border-paper-200 pt-6 text-sm text-night-600">
          <p>Quarrywick Wealth is a fictional firm we built for the demo.</p>
        </aside>
      </article>
    </Shell>
  );
}
