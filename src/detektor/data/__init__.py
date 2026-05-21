"""Ladowanie edytowalnych zasobow (leksykony) z pakietu."""

from __future__ import annotations

from importlib.resources import files
from typing import Any

import yaml


def _load_yaml(name: str) -> Any:
    raw = files("detektor.data").joinpath(name).read_text(encoding="utf-8")
    return yaml.safe_load(raw)


def load_slop_phrases() -> list[dict]:
    data = _load_yaml("slop_phrases_pl.yaml") or {}
    return list(data.get("phrases", []))


def load_connectors() -> list[str]:
    data = _load_yaml("connectors_pl.yaml") or {}
    return list(data.get("connectors", []))
