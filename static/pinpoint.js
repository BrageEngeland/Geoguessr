const DEFAULT_COUNTRY = "Russia";
const ZONE_FILES = {
  Russia: "/static/zones/russia.json",
};

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

const state = {
  country: DEFAULT_COUNTRY,
  zones: [],
  question: null,
  score: 0,
  asked: 0,
  waiting: false,
};

let availableCountries = [];
let shutdownArmed = false;

const countryGrid = document.getElementById("pinpoint-country-grid");
const promptEl = document.getElementById("prompt");
const scoreEl = document.getElementById("score");
const feedbackEl = document.getElementById("feedback");
const mapImg = document.getElementById("map");
const zonesLayer = document.getElementById("zones");
const missingEl = document.getElementById("missing");

init().catch((error) => console.error(error));

async function init() {
  await loadCountries();
  updateScore();
  await loadZones();
  await fetchQuestion();
  setupAutoShutdown();
}

async function loadCountries() {
  try {
    const res = await fetch("/api/countries");
    if (!res.ok) throw new Error("Kunne ikke hente land");
    availableCountries = await res.json();
    if (!availableCountries.find((c) => c.filename === state.country)) {
      state.country = availableCountries[0]?.filename || "";
    }
    renderCountryGrid();
  } catch (error) {
    console.error(error);
    promptEl.textContent = "Klarte ikke å laste land.";
  }
}

function renderCountryGrid() {
  countryGrid.innerHTML = "";
  availableCountries.forEach((country) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "country-tile";
    if (country.filename === state.country) {
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
      if (country.filename !== state.country) {
        changeCountry(country.filename);
      }
    });
    countryGrid.appendChild(button);
  });
}

async function changeCountry(newCountry) {
  state.country = newCountry;
  state.score = 0;
  state.asked = 0;
  updateScore();
  renderCountryGrid();
  await loadZones();
  await fetchQuestion();
}

async function loadZones() {
  if (!state.country) {
    missingEl.classList.remove("hidden");
    mapImg.removeAttribute("src");
    zonesLayer.innerHTML = "";
    state.zones = [];
    return;
  }
  const zoneFile = ZONE_FILES[state.country];
  zonesLayer.innerHTML = "";
  state.zones = [];
  if (!zoneFile) {
    missingEl.classList.remove("hidden");
    mapImg.removeAttribute("src");
    return;
  }
  try {
    const res = await fetch(zoneFile);
    if (!res.ok) throw new Error("Fant ikke zonefil");
    const data = await res.json();
    mapImg.src = data.image;
    mapImg.alt = data.title || `Kart for ${state.country}`;
    state.zones = data.zones || [];
    zonesLayer.innerHTML = "";
    state.zones.forEach((zone) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zone";
      btn.style.left = `${zone.rect.x}%`;
      btn.style.top = `${zone.rect.y}%`;
      btn.style.width = `${zone.rect.width}%`;
      btn.style.height = `${zone.rect.height}%`;
      btn.title = zone.label;
      btn.addEventListener("click", () => handleGuess(zone));
      btn.dataset.regions = (zone.regions || []).join("||");
      zonesLayer.appendChild(btn);
      zone.element = btn;
    });
    missingEl.classList.add("hidden");
  } catch (error) {
    console.error(error);
    missingEl.classList.remove("hidden");
  }
}

async function fetchQuestion() {
  setPrompt("Henter ny kode …");
  state.question = null;
  clearHighlights();
  try {
    const params = new URLSearchParams({ country: state.country });
    const res = await fetch(`/api/question?${params.toString()}`);
    if (!res.ok) throw new Error("Spørsmål feilet");
    state.question = await res.json();
    const prefix = state.question.country_code
      ? `${state.question.country_code} `
      : "";
    setPrompt(`Hvilket område bruker ${prefix}${state.question.dial_code}?`);
    feedbackEl.textContent = "";
    feedbackEl.className = "feedback";
  } catch (error) {
    console.error(error);
    setPrompt("Klarte ikke å hente spørsmål.");
  }
}

async function handleGuess(zone) {
  if (!state.question || state.waiting) return;
  const guess = zone.regions?.[0] || zone.label;
  state.waiting = true;
  setFeedback("Sjekker …", "");
  try {
    const res = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: state.country,
        code: state.question.dial_code,
        guess,
      }),
    });
    if (!res.ok) throw new Error("Validering feilet");
    const result = await res.json();
    state.asked += 1;
    if (result.correct) {
      state.score += 1;
      setFeedback(
        `Riktig! ${state.question.dial_code} brukes av ${result.regions.join(", ")}.`,
        "good"
      );
      zone.element?.classList.add("correct");
    } else {
      setFeedback(
        `Feil. Riktig region: ${result.regions.join(", ")}.`,
        "bad"
      );
      zone.element?.classList.add("incorrect");
      highlightCorrect(result.regions);
    }
    updateScore();
  } catch (error) {
    console.error(error);
    setFeedback("Klarte ikke å sende svaret.", "bad");
  } finally {
    state.waiting = false;
    setTimeout(fetchQuestion, 1800);
  }
}

function highlightCorrect(regions) {
  state.zones.forEach((zone) => {
    const matches = zone.regions?.some((name) => regions.includes(name));
    if (matches) zone.element?.classList.add("correct");
  });
}

function clearHighlights() {
  state.zones.forEach((zone) => zone.element?.classList.remove("correct", "incorrect"));
}

function updateScore() {
  scoreEl.textContent = `${state.score} / ${state.asked}`;
}

function setPrompt(text) {
  promptEl.textContent = text;
}

function setFeedback(text, variant) {
  feedbackEl.textContent = text;
  feedbackEl.className = `feedback ${variant || ""}`;
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

registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Kunne ikke registrere service worker", err);
    });
  });
}
