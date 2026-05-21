"""Normalizacja uzywana wylacznie do porownan/zliczania (nie do offsetow)."""

from __future__ import annotations


def normalize_token(token: str) -> str:
    """Forma do porownywania tokenow (np. type-token ratio)."""
    return token.casefold()


def has_letter(token: str) -> bool:
    return any(ch.isalpha() for ch in token)
