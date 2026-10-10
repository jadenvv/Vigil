import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import fetch  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


@pytest.fixture(autouse=True)
def sandbox(tmp_path, monkeypatch):
    """No test ever touches the real log, real screenshots or a real token."""
    monkeypatch.setattr(fetch, "LOG_PATH", tmp_path / "calls.log")
    monkeypatch.setattr(fetch, "SCREEN_DIR", tmp_path / "screens")
    monkeypatch.setenv("BRIGHTDATA_ZONE", "test_zone")
    monkeypatch.setenv("BRIGHTDATA_TOKEN", "test_token")
    return tmp_path
