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

const countryGrid = document.getElementById("quiz-country-grid");
const codeEl = document.getElementById("code");
const promptEl = document.getElementById("prompt");
const feedbackEl = document.getElementById("feedback");
const notesEl = document.getElementById("notes");
const scoreEl = document.getElementById("score");
const streakEl = document.getElementById("streak");
const form = document.getElementById("answer-form");
const inputEl = document.getElementById("answer-input");
const skipBtn = document.getElementById("skip-btn");

// NYE ELEMENTER
const nextBtn = document.getElementById("next-btn");
const regionImg = document.getElementById("region-img");

const state = {
  country: "Russia",
  countries: [],
  question: null,
  questionType: "region",
  score: 0,
  asked: 0,
  streak: 0,
  waiting: false,
  shutdownArmed: false,
  answered: false, // har vi allerede svart på nåværende spørsmål?
};

init();

async function init() {
  await loadCountries();
  await fetchQuestion();
  setupAutoShutdown();
}

// ---------- helpers for bilde ----------

function regionNameToImage(regionName) {
  // "Republic of Tatarstan" -> "republic_of_tatarstan.png"
  return regionName
    .toLowerCase()
    .replace(/[()\s,.'-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") + ".png";
}

function showRegionImage(regions) {
  if (!regions || !regions.length) {
    regionImg.style.display = "none";
    regionImg.src = "";
    return;
  }

  const imgFile = regionNameToImage(regions[0]);

  const folderName = state.country.toLowerCase();

  const imgPath = `/static/maps/${folderName}/${imgFile}`;

  regionImg.style.display = "none";
  regionImg.src = imgPath;
  regionImg.alt = regions[0];

  regionImg.onerror = () => {
    // hvis bildet ikke finnes for denne regionen enda, skjul bare feltet
    regionImg.style.display = "none";
  };
  regionImg.onload = () => {
    regionImg.style.display = "block";
  };
}


// ---------- last inn land / tegn grid ----------

async function loadCountries() {
  try {
    const res = await fetch("/api/countries");
    if (!res.ok) throw new Error("Kunne ikke hente land");
    state.countries = await res.json();
    if (!state.countries.find((c) => c.filename === state.country)) {
      state.country = state.countries[0]?.filename || "";
    }
    renderCountryGrid();
  } catch (error) {
    console.error(error);
    promptEl.textContent = "Klarte ikke å laste land.";
  }
}

function renderCountryGrid() {
  countryGrid.innerHTML = "";
  state.countries.forEach((country) => {
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
        state.country = country.filename;
        state.score = 0;
        state.asked = 0;
        state.streak = 0;
        updateScore();
        renderCountryGrid();
        fetchQuestion();
      }
    });
    countryGrid.appendChild(button);
  });
}

// ---------- hente nytt spørsmål ----------

async function fetchQuestion() {
  // reset UI for nytt spørsmål
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  notesEl.textContent = "";

  regionImg.style.display = "none";
  regionImg.src = "";

  nextBtn.style.display = "none";

  state.answered = false;
  state.waiting = false;

  state.question = null;
  inputEl.value = "";
  inputEl.disabled = false;
  skipBtn.disabled = false;
  inputEl.focus();

  try {
    const params = new URLSearchParams({ country: state.country });
    const res = await fetch(`/api/question?${params.toString()}`);
    if (!res.ok) throw new Error("Spørsmål feilet");
    state.question = await res.json();

    state.questionType = Math.random() < 0.5 ? "city" : "region";

    codeEl.textContent = `${state.question.country_code || ""} ${
      state.question.dial_code
    }`.trim();

    if (
      state.questionType === "city" &&
      state.question.primary_cities &&
      state.question.primary_cities.length
    ) {
      promptEl.textContent =
        "Hvilken by er tilknyttet denne telefonkoden?";
    } else {
      state.questionType = "region";
      promptEl.textContent =
        "Hvilken region/føderalt subjekt bruker denne koden?";
    }
  } catch (error) {
    console.error(error);
    promptEl.textContent = "Klarte ikke å hente spørsmål.";
  }
}

// ---------- svar / hopp over / neste ----------

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.question || state.waiting) return;
  if (state.answered) return; // allerede svart
  const guess = inputEl.value.trim();
  if (!guess) return;
  await submitGuess(guess);
});

skipBtn.addEventListener("click", async () => {
  if (state.waiting || state.answered) return;
  // tomt svar -> blir alltid feil, men viser fasit
  await submitGuess("");
});

nextBtn.addEventListener("click", () => {
  fetchQuestion();
});

// ---------- fasitbygging ----------

async function submitGuess(guess) {
  state.waiting = true;
  state.answered = true;

  feedbackEl.textContent = "Sjekker …";
  feedbackEl.className = "feedback";

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

    // 1. Riktig / Feil
    if (result.correct) {
      state.score += 1;
      state.streak += 1;
      feedbackEl.textContent = `Riktig! ${result.regions.join(", ")}.`;
      feedbackEl.className = "feedback good";
    } else {
      state.streak = 0;
      feedbackEl.textContent = `Feil. Det riktige var ${result.regions.join(", ")}.`;
      feedbackEl.className = "feedback bad";
    }

    // 2-4. Byer / Notat / Plassering (region_group)
    const lines = [];

    if (result.primary_cities && result.primary_cities.length) {
      lines.push("Kjente byer: " + result.primary_cities.join(", "));
    }

    if (result.notes) {
      lines.push("Notat: " + result.notes);
    }

    if (result.region_group) {
      lines.push("Plassering: " + result.region_group);
    }

    notesEl.textContent = lines.join("\n");

    // 5. bilde
    showRegionImage(result.regions);

    // lås input til du trykker Neste
    inputEl.disabled = true;
    skipBtn.disabled = true;

    // vis Neste-knapp
    nextBtn.style.display = "inline-block";

    updateScore();
  } catch (error) {
    console.error(error);
    feedbackEl.textContent = "Klarte ikke å sende svaret.";
    feedbackEl.className = "feedback bad";

    // gi brukeren en sjanse til å prøve igjen hvis dette var nettfeil
    state.answered = false;
  } finally {
    state.waiting = false;
  }
}

// ---------- score / shutdown ----------

function updateScore() {
  scoreEl.textContent = `${state.score} / ${state.asked}`;
  streakEl.textContent = state.streak;
}

function setupAutoShutdown() {
  const trigger = () => {
    if (state.shutdownArmed) return;
    state.shutdownArmed = true;
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
