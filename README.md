# Geoguessr
Program for regionguessing geoguessr

## Web-demo med kartbilde
1. Installer avhengigheter (gjerne i et virtuelt miljø):
   pip install flask
   
2. Start API-et og den statiske klienten (scriptet velger automatisk en ledig port og faller tilbake til f.eks. 5050 hvis 5000 er i bruk):
   ```bash
   python start_dev_server.py
   ```
3. Åpne `http://127.0.0.1:<port>/` for oppslag. Navigasjonslinjen øverst leder deg også til:
   - `/pinpoint` for kartklikk-spillet
   - `/quiz` for den tekstbaserte quizzen (nettversjon av `src/quiz.py`)

Frontenden bruker nå statiske kartbilder (for eksempel `static/maps/russia.svg`) med zonedata i `static/zones/*.json`. Hver zonde definerer et rektangel (i prosent av bildebredden/-høyden) og hvilke regionnavn den representerer. Når du klikker en zonde sendes tilhørende regionnavn inn til `/api/answer`, slik at eksisterende logikk fra `Telefonnummer/`-filene gjenbrukes.

### Legg til nye land eller forbedre kartet
1. Last ned eller lag et kartbilde (SVG/PNG) og plasser det under `static/maps/`.
2. Opprett en zonde-fil under `static/zones/<land>.json` med struktur som i `static/zones/russia.json`.
3. Registrer filen i `ZONE_FILES` i `static/app.js` slik at klienten vet hvilken fil som hører til landet.
4. Juster rektanglene etter behov. Bruk gjerne utviklerverktøy i nettleseren for å se prosentkoordinater.

Du kan selvsagt utvide til polygoner eller flere nivåer senere, men denne varianten gir en helt offline, enkel og forutsigbar måte å spille på uten tredjeparts kart-API-er.
