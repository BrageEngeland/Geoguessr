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
const nextBtn = document.getElementById("next-btn");
const regionImg = document.getElementById("region-img");
const practiceBox = document.querySelector(".practice-box");
const practiceToggleEl = document.getElementById("practice-toggle");
const practiceDiffEl = document.getElementById("practice-diff");
const practiceRegionEl = document.getElementById("practice-region");
const practiceNoteEl = document.getElementById("practice-note");

const state = {
  country: "Russia",
  countries: [],
  question: null,
  questionType: "region",
  score: 0,
  asked: 0,
  streak: 0,
  waiting: false,
  answered: false,
  shutdownArmed: false,
  practiceMode: false,
  practiceDifficulty: "",
  practiceRegionGroup: "",
};

init();

async function init() {
  await loadCountries();
  updatePracticeControls();
  await fetchQuestion();
  setupPracticeHandlers();
  setupAutoShutdown();
}

function setupPracticeHandlers() {
  practiceToggleEl?.addEventListener("change", () => {
    state.practiceMode = practiceToggleEl.checked;
    resetScore();
    fetchQuestion();
  });

  practiceDiffEl?.addEventListener("change", () => {
    state.practiceDifficulty = practiceDiffEl.value;
    if (state.practiceMode) {
      resetScore();
      fetchQuestion();
    }
  });

  practiceRegionEl?.addEventListener("change", () => {
    state.practiceRegionGroup = practiceRegionEl.value;
    if (state.practiceMode) {
      resetScore();
      fetchQuestion();
    }
  });
}

async function loadCountries() {
  try {
    const res = await fetch("/api/countries");
    if (!res.ok) throw new Error("Kunne ikke hente land");
    state.countries = await res.json();
    const current = state.countries.find((c) => c.filename === state.country);
    if (!current) {
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
    const isActive = country.filename === state.country;
    if (isActive) {
      button.classList.add("country-tile--active");
    }
    const count = country.count || 0;
    if (count === 0) {
      button.classList.add("country-tile--disabled");
      button.title = "Ingen koder ennå";
    }
    button.innerHTML = `
      <span class="country-tile__flag">${
        COUNTRY_FLAGS[country.display_name] ||
        COUNTRY_FLAGS[country.filename] ||
        "🌍"
      }</span>
      <span class="country-tile__name">${country.display_name}</span>
      <span class="country-tile__count">${count}</span>
    `;
    button.addEventListener("click", () => {
      if (country.filename !== state.country) {
        state.country = country.filename;
        resetScore();
        renderCountryGrid();
        updatePracticeControls();
        fetchQuestion();
      }
    });
    countryGrid.appendChild(button);
  });
}

async function fetchQuestion() {
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
    if (state.practiceMode && !practiceToggleEl.disabled) {
      if (state.practiceDifficulty) {
        params.set("difficulty", state.practiceDifficulty);
      }
      if (state.practiceRegionGroup) {
        params.set("region_group", state.practiceRegionGroup);
      }
    }

    const res = await fetch(`/api/question?${params.toString()}`);
    if (!res.ok) {
      let message = "Klarte ikke å hente spørsmål.";
      try {
        const body = await res.json();
        message = body?.description || body?.message || message;
      } catch (err) {
        // ignore
      }
      throw new Error(message);
    }
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
      promptEl.textContent = "Hvilken by er tilknyttet denne telefonkoden?";
    } else {
      state.questionType = "region";
      promptEl.textContent = "Hvilken region/føderalt subjekt bruker denne koden?";
    }
  } catch (error) {
    console.error(error);
    promptEl.textContent = error.message;
    inputEl.disabled = true;
    skipBtn.disabled = true;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.question || state.waiting || state.answered) return;
  const guess = inputEl.value.trim();
  if (!guess) return;
  await submitGuess(guess);
});

skipBtn.addEventListener("click", async () => {
  if (state.waiting || state.answered) return;
  await submitGuess("");
});

nextBtn.addEventListener("click", () => {
  fetchQuestion();
});

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

    const lines = [];
    if (result.primary_cities && result.primary_cities.length) {
      lines.push("Kjente byer: " + result.primary_cities.join(", "));
    }
    if (result.region_group) {
      lines.push("Område: " + result.region_group);
    }
    if (result.notes) {
      lines.push("Notat: " + result.notes);
    }
    notesEl.textContent = lines.join("\n");
    showRegionImage(result.regions);

    inputEl.disabled = true;
    skipBtn.disabled = true;
    nextBtn.style.display = "inline-block";
    updateScore();
  } catch (error) {
    console.error(error);
    feedbackEl.textContent = "Klarte ikke å sende svaret.";
    feedbackEl.className = "feedback bad";
    state.answered = false;
  } finally {
    state.waiting = false;
  }
}

function updateScore() {
  scoreEl.textContent = `${state.score} / ${state.asked}`;
  streakEl.textContent = state.streak;
}

function resetScore() {
  state.score = 0;
  state.asked = 0;
  state.streak = 0;
  updateScore();
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

function updatePracticeControls() {
  if (!practiceBox) return;
  const meta = getCurrentCountryMeta();
  const diffOptions = meta?.difficulty_levels || [];
  const regionOptions = meta?.region_groups || [];
  const hasOptions = diffOptions.length > 0 || regionOptions.length > 0;

  practiceToggleEl.disabled = !hasOptions;
  practiceToggleEl.parentElement.classList.toggle("disabled", !hasOptions);
  practiceDiffEl.disabled = diffOptions.length === 0;
  practiceRegionEl.disabled = regionOptions.length === 0;

  if (!hasOptions) {
    practiceToggleEl.checked = false;
    state.practiceMode = false;
    practiceNoteEl &&
      (practiceNoteEl.textContent =
        "Practice mode er ikke tilgjengelig for dette landet ennå.");
  } else {
    practiceNoteEl &&
      (practiceNoteEl.textContent =
        "Aktiver for å filtrere etter vanskelighet eller område.");
  }

  populateSelect(
    practiceDiffEl,
    [
      { value: "", label: "Alle" },
      ...diffOptions.map((value) => ({
        value,
        label: formatDifficulty(value),
      })),
    ],
    state.practiceDifficulty,
    "practiceDifficulty"
  );

  populateSelect(
    practiceRegionEl,
    [
      { value: "", label: "Hele landet" },
      ...regionOptions.map((value) => ({
        value,
        label: formatRegion(value),
      })),
    ],
    state.practiceRegionGroup,
    "practiceRegionGroup"
  );

  if (practiceToggleEl.disabled) {
    state.practiceMode = false;
  }
  practiceToggleEl.checked = state.practiceMode && !practiceToggleEl.disabled;
}

function getCurrentCountryMeta() {
  return state.countries.find((c) => c.filename === state.country) || null;
}

function populateSelect(selectEl, options, desiredValue, stateKey) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    selectEl.appendChild(option);
  });
  const hasDesired = options.some((opt) => opt.value === desiredValue);
  const fallback = options[0]?.value || "";
  const value = hasDesired ? desiredValue : fallback;
  selectEl.value = value;
  if (stateKey) {
    state[stateKey] = value;
  }
}

function formatDifficulty(value) {
  const map = { easy: "Lett", medium: "Medium", hard: "Vanskelig" };
  return map[value?.toLowerCase()] || capitalize(value || "");
}

function formatRegion(value) {
  if (!value) return "";
  return value
    .split(/\s+/)
    .map((part) => capitalize(part))
    .join(" ");
}

function capitalize(word) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

function regionNameToImage(regionName) {
  return (
    regionName
      ?.toLowerCase()
      .replace(/[()\s,.'-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") + ".png"
  );
}

function showRegionImage(regions) {
  if (!regions || !regions.length) {
    regionImg.style.display = "none";
    regionImg.src = "";
    return;
  }

  const imgFile = regionNameToImage(regions[0]);
  if (!imgFile) {
    regionImg.style.display = "none";
    regionImg.src = "";
    return;
  }

  const folderName = state.country;
  const imgPath = `/static/maps/${folderName}/${imgFile}`;
  regionImg.style.display = "none";
  regionImg.src = imgPath;
  regionImg.alt = regions[0];
  regionImg.onerror = () => {
    regionImg.style.display = "none";
  };
  regionImg.onload = () => {
    regionImg.style.display = "block";
  };
}
