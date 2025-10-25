import json
from pathlib import Path
import re
import sys
from typing import Optional, Tuple


def region_to_filename(region_name: str) -> str:
    """Samme logikk som i quiz.js: lager forventet bildefilnavn fra regionnavn."""
    name = region_name.lower()
    name = re.sub(r"[()\s,.'-]+", "_", name)
    name = re.sub(r"_+", "_", name)
    name = re.sub(r"^_+|_+$", "", name)
    return f"{name}.png"


def _normalize_country_file(country_arg: Optional[str]) -> Tuple[str, Path]:
    """
    Tar imot brukerinndata (med/uten .json) og returnerer (filnavn, Path stem).
    """
    if not country_arg:
        country_arg = "Kazakhstan"
    country_path = Path(country_arg)
    stem = country_path.stem  # håndterer ".json" hvis oppgitt
    filename = f"{stem}.json"
    return stem, Path(filename)


def check_region_images(country_arg="Kazakhstan"):
    # Finn prosjektroten (mappen over src/)
    base_dir = Path(__file__).resolve().parent.parent

    country_stem, filename = _normalize_country_file(country_arg)

    data_path = base_dir / "Telefonnummer" / filename
    img_dir = base_dir / "static" / "maps" / country_stem

    print(f"--- DEBUG: Bilde-sjekk for {filename.name} ---")
    print(f"📁 JSON-fil: {data_path}")
    print(f"🗺️  Bildemappe: {img_dir}")

    if not data_path.exists():
        print("❌ Fant ikke JSON-filen.")
        return
    if not img_dir.exists():
        print("❌ Fant ikke bildemappen.")
        return

    with data_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    entries = data.get("codes", [])
    missing = []
    checked_pairs = []

    for e in entries:
        regions = e.get("regions") or []
        if not regions:
            continue

        # vi bruker bare første region for bildet, samme som frontend
        region = regions[0]
        filename = region_to_filename(region)
        file_path = img_dir / filename
        checked_pairs.append((region, filename, file_path.exists()))

        if not file_path.exists():
            missing.append(filename)

    print(f"\n🔍 Antall oppføringer i JSON: {len(entries)}")
    print(f"📸 Antall faktiske .png i maps-mappa: {len(list(img_dir.glob('*.png')))}")

    # Vis en liste over hva vi forventer
    print("\nForventede filnavn per region (første region pr kode):")
    for region, filename, exists in sorted(set(checked_pairs)):
        status = "✅ finnes" if exists else "❌ mangler"
        print(f"  {region:<40} -> {filename:<40} {status}")

    if missing:
        print(f"\n⚠️ Mangler {len(set(missing))} bilder totalt:")
        for m in sorted(set(missing)):
            print("  -", m)
    else:
        print("\n🎉 Alle regioner har tilhørende bilder!")

    print("--- SLUTT DEBUG ---")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "Kazakhstan"
    check_region_images(arg)
