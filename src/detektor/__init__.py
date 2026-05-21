"""Detektor AI slop dla tekstow po polsku."""

from .models import Finding, IndexResult, Report, Severity
from .pipeline import analyze_text

__all__ = ["analyze_text", "Report", "Finding", "IndexResult", "Severity"]
