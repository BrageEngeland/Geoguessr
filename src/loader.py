import json
from pathlib import Path


DEFAULT_DATASET_LABEL = "Telefonkoder"


def data_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "Telefonnummer"


def load_country_data(country_name: str):
    data_path = data_dir() / f"{country_name}.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _parse_variant(stem: str) -> tuple[str, str]:
    if "-" not in stem:
        return stem, "default"
    base, variant = stem.split("-", 1)
    return base, variant


def _dataset_label(variant: str, data: dict) -> str:
    if data.get("dataset"):
        return str(data["dataset"])
    if variant == "default":
        return DEFAULT_DATASET_LABEL
    return variant.replace("_", " ").title()


def available_countries():
    countries = []
    for file in sorted(data_dir().glob("*.json")):
        try:
            with open(file, "r", encoding="utf-8") as f:
                raw = f.read().strip()
                if not raw:
                    data = {"country": file.stem, "codes": []}
                else:
                    data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"country": file.stem, "codes": []}

        codes = data.get("codes") or []

        code_values = []
        code_lengths = []
        region_groups = set()
        difficulty_levels = set()

        for entry in codes:
            raw_code = entry.get("code")
            if isinstance(raw_code, list):
                normalized_codes = [
                    str(code).strip() for code in raw_code if str(code).strip()
                ]
            elif raw_code is None:
                normalized_codes = []
            else:
                normalized_codes = [str(raw_code).strip()]

            code_values.extend(normalized_codes)
            code_lengths.extend(len(code) for code in normalized_codes if code)

            region_group = entry.get("region_group")
            if region_group:
                region_groups.add(region_group)

            difficulty = entry.get("difficulty")
            if difficulty:
                difficulty_levels.add(str(difficulty).lower())

        base_name, variant = _parse_variant(file.stem)
        dataset_label = _dataset_label(variant, data)
        dataset_display_label = (
            data.get("dataset_short_label")
            or data.get("dataset_display_name")
            or dataset_label
        )
        group_label = data.get("country", base_name)
        is_default = variant == "default"
        stats_key = (
            group_label if is_default else f"{group_label} ({dataset_label})"
        )

        countries.append(
            {
                "filename": file.stem,
                "display_name": group_label if is_default else stats_key,
                "group_key": base_name,
                "group_label": group_label,
                "dataset_label": dataset_label,
                "dataset_display_label": dataset_display_label,
                "dataset_variant": variant,
                "is_default_dataset": is_default,
                "stats_key": stats_key,
                "count": len(codes),
                "code_hint": code_values[0] if code_values else "",
                "code_length_min": min(code_lengths) if code_lengths else None,
                "code_length_max": max(code_lengths) if code_lengths else None,
                "region_groups": sorted(region_groups),
                "difficulty_levels": sorted(difficulty_levels),
            }
        )
    return countries
