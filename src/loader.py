import json
from pathlib import Path


def load_country_data(country_name: str):
    data_path = Path(__file__).resolve().parent.parent / f"{country_name}.json"
    with open(data_path, "r", encoding="utf-8") as f:
        return json.load(f)
