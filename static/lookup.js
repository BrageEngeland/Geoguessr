const COUNTRY_FLAGS = {
  Russia: "🇷🇺",
  Germany: "🇩🇪",
  France: "🇫🇷",
  USA: "🇺🇸",
  Canada: "🇨🇦",
  Mexico: "🇲🇽",
  Turkey: "🇹🇷",
  Brazil: "🇧🇷",
  Brasil: "🇧🇷",
  Kazakhstan: "🇰🇿",
  SouthAfrica: "🇿🇦",
  "South Africa": "🇿🇦",
};

const countryGrid = document.getElementById("lookup-country-grid");
const form = document.getElementById("lookup-form");
const codeInput = document.getElementById("lookup-code");
const statusEl = document.getElementById("lookup-status");
const resultCard = document.getElementById("result");
const resultTitle = document.getElementById("result-title");
const resultRegions = document.getElementById("result-regions");
const resultCities = document.getElementById("result-cities");
const resultNotes = document.getElementById("result-notes");
const resultDifficulty = document.getElementById("result-difficulty");

let availableCountries = [];
let selectedCountry = "Russia";
let shutdownArmed = false;

init();

async function init() {
  await loadCountries();
  setupAutoShutdown();
}

async function loadCountries() {
  try {
    const res = await fetch("/api/countries");
    if (!res.ok) throw new Error("Kunne ikke hente land");
    availableCountries = await res.json();
    if (!availableCountries.find((c) => c.filename === selectedCountry)) {
      selectedCountry = availableCountries[0]?.filename || "";
    }
    renderCountryGrid();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Klarte ikke å laste land fra API-et.";
  }
}

function renderCountryGrid() {
  countryGrid.innerHTML = "";
  availableCountries.forEach((country) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "country-tile";
    if (country.filename === selectedCountry) {
      button.classList.add("country-tile--active");
    }
    button.innerHTML = `
      <span class="country-tile__flag">${
        COUNTRY_FLAGS[country.display_name] ||
        COUNTRY_FLAGS[country.filename] ||
        "🌍"
      }</span>
      <span class="country-tile__name">${country.display_name}</span>
    `;
    button.addEventListener("click", () => {
      selectedCountry = country.filename;
      renderCountryGrid();
      updatePlaceholder();
    });
    countryGrid.appendChild(button);
  });

  updatePlaceholder();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultCard.classList.add("hidden");
  if (!selectedCountry) {
    statusEl.textContent = "Velg et land først.";
    return;
  }
  statusEl.textContent = "Slår opp …";
  const payload = {
    country: selectedCountry,
    code: codeInput.value,
  };
  try {
    const res = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      statusEl.textContent =
        body?.message || "Fant ikke koden eller noe gikk galt.";
      return;
    }

    const data = await res.json();
    renderResult(data);
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Klarte ikke å slå opp koden.";
  }
});

function renderResult(data) {
  statusEl.textContent = "Fant koden!";
  const prefix = data.country_code ? `${data.country_code} ` : "";
  resultTitle.textContent = `${prefix}${data.code} – ${data.country}`;
  resultRegions.textContent = data.regions.join(", ") || "Ingen info";
  resultCities.textContent = data.primary_cities.join(", ") || "Ingen info";
  resultNotes.textContent = data.notes || "Ingen notat.";
  resultDifficulty.textContent = data.difficulty || "Ukjent";
  resultCard.classList.remove("hidden");
}

function updatePlaceholder() {
  const meta = availableCountries.find((c) => c.filename === selectedCountry);
  if (!meta) {
    codeInput.placeholder = "Skriv telefonkode";
    return;
  }
  const { code_hint: hint, code_length_min: minLen, code_length_max: maxLen } = meta;
  if (minLen && maxLen && minLen !== maxLen) {
    codeInput.placeholder = `f.eks. ${hint || "123"} (${minLen}-${maxLen} sifre)`;
  } else if (minLen) {
    codeInput.placeholder = `f.eks. ${hint || "123"} (${minLen} sifre)`;
  } else {
    codeInput.placeholder = "Skriv telefonkode";
  }
}

function setupAutoShutdown() {
  const trigger = () => {
    if (shutdownArmed) return;
    shutdownArmed = true;
    if (navigator.sendBeacon) {
      const blob = new Blob(["bye"], { type: "text/plain" });
      navigator.sendBeacon("/api/dev/shutdown", blob);
    } else {
      fetch("/api/dev/shutdown", {
        method: "POST",
        keepalive: true,
        mode: "same-origin",
      }).catch(() => {});
    }
  };

  window.addEventListener("pagehide", trigger);
  window.addEventListener("beforeunload", trigger);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      trigger();
    }
  });
}
