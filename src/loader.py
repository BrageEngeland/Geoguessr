import json
from pathlib import Path


def data_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "Telefonnummer"


def load_country_data(country_name: str):
    data_path = data_dir() / f"{country_name}.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def available_countries():
    countries = []
    for file in sorted(data_dir().glob("*.json")):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError:
            continue

        codes = data.get("codes") or []
        if not codes:
            continue

        code_values = [str(entry.get("code", "")).strip() for entry in codes if entry.get("code")]
        code_lengths = [len(code) for code in code_values if code]

        countries.append(
            {
                "filename": file.stem,
                "display_name": data.get("country", file.stem),
                "count": len(codes),
                "code_hint": code_values[0] if code_values else "",
                "code_length_min": min(code_lengths) if code_lengths else None,
                "code_length_max": max(code_lengths) if code_lengths else None,
            }
        )
    return countries
