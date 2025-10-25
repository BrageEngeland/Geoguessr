import sys
from loader import load_country_data

def lookup_code(code: str, db: dict):
    """
    Slår opp en gitt kode (f.eks. '812', '8772', '4112')
    i databasen (db = innholdet fra Russland.json).

    Returnerer entry-dicten hvis funnet, ellers None.
    """
    # normaliser: fjern '+7' og mellomrom
    c = code.strip()
    c = c.replace("+7", "").strip()

    for entry in db["codes"]:
        if entry["code"] == c:
            return entry
    return None


def pretty_print_result(code, entry):
    """
    Skriver ut resultatet pent til terminalen.
    Hvis entry er None -> sier at den ikke fant koden.
    """
    if entry is None:
        print(f"Fant ikke kode {code}.\n")
        return

    print(f"+7 {entry['code']}:")
    print("  By(er):", ", ".join(entry["primary_cities"]))
    print("  Region(er):", ", ".join(entry["regions"]))
    print("  Notat:", entry["notes"])
    print()  # blank linje etterpå for lesbarhet


def interactive_mode(db):
    """
    Interaktiv søkemodus.
    Lar deg skrive inn kode etter kode, helt til du skriver q/quit/exit.
    """
    print("📞 Interaktiv søk (skriv q for å avslutte)")
    while True:
        code = input("Kode (+7 xxx): ").strip()
        if code.lower() in {"q", "quit", "exit"}:
            print("Avslutter søk.")
            break
        if code == "":
            # bare Enter -> spør på nytt
            continue
        entry = lookup_code(code, db)
        pretty_print_result(code, entry)


def main():
    """
    Hovedinngangen til scriptet.
    Støtter tre måter å kjøre på:

    1) python src/search.py
       -> Interaktiv modus (du kan skrive inn mange koder)

    2) python src/search.py 812
       -> Søker etter 812 i landet "Russland"

    3) python src/search.py Russland 812
       -> Søker etter 812 i eksplisitt valgt land (her: Russland)

    Landnavnet må matche JSON-filen i data/-mappa.
    Sånn vi har det nå heter filen din "Russland.json".
    """

    args = sys.argv[1:]  # alt etter filnavnet

    if len(args) == 0:
        # Ingen argumenter -> interaktiv modus med Russland som default
        db = load_country_data("Russland")
        interactive_mode(db)
        return

    if len(args) == 1:
        # Ett argument: tolk som kode i "Russland"
        country = "Russland"
        code = args[0]
    else:
        # To argumenter: første er land, andre er kode
        country = args[0]
        code = args[1]

    # Last inn databasen for det landet
    db = load_country_data(country)

    # Gjør lookup og print pent
    entry = lookup_code(code, db)
    pretty_print_result(code, entry)


if __name__ == "__main__":
    main()
