"""Loads TAXONOMY from eval/compliance_eval.py (the single source of truth). Don't redefine it."""
from __future__ import annotations

import importlib.util
from pathlib import Path

_EVAL = Path(__file__).resolve().parent.parent / "eval" / "compliance_eval.py"
_spec = importlib.util.spec_from_file_location("_compliance_eval", _EVAL)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

TAXONOMY: dict = _mod.TAXONOMY
