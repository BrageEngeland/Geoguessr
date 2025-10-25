"""Flask backend that exposes quiz data for lookup and pinpoint views."""

from __future__ import annotations

import random
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

from flask import Flask, abort, jsonify, request, send_from_directory

from loader import available_countries, load_country_data
from quiz import matches_any

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
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


def _normalize_codes(raw_code):
    if isinstance(raw_code, list):
        return [str(code).strip() for code in raw_code if str(code).strip()]
    if raw_code is None:
        return []
    return [str(raw_code).strip()]


@lru_cache(maxsize=16)
def get_country_bundle(country: str):
    try:
        data = load_country_data(country)
    except FileNotFoundError:
        abort(404, description=f"Fant ikke landet {country} i Telefonnummer/-mappen.")

    raw_entries: List[QuizEntry] = data.get("codes") or []
    entries: List[QuizEntry] = []
    index: Dict[str, QuizEntry] = {}

    for entry in raw_entries:
        codes = _normalize_codes(entry.get("code"))
        working_entry = dict(entry)
        working_entry.setdefault("primary_cities", entry.get("primary_cities", []))
        working_entry.setdefault("regions", entry.get("regions", []))
        working_entry["_codes"] = codes
        working_entry["_primary_code"] = codes[0] if codes else ""
        entries.append(working_entry)

        for code in codes:
            if code:
                index[code] = working_entry

    return {
        "metadata": {
            "country": data.get("country", country),
            "country_code": data.get("country_code", ""),
        },
        "entries": entries,
        "by_code": index,
    }


def pick_question(country: str):
    bundle = get_country_bundle(country)
    entry = random.choice(bundle["entries"])
    code = entry.get("_primary_code") or entry.get("code")
    return {
        "id": code,
        "country": bundle["metadata"]["country"],
        "country_code": bundle["metadata"]["country_code"],
        "dial_code": code,
        "regions": entry.get("regions", []),
        "primary_cities": entry.get("primary_cities", []),
    }


def evaluate_answer(country: str, code: str, guess: str):
    bundle = get_country_bundle(country)
    entry = bundle["by_code"].get(code)
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
    }


@app.get("/api/countries")
def api_countries():
    return jsonify(available_countries())


@app.get("/api/question")
def api_question():
    country = request.args.get("country", DEFAULT_COUNTRY)
    return jsonify(pick_question(country))


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


@app.post("/api/lookup")
def api_lookup():
    payload = request.get_json(force=True) or {}
    country = payload.get("country") or DEFAULT_COUNTRY
    raw_code = (payload.get("code") or "").strip()
    digits = "".join(ch for ch in raw_code if ch.isdigit())
    if not digits:
        abort(400, description="Oppgi en telefonkode.")

    bundle = get_country_bundle(country)
    entry = bundle["by_code"].get(digits)
    if entry is None:
        return (
            jsonify(
                {
                    "found": False,
                    "code": digits,
                    "message": f"Fant ikke kode {digits} i {country}.",
                }
            ),
            404,
        )

    return jsonify(
        {
            "found": True,
            "code": digits,
            "country": bundle["metadata"]["country"],
            "country_code": bundle["metadata"]["country_code"],
            "primary_cities": entry.get("primary_cities", []),
            "regions": entry.get("regions", []),
            "notes": entry.get("notes"),
            "difficulty": entry.get("difficulty"),
            "population_rank": entry.get("population_rank"),
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
def lookup_page():
    return send_from_directory(STATIC_DIR, "lookup.html")


@app.get("/pinpoint")
def pinpoint_page():
    return send_from_directory(STATIC_DIR, "pinpoint.html")


@app.get("/quiz")
def quiz_page():
    return send_from_directory(STATIC_DIR, "quiz.html")


def main():
    app.run(debug=True, port=5000)


if __name__ == "__main__":
    main()
