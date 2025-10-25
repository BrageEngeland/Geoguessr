import sys
from loader import load_country_data, available_countries

DEFAULT_COUNTRY = "Russia"


def lookup_code(code: str, db: dict):
    digits = "".join(ch for ch in code if ch.isdigit())
    if not digits:
        return None

    for entry in db["codes"]:
        if entry["code"] == digits:
            return entry
    return None


def pretty_print_result(code, entry, country_prefix=""):
    if entry is None:
        print(f"Fant ikke kode {code}.\n")
        return

    prefix = country_prefix.strip()
    dial_segment = f"{prefix} {entry['code']}".strip() if prefix else entry["code"]
    notes = entry.get("notes") or "Ingen notat."

    print(f"{dial_segment}:")
    print("  By(er):", ", ".join(entry["primary_cities"]))
    print("  Region(er):", ", ".join(entry["regions"]))
    print("  Notat:", notes)
    print()  # blank linje etterpå for lesbarhet


def select_country(current=None, *, allow_keep=True, heading=None):
    countries = available_countries()
    if not countries:
        print("Fant ingen JSON-filer i Telefonnummer/-mappen.")
        return None

    print()
    if heading:
        print(heading)
    else:
        print("Tilgjengelige land:")

    for idx, info in enumerate(countries, start=1):
        marker = " (aktiv)" if info["filename"] == current else ""
        print(f"  {idx}. {info['display_name']} [{info['filename']}] ({info['count']} koder){marker}")

    while True:
        prompt = "Velg land (tall eller filnavn"
        prompt += ", blank = behold): " if allow_keep else "): "
        choice = input(prompt).strip()
        if choice in {"q", "quit", "exit"}:
            print("Avslutter søk.")
            break
        if allow_keep and choice == "":
            return current
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(countries):
                return countries[idx - 1]["filename"]
            print("Ugyldig nummer.")
            continue
        normalized = choice.lower()
        for info in countries:
            if normalized in {info["filename"].lower(), info["display_name"].lower()}:
                return info["filename"]
        print("Fant ikke land, prøv igjen.")


def interactive_mode(initial_country=None):
    country = initial_country or select_country()
    if not country:
        print("Ingen land valgt. Avslutter.")
        return

    try:
        db = load_country_data(country)
    except FileNotFoundError:
        print(f"Fant ikke datafil for {country}.")
        return

    print("📞 Interaktiv søk.")
    print("   - Skriv telefonkoden for å slå opp.")
    print("   - Skriv '0' eller 'land' for å bytte land via nummerlisten.")
    print("   - Skriv 'q' for å avslutte.")

    while True:
        code = input(f"[{country}] Kode (+xxx): ").strip()
        cmd = code.lower()
        if cmd in {"q", "quit", "exit"}:
            print("Avslutter søk.")
            break
        if code == "0" or cmd in {"land", "country", "bytt"}:
            new_country = select_country(
                current=country,
                allow_keep=False,
                heading="Velg nytt land med tallet foran navnet:",
            )
            if new_country and new_country != country:
                try:
                    db = load_country_data(new_country)
                    country = new_country
                    print(f"Byttet til {country}.")
                except FileNotFoundError:
                    print(f"Fant ikke {new_country}. Beholder {country}.")
            continue
        if code == "":
            continue
        entry = lookup_code(code, db)
        pretty_print_result(code, entry, db.get("country_code", ""))


def main():
    """
    Bruk scriptet slik:

    1) python src/search.py
       -> Interaktiv modus (sett land og skriv inn mange koder)

    2) python src/search.py 812
       -> Søker etter 812 i standardlandet (Russia)

    3) python src/search.py France 02
       -> Søker etter kode 02 i Frankrike
    """

    args = sys.argv[1:]
    if len(args) == 0:
        interactive_mode()
        return

    if len(args) == 1:
        country = DEFAULT_COUNTRY
        code = args[0]
    else:
        country = args[0]
        code = args[1]

    try:
        db = load_country_data(country)
    except FileNotFoundError:
        print(f"Fant ikke datafil for {country}.")
        return

    entry = lookup_code(code, db)
    pretty_print_result(code, entry, db.get("country_code", ""))


if __name__ == "__main__":
    main()
