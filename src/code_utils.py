from __future__ import annotations

import re
from typing import Iterable, List, Sequence


_RANGE_PATTERN = re.compile(
    r"""^
    \s*(?P<prefix>[A-Za-z]*)\s*
    (?P<start>\d+)
    \s*-\s*
    (?:(?P<prefix2>[A-Za-z]*)\s*)?
    (?P<end>\d+)
    \s*$
    """,
    re.VERBOSE,
)

_DASH_VARIANTS = ("-", "\u2012", "\u2013", "\u2014", "\u2212")


def normalize_code_list(raw_code) -> List[str]:
    """Return a list of string codes for a code field."""
    if isinstance(raw_code, list):
        return [str(code).strip() for code in raw_code if str(code).strip()]
    if raw_code is None:
        return []
    value = str(raw_code).strip()
    return [value] if value else []


def expand_search_keys(codes: Iterable[str]) -> List[str]:
    """
    Expand code strings into the normalized keys we use for lookups.

    Supports entries that represent numeric ranges (e.g. ``R300–R329``)
    by generating one key per value in the range. The keys are digits only,
    which matches the normalization performed on input codes before lookup.
    """
    keys: List[str] = []
    seen = set()
    for code in codes:
        for key in _expand_code_token(code):
            if key and key not in seen:
                seen.add(key)
                keys.append(key)
    return keys


def _expand_code_token(code: str) -> List[str]:
    normalized = _standardize_dashes(code.strip())
    match = _RANGE_PATTERN.match(normalized)
    if match:
        start_str = match.group("start")
        end_str = match.group("end")
        if not start_str or not end_str:
            return []
        start = int(start_str)
        end = int(end_str)
        if end < start:
            start, end = end, start
        width = max(len(start_str), len(end_str))
        return [str(value).zfill(width) for value in range(start, end + 1)]

    digits = _digits_only(code)
    return [digits] if digits else []


def _standardize_dashes(value: str) -> str:
    result = value
    for dash in _DASH_VARIANTS:
        result = result.replace(dash, "-")
    return result


def _digits_only(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def merge_entries(entries: Sequence[dict]) -> dict:
    """
    Combine multiple entry dicts that refer to the same code into a single
    structure with merged regions/cities and concatenated notes.
    """
    if not entries:
        return {}

    merged = dict(entries[0])
    merged_regions = _merge_str_lists(entries, "regions")
    merged_cities = _merge_str_lists(entries, "primary_cities")
    merged_images = _merge_str_lists(entries, "images")

    if merged_regions is not None:
        merged["regions"] = merged_regions
    if merged_cities is not None:
        merged["primary_cities"] = merged_cities
    if merged_images is not None:
        merged["images"] = merged_images

    notes = [
        str(entry.get("notes")).strip()
        for entry in entries
        if entry.get("notes")
    ]
    if notes:
        unique_notes = []
        seen = set()
        for note in notes:
            if note not in seen:
                seen.add(note)
                unique_notes.append(note)
        merged["notes"] = " / ".join(unique_notes)

    return merged


def _merge_str_lists(entries: Sequence[dict], key: str) -> List[str] | None:
    merged: List[str] = []
    seen = set()
    for entry in entries:
        values = entry.get(key) or []
        for value in values:
            text = str(value).strip()
            if text and text not in seen:
                seen.add(text)
                merged.append(text)
    return merged or None
