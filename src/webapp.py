"""Flask backend that exposes quiz data for lookup and pinpoint views."""

from __future__ import annotations

import random
from functools import lru_cache
from pathlib import Path
from typing import Dict, List
from flask import Flask, abort, jsonify, request, send_from_directory

from code_utils import expand_search_keys, merge_entries, normalize_code_list
from loader import available_countries, load_country_data
from quiz import matches_any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_ROOT / "static"
DEFAULT_COUNTRY = "Russia"

app = Flask(
    __name__,
    static_folder=str(STATIC_DIR),
    static_url_path="/static",
)


class QuizEntry(Dict):
    code: str
    primary_cities: List[str]
    regions: List[str]


@lru_cache(maxsize=16)
def get_country_bundle(country: str):
    try:
        data = load_country_data(country)
    except FileNotFoundError:
        abort(404, description=f"Fant ikke landet {country} i Telefonnummer/-mappen.")

    raw_entries: List[QuizEntry] = data.get("codes") or []
    entries: List[QuizEntry] = []
    index: Dict[str, List[QuizEntry]] = {}

    for entry in raw_entries:
        codes = normalize_code_list(entry.get("code"))
        search_keys = expand_search_keys(codes)
        working_entry = dict(entry)
        working_entry.setdefault("primary_cities", entry.get("primary_cities", []))
        working_entry.setdefault("regions", entry.get("regions", []))
        working_entry["_codes"] = codes
        working_entry["_search_keys"] = search_keys
        working_entry["_primary_code"] = codes[0] if codes else ""
        entries.append(working_entry)

        for code in codes:
            if code:
                index.setdefault(code, []).append(working_entry)
        for key in search_keys:
            index.setdefault(key, []).append(working_entry)

    return {
        "metadata": {
            "country": data.get("country", country),
            "country_code": data.get("country_code", ""),
        },
        "entries": entries,
        "by_code": index,
    }


def _resolve_entry(bundle, raw_code: str):
    if not raw_code:
        return None, None

    direct_matches = bundle["by_code"].get(raw_code)
    if direct_matches:
        return raw_code, _pick_or_merge(direct_matches)

    candidate_keys = list(expand_search_keys([raw_code]))
    digits_only = "".join(ch for ch in raw_code if ch.isdigit())
    if digits_only and digits_only not in candidate_keys:
        candidate_keys.append(digits_only)

    for key in candidate_keys:
        matches = bundle["by_code"].get(key)
        if matches:
            return key, _pick_or_merge(matches)

    return digits_only or raw_code, None


def _pick_or_merge(entries: List[QuizEntry]):
    if not entries:
        return None
    if len(entries) == 1:
        return entries[0]
    return merge_entries(entries)


def pick_question(
    country: str,
    difficulty: str | None = None,
    region_group: str | None = None,
    force_code: str | None = None,
):
    bundle = get_country_bundle(country)
    entries = bundle["entries"]

    if not entries:
        abort(404, description="Ingen telefonkoder er registrert for dette landet ennå.")

    # Hvis vi har fått en spesifikk kode (f.eks. fra spaced repetition)
    if force_code:
        matches = bundle["by_code"].get(force_code)
        if not matches:
            abort(404, description=f"Fant ikke kode {force_code} for {country}.")
        entry = matches[0]
    else:
        # filtrer på vanskelighet hvis valgt
        if difficulty:
            filtered = [
                e
                for e in entries
                if (e.get("difficulty") or "").strip().lower()
                == difficulty.strip().lower()
            ]
            if filtered:
                entries = filtered

        # filtrer på region_group hvis valgt
        if region_group:
            filtered = [
                e
                for e in entries
                if (e.get("region_group") or "").strip().lower()
                == region_group.strip().lower()
            ]
            if filtered:
                entries = filtered

        # velg tilfeldig blant gjenværende
        entry = random.choice(entries)

    code = entry.get("_primary_code") or entry.get("code")
    return {
        "id": code,
        "country": bundle["metadata"]["country"],
        "country_code": bundle["metadata"]["country_code"],
        "dial_code": code,
        "regions": entry.get("regions", []),
        "primary_cities": entry.get("primary_cities", []),
        "difficulty": entry.get("difficulty"),
        "region_group": entry.get("region_group"),
        "images": entry.get("images", []),
    }


def evaluate_answer(country: str, code: str, guess: str):
    bundle = get_country_bundle(country)
    resolved_code, entry = _resolve_entry(bundle, code)
    if entry is None:
        abort(404, description=f"Fant ikke kode {code} for {country}.")

    regions = entry.get("regions", [])
    cities = entry.get("primary_cities", [])

    correct_region = matches_any(guess, regions)
    correct_city = matches_any(guess, cities)

    return {
        "correct": bool(correct_region or correct_city),
        "matched_on": "region" if correct_region else ("city" if correct_city else None),
        "regions": regions,
        "primary_cities": cities,
        "notes": entry.get("notes"),
        "region_group": entry.get("region_group"),
        "images": entry.get("images", []),
    }


@app.get("/api/question")
def api_question():
    country = request.args.get("country", DEFAULT_COUNTRY)
    difficulty = request.args.get("difficulty") or None
    region_group = request.args.get("region_group") or None
    force_code = request.args.get("force_code") or None

    return jsonify(pick_question(
        country=country,
        difficulty=difficulty,
        region_group=region_group,
        force_code=force_code,
    ))




@app.post("/api/answer")
def api_answer():
    payload = request.get_json(force=True) or {}
    country = payload.get("country") or DEFAULT_COUNTRY
    code = (payload.get("code") or "").strip()
    guess = (payload.get("guess") or "").strip()

    if not code:
        abort(400, description="Body må inneholde 'code'.")

    # Viktig endring: guess kan være tomt (= hopp over)
    result = evaluate_answer(country, code, guess)
    return jsonify(result)


@app.get("/api/countries")
def api_countries():
    return jsonify(available_countries())


@app.post("/api/lookup")
def api_lookup():
    payload = request.get_json(force=True) or {}
    country = payload.get("country") or DEFAULT_COUNTRY
    raw_code = (payload.get("code") or "").strip()
    if not raw_code:
        abort(400, description="Oppgi en telefonkode.")

    bundle = get_country_bundle(country)
    resolved_code, entry = _resolve_entry(bundle, raw_code)
    if entry is None:
        return (
            jsonify(
                {
                    "found": False,
                    "code": raw_code,
                    "message": f"Fant ikke kode {raw_code} i {country}.",
                }
            ),
            404,
        )

    return jsonify(
        {
            "found": True,
            "code": resolved_code,
            "country": bundle["metadata"]["country"],
            "country_code": bundle["metadata"]["country_code"],
            "primary_cities": entry.get("primary_cities", []),
            "regions": entry.get("regions", []),
            "notes": entry.get("notes"),
            "difficulty": entry.get("difficulty"),
            "population_rank": entry.get("population_rank"),
            "images": entry.get("images", []),
        }
    )


def _shutdown_server():
    func = request.environ.get("werkzeug.server.shutdown")
    if func is None:
        abort(500, description="Kan ikke stoppe serveren automatisk.")
    func()


@app.post("/api/dev/shutdown")
def api_dev_shutdown():
    _shutdown_server()
    return jsonify({"status": "stopping"})


@app.get("/")
def main_screen():
    return send_from_directory(STATIC_DIR, "main.html")


@app.get("/main")
def main_alias():
    return send_from_directory(STATIC_DIR, "main.html")


@app.get("/pinpoint")
def pinpoint_page():
    return send_from_directory(STATIC_DIR, "pinpoint.html")


@app.get("/quiz")
def quiz_page():
    return send_from_directory(STATIC_DIR, "quiz.html")

@app.get("/lookup")
def lookup_page():
    # Nå vil http://127.0.0.1:5050/lookup vise lookup.html
    return send_from_directory(STATIC_DIR, "lookup.html")

@app.get("/stats")
def stats_page():
    return send_from_directory(STATIC_DIR, "stats.html")

@app.get("/sw.js")
def service_worker():
    # Serve the service worker from the project root so it can control the scope.
    return send_from_directory(PROJECT_ROOT, "sw.js")

@app.errorhandler(404)
def not_found(e):
    return send_from_directory(STATIC_DIR, "main.html")


def main():
    app.run(debug=True, port=5000)


if __name__ == "__main__":
    main()
