from loader import load_country_data

data = load_country_data("Germany")
print(f"Antall koder i Germany.json: {len(data.get('codes', []))}")
