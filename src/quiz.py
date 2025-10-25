import random
import re
import sys
from loader import load_country_data, available_countries


QUIT_COMMANDS = {"q", "quit", "exit"}
CHANGE_COMMANDS = {"c", "change", "bytt", "land", "country"}


class ChangeCountryRequest(Exception):
    """Raised when the player wants to switch to another country."""


def normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def matches_any(user_answer, correct_list):
    ua = normalize(user_answer)

    if ua == "":
        return False

    for item in correct_list:
        ci = normalize(item)

        # eksakt match
        if ua == ci:
            return True

        # delvis match ("tatarstan" vs "republic of tatarstan")
        if ua in ci:
            return True

    return False


def handle_control(user_input, allow_change=True):
    ua = normalize(user_input)
    if ua in QUIT_COMMANDS:
        print("\n🛑 Avslutter quiz...")
        sys.exit(0)
    if allow_change and ua in CHANGE_COMMANDS:
        raise ChangeCountryRequest()


def print_note(entry):
    note = entry.get("notes")
    if note:
        print(f"Notat: {note}")


def format_code(country_code: str, code: str) -> str:
    prefix = (country_code or "").strip()
    if prefix:
        return f"{prefix} {code}"
    return code


def ask_by_question(entry, country_code):
    code = entry["code"]
    print(f"Hvilken by er {format_code(country_code, code)}?")
    guess = input("> ")

    handle_control(guess)

    if guess.strip() == "":
        print("Ingen svar ❌")
        print("Riktig svar:", ", ".join(entry["primary_cities"]))
        print_note(entry)
        print()
        return False

    if matches_any(guess, entry["primary_cities"]):
        print("Riktig ✅")
        print_note(entry)
        print()
        return True
    else:
        print(f"Feil ❌ Riktig svar: {', '.join(entry['primary_cities'])}")
        print_note(entry)
        print()
        return False


def ask_region_question(entry, country_code):
    code = entry["code"]
    print(f"Hvilken region/føderalt subjekt bruker {format_code(country_code, code)}?")
    guess = input("> ")

    handle_control(guess)

    if guess.strip() == "":
        print("Ingen svar ❌")
        print("Det var:")
        for r in entry["regions"]:
            print(r)
        print_note(entry)
        print()
        return False

    regions = entry["regions"]
    cities = entry["primary_cities"]

    # 1. Brukeren svarte selve regionen/føderale subjektet
    if matches_any(guess, regions):
        if len(cities) > 0:
            print(f"Riktig ✅ ({cities[0]} ligger i {regions[0]})")
        else:
            print("Riktig ✅")
        print_note(entry)
        print()
        return True

    # 2. Brukeren svarte en by vi assosierer med denne koden
    if matches_any(guess, cities):
        if len(regions) > 0:
            print(f"Riktig ✅ ({cities[0]} er hovedby i {regions[0]})")
        else:
            print("Riktig ✅")
        print_note(entry)
        print()
        return True

    print("Ikke helt ❌ Det var:")
    for r in regions:
        print(" ", r)
    print_note(entry)
    print()
    return False


def choose_country():
    countries = available_countries()
    if not countries:
        print("Fant ingen telefonnummer-filer med innhold.")
        sys.exit(1)

    print("Velg hvilket land du vil spille med:")
    for idx, info in enumerate(countries, start=1):
        print(f"{idx}. {info['display_name']} ({info['count']} koder)")

    while True:
        choice = input("> ")
        try:
            handle_control(choice, allow_change=False)
        except ChangeCountryRequest:
            print("Du velger allerede land. Tast tallet til landet eller 'q' for å avslutte.")
            continue

        choice = choice.strip()
        if choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(countries):
                return countries[idx - 1]

        print(f"Ugyldig valg. Oppgi et tall mellom 1 og {len(countries)}.")


def main():
    print("Skriv 'q' for å avslutte når som helst, eller 'bytt'/'change' for å hoppe til et annet land.\n")
    selected = choose_country()

    while True:
        data = load_country_data(selected["filename"])
        country_name = selected["display_name"]
        country_code = data.get("country_code", "").strip()
        codes = data["codes"]

        score = 0
        asked = 0

        print(f"\n=== Telefonkoder-quiz: {country_name} ===")

        while True:
            entry = random.choice(codes)

            try:
                if random.random() < 0.5:
                    correct = ask_by_question(entry, country_code)
                else:
                    correct = ask_region_question(entry, country_code)
            except ChangeCountryRequest:
                print("\n🌍 Bytter land...\n")
                selected = choose_country()
                break

            asked += 1
            if correct:
                score += 1

            print(f"Stilling: {score}/{asked} riktige.\n")


if __name__ == "__main__":
    main()
