from __future__ import annotations

from pathlib import Path

import pytest

_FIX = Path(__file__).parent / "fixtures"


@pytest.fixture
def sloppy_text() -> str:
    return (_FIX / "sloppy_pl.txt").read_text(encoding="utf-8")


@pytest.fixture
def clean_text() -> str:
    return (_FIX / "clean_pl.txt").read_text(encoding="utf-8")
