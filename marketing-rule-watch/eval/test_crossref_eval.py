"""Unit tests for the cross-reference scorer. Offline: no detector module, no LLM.

    python3 -m unittest eval/test_crossref_eval.py -v
"""
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crossref_eval as X  # noqa: E402

A, B, C = "https://firm.example/", "https://adv.example/2a", "https://firm.example/blog"
CASE = {
    "id": "t1", "kind": "contradiction",
    "docs": [{"url": A, "markdown": "Welcome.\nWe have never had a losing year since 2012. Call us."},
             {"url": B, "markdown": "Item 8. In 2022 the composite declined 7.4% net of fees."},
             {"url": C, "markdown": "Unrelated blog post about Roth conversions."}],
    "expected": [{"claim_contains": "never had a losing year", "evidence_contains": "declined 7.4%",
                  "claim_url": A, "evidence_url": B}],
}
NEAR = {"id": "t2", "kind": "different_scope", "docs": CASE["docs"], "expected": []}


def flag(claim, evidence, curl=A, eurl=B, conf=0.9):
    return {"claim_span": claim, "claim_url": curl, "evidence_span": evidence, "evidence_url": eurl,
            "topic": "losses", "confidence": conf, "why": "test"}


GOOD = flag("We have never had a losing year since 2012.", "In 2022 the composite declined 7.4% net of fees.")


class Matching(unittest.TestCase):
    def test_exact_match_is_tp(self):
        r = X.score_case(CASE, X._flags([GOOD]))
        self.assertEqual((r["tp"], r["fp"], r["fn"], r["status"]), (1, 0, 0, "ok"))

    def test_case_insensitive_contains(self):
        exp = {**CASE["expected"][0], "claim_contains": "NEVER HAD A LOSING YEAR", "evidence_contains": "DECLINED 7.4%"}
        self.assertTrue(X.matches(X._flags([GOOD])[0], exp))

    def test_url_mismatch_is_not_a_match(self):
        f = X._flags([flag("Unrelated blog post", "declined 7.4%", curl=C)])[0]
        self.assertFalse(X.matches(f, CASE["expected"][0]))
        wrong_ev_url = X._flags([{**GOOD, "evidence_url": C}])[0]
        self.assertFalse(X.matches(wrong_ev_url, CASE["expected"][0]))

    def test_url_optional_when_expected_omits_it(self):
        exp = {"claim_contains": "never had a losing year", "evidence_contains": "declined 7.4%"}
        self.assertTrue(X.matches(X._flags([GOOD])[0], exp))

    def test_claim_and_evidence_swapped_does_not_match(self):
        swapped = flag(GOOD["evidence_span"], GOOD["claim_span"], curl=B, eurl=A)
        r = X.score_case(CASE, X._flags([swapped]))
        self.assertEqual((r["tp"], r["fp"], r["fn"]), (0, 1, 1))

    def test_too_short_span_misses(self):
        # Grounded, but the claim span doesn't contain the expected phrase.
        r = X.score_case(CASE, X._flags([flag("never had", GOOD["evidence_span"])]))
        self.assertEqual((r["tp"], r["fp"], r["fn"], r["status"]), (0, 1, 1, "miss+fp"))

    def test_duplicate_flag_counts_as_fp(self):
        r = X.score_case(CASE, X._flags([GOOD, dict(GOOD, confidence=0.4)]))
        self.assertEqual((r["tp"], r["fp"], r["fn"], r["status"]), (1, 1, 0, "extra_flag"))

    def test_no_flags_is_miss(self):
        r = X.score_case(CASE, [])
        self.assertEqual((r["tp"], r["fn"], r["status"]), (0, 1, "miss"))

    def test_dict_wrapper_accepted(self):
        self.assertEqual(len(X._flags({"flags": [GOOD]})), 1)


class Grounding(unittest.TestCase):
    docs = {d["url"]: d["markdown"] for d in CASE["docs"]}

    def test_grounded(self):
        self.assertTrue(X.grounded(X._flags([GOOD])[0], self.docs))

    def test_paraphrased_claim_is_ungrounded_and_not_tp(self):
        para = flag("We have NEVER had a losing year since 2012.", GOOD["evidence_span"])
        self.assertFalse(X.grounded(X._flags([para])[0], self.docs))
        r = X.score_case(CASE, X._flags([para]))
        self.assertEqual((r["tp"], r["fp"], r["ungrounded"]), (0, 1, 1))

    def test_span_in_wrong_doc_is_ungrounded(self):
        # Evidence text is real, but in doc B, while the flag names doc C.
        self.assertFalse(X.grounded(X._flags([{**GOOD, "evidence_url": C}])[0], self.docs))

    def test_unknown_url_and_empty_span_ungrounded(self):
        self.assertFalse(X.grounded(X._flags([{**GOOD, "claim_url": "https://nowhere.example"}])[0], self.docs))
        self.assertFalse(X.grounded(X._flags([{**GOOD, "evidence_span": "  "}])[0], self.docs))


class Aggregate(unittest.TestCase):
    def test_metrics(self):
        recs = [X.score_case(CASE, X._flags([GOOD])),
                X.score_case(NEAR, X._flags([flag("Welcome.", "Unrelated blog post about Roth conversions.", eurl=C)])),
                X.score_case({**NEAR, "id": "t3"}, []),
                X.score_case({**CASE, "id": "t4"}, X._flags([flag("made up", "also made up")]))]
        m = X.aggregate(recs)
        self.assertEqual((m["tp"], m["fp"], m["fn"]), (1, 2, 1))
        self.assertAlmostEqual(m["precision"], 1 / 3)
        self.assertAlmostEqual(m["recall"], 1 / 2)
        self.assertAlmostEqual(m["f1"], 0.4)
        self.assertEqual((m["near_miss_flagged"], m["n_near_miss_cases"]), (1, 2))
        self.assertEqual(m["contradiction_cases_fully_caught"], 1)
        self.assertAlmostEqual(m["grounding_rate"], 2 / 3)  # 3 flags, 1 ungrounded

    def test_no_flags_at_all(self):
        m = X.aggregate([X.score_case(NEAR, [])])
        self.assertIsNone(m["precision"])
        self.assertIsNone(m["grounding_rate"])
        self.assertEqual(m["near_miss_flagged"], 0)


class Runner(unittest.TestCase):
    def test_detector_exception_stops_run(self):
        def boom(docs):
            raise RuntimeError("LLM unavailable")
        with self.assertRaises(SystemExit) as cm:
            X.run([CASE, NEAR], boom, "boom")
        self.assertIn("No report saved", str(cm.exception))

    def test_detector_receives_url_and_markdown(self):
        seen = []
        X.run([CASE], lambda docs: seen.append(docs) or [], "spy")
        self.assertEqual([set(d) for d in seen[0]], [{"url", "markdown"}] * 3)

    def test_shipped_cases_load_and_stub_runs(self):
        cases = X.load_cases(X.HERE / "cases_crossref.jsonl")
        self.assertGreaterEqual(len(cases), 16)
        rep = X.run(cases, X.stub_crossref, "stub")
        self.assertEqual(rep["metrics"]["grounding_rate"], 1.0)

    def test_load_rejects_missing_evidence(self):
        bad = {**CASE, "expected": [{**CASE["expected"][0], "evidence_contains": "not in any doc"}]}
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps(bad) + "\n")
        with self.assertRaises(SystemExit), redirect_stdout(io.StringIO()):
            X.load_cases(Path(f.name))

    def test_load_rejects_near_miss_with_expected(self):
        bad = {**CASE, "kind": "consistent"}
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(json.dumps(bad) + "\n")
        with self.assertRaises(SystemExit):
            X.load_cases(Path(f.name))


if __name__ == "__main__":
    unittest.main()
