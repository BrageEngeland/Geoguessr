import random
import re
import sys
from loader import load_country_data


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

        # moscow/moskva fleks
        if ua == "moskva" and "moscow" in ci:
            return True
        if ua == "moscow" and "moskva" in ci:
            return True

    return False


def check_quit(user_input):
    ua = normalize(user_input)
    if ua in {"q", "quit", "exit"}:
        print("\n🛑 Avslutter quiz...")
        sys.exit(0)


def ask_by_question(entry):
    code = entry["code"]
    print(f"Hvilken by er +7 {code}?")
    guess = input("> ")

    check_quit(guess)

    if guess.strip() == "":
        print("Ingen svar ❌")
        print("Riktig svar:", ", ".join(entry["primary_cities"]), "\n")
        return False

    if matches_any(guess, entry["primary_cities"]):
        print("Riktig ✅\n")
        return True
    else:
        print(f"Feil ❌ Riktig svar: {', '.join(entry['primary_cities'])}\n")
        return False


def ask_region_question(entry):
    code = entry["code"]
    print(f"Hvilken region/føderalt subjekt bruker +7 {code}?")
    guess = input("> ")

    check_quit(guess)

    if guess.strip() == "":
        print("Ingen svar ❌")
        print("Det var:")
        for r in entry["regions"]:
            print(r)
        print()
        return False

    regions = entry["regions"]
    cities = entry["primary_cities"]

    # 1. Brukeren svarte selve regionen/føderale subjektet
    if matches_any(guess, regions):
        if len(cities) > 0:
            print(f"Riktig ✅ ({cities[0]} ligger i {regions[0]})\n")
        else:
            print("Riktig ✅\n")
        return True

    # 2. Brukeren svarte en by vi assosierer med denne koden
    if matches_any(guess, cities):
        if len(regions) > 0:
            print(f"Riktig ✅ ({cities[0]} er hovedby i {regions[0]})\n")
        else:
            print("Riktig ✅\n")
        return True

    print("Ikke helt ❌ Det var:")
    for r in regions:
        print(" ", r)
    print()
    return False


def main():
    data = load_country_data("Russland")
    codes = data["codes"]

    score = 0
    rounds = 10

    print("=== Russiske telefonkoder-quiz ===")
    print("Skriv 'q' for å avslutte når som helst.\n")

    for _ in range(rounds):
        entry = random.choice(codes)

        # 50/50 by vs region/føderalt subjekt
        if random.random() < 0.5:
            correct = ask_by_question(entry)
        else:
            correct = ask_region_question(entry)

        if correct:
            score += 1

    print(f"\nFerdig! Du fikk {score} av {rounds} poeng.")


if __name__ == "__main__":
    main()
