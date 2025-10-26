import json
from pathlib import Path
import re
import sys
from typing import List, Optional, Tuple


def _region_to_filename(region_name: str) -> str:
    """Samme slugging som i quiz.js: lager forventet bildefilnavn fra regionnavn."""
    name = region_name.lower()
    name = re.sub(r"[()\s,.'-]+", "_", name)
    name = re.sub(r"_+", "_", name)
    name = re.sub(r"^_+|_+$", "", name)
    return f"{name}.png" if name else ""


def _normalize_image_name(value: str) -> str:
    """Trim + legg til .png dersom brukeren bare har gitt et slug."""
    if not value:
        return ""
    trimmed = value.strip()
    if not trimmed:
        return ""
    if re.search(r"\.[a-z0-9]{2,4}$", trimmed, re.IGNORECASE):
        return trimmed
    return f"{trimmed}.png"


def gather_image_candidates(entry: dict) -> List[str]:
    """
    Returnerer alle filnavn vi forventer for en kode.
    1) Bruk eksplisitt `images` hvis satt.
    2) Ellers: slug alle regionnavn (kan være >1).
    """
    images = entry.get("images") or []
    if images:
        return [name for name in (_normalize_image_name(img) for img in images) if name]

    regions = entry.get("regions") or []
    return [
        name for name in (_region_to_filename(region) for region in regions) if name
    ]


def _normalize_country_file(country_arg: Optional[str]) -> Tuple[str, Path]:
    """
    Tar imot brukerinndata (med/uten .json) og returnerer (filnavn, Path stem).
    """
    if not country_arg:
        country_arg = "SouthAfrica"
    country_path = Path(country_arg)
    stem = country_path.stem  # håndterer ".json" hvis oppgitt
    filename = f"{stem}.json"
    return stem, Path(filename)


def check_region_images(country_arg="SouthAfrica"):
    # Finn prosjektroten (mappen over src/)
    base_dir = Path(__file__).resolve().parent.parent

    country_stem, filename = _normalize_country_file(country_arg)

    data_path = base_dir / "Telefonnummer" / filename
    primary_dir = base_dir / "static" / "maps" / country_stem
    fallback_dir = base_dir / "static" / "maps" / country_stem.split("-", 1)[0]

    image_dirs = []
    for candidate in [primary_dir, fallback_dir]:
        if candidate and candidate.exists() and candidate not in image_dirs:
            image_dirs.append(candidate)

    print(f"--- DEBUG: Bilde-sjekk for {filename.name} ---")
    print(f"📁 JSON-fil: {data_path}")
    if image_dirs:
        for idx, folder in enumerate(image_dirs, start=1):
            print(f"🗺️  Bildemappe {idx}: {folder}")
    else:
        print("🗺️  Fant ingen bildemapper som eksisterer.")

    if not data_path.exists():
        print("❌ Fant ikke JSON-filen.")
        return
    if not image_dirs:
        print("❌ Fant ingen gyldige bildemapper.")
        return

    with data_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    entries = data.get("codes", [])
    missing = []
    checked_pairs = []

    for e in entries:
        regions = e.get("regions") or []
        image_files = gather_image_candidates(e)

        if not image_files:
            continue

        for idx, filename in enumerate(image_files):
            exists = any((folder / filename).exists() for folder in image_dirs)
            region_label = (
                regions[idx] if idx < len(regions) else regions[0] if regions else ""
            )
            checked_pairs.append((region_label or filename, filename, exists))
            if not exists:
                missing.append(filename)

    print(f"\n🔍 Antall oppføringer i JSON: {len(entries)}")
    total_png = sum(len(list(folder.glob("*.png"))) for folder in image_dirs)
    print(f"📸 Antall faktiske .png i kartmapper: {total_png}")

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
    arg = sys.argv[1] if len(sys.argv) > 1 else "Russia"
    check_region_images(arg)
