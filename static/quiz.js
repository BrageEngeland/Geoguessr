const FLAG_PATHS = {
  Brazil: "/static/icons/flags/br.svg",
  Brasil: "/static/icons/flags/br.svg",
  Canada: "/static/icons/flags/ca.svg",
  France: "/static/icons/flags/fr.svg",
  Germany: "/static/icons/flags/de.svg",
  Kazakhstan: "/static/icons/flags/kz.svg",
  Mexico: "/static/icons/flags/mx.svg",
  Russia: "/static/icons/flags/ru.svg",
  Turkey: "/static/icons/flags/tr.svg",
  USA: "/static/icons/flags/us.svg",
  "United States": "/static/icons/flags/us.svg",
  SouthAfrica: "/static/icons/flags/za.svg",
  "South Africa": "/static/icons/flags/za.svg",
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
const regionGallery = document.getElementById("region-gallery");
const practiceBox = document.querySelector(".practice-box");
const practiceToggleEl = document.getElementById("practice-toggle");
const practiceDiffEl = document.getElementById("practice-diff");
const practiceRegionEl = document.getElementById("practice-region");
const practiceNoteEl = document.getElementById("practice-note");
const datasetPickerEl = document.getElementById("dataset-picker");
const datasetSelectEl = document.getElementById("dataset-select");

const state = {
  country: "Russia",
  countryGroups: [],
  countryGroupKey: "Russia",
  datasetSelections: {},
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

function getFlagPath(label, fallback) {
  const normalized = label?.replace(/\s*\(.*\)$/, "");
  return (
    FLAG_PATHS[label] ||
    FLAG_PATHS[normalized] ||
    FLAG_PATHS[fallback] ||
    null
  );
}

function renderFlag(label, fallback) {
  const path = getFlagPath(label, fallback);
  if (!path) {
    return "🌍";
  }
  return `<img src="${path}" alt="" loading="lazy" decoding="async" />`;
}

function loadStats() {
  try {
    const raw = localStorage.getItem("quizStats");
    if (!raw) {
      return { global: { asked: 0, correct: 0, bestStreak: 0 } };
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Kunne ikke lese quizStats fra localStorage:", e);
    return { global: { asked: 0, correct: 0, bestStreak: 0 } };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem("quizStats", JSON.stringify(stats));
  } catch (e) {
    console.warn("Kunne ikke lagre quizStats:", e);
  }
}


function recordAnswer(countryName, wasCorrect, currentStreak) {
  const stats = loadStats();

  // init global
  if (!stats.global) {
    stats.global = { asked: 0, correct: 0, bestStreak: 0 };
  }
  // init land
  if (!stats[countryName]) {
    stats[countryName] = { asked: 0, correct: 0, bestStreak: 0 };
  }

  // øk tellinger
  stats.global.asked += 1;
  stats[countryName].asked += 1;

  if (wasCorrect) {
    stats.global.correct += 1;
    stats[countryName].correct = (stats[countryName].correct || 0) + 1;
  } else {
    // sørg for felt finnes
    stats.global.correct = stats.global.correct || 0;
    stats[countryName].correct = stats[countryName].correct || 0;
  }

  // streak-highscore
  if (currentStreak > (stats.global.bestStreak || 0)) {
    stats.global.bestStreak = currentStreak;
  }
  if (currentStreak > (stats[countryName].bestStreak || 0)) {
    stats[countryName].bestStreak = currentStreak;
  }

  saveStats(stats);
}


async function init() {
  setupDatasetPicker();
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

function setupDatasetPicker() {
  if (!datasetSelectEl) return;
  datasetSelectEl.addEventListener("change", () => {
    const nextValue = datasetSelectEl.value;
    if (nextValue && nextValue !== state.country) {
      changeDataset(nextValue);
    }
  });
}

async function loadCountries() {
  try {
    const res = await fetch("/api/countries");
    if (!res.ok) throw new Error("Kunne ikke hente land");
    const rawCountries = await res.json();
    state.countryGroups = buildCountryGroups(rawCountries);
    if (!state.countryGroups.length) {
      throw new Error("Fant ingen land å øve på.");
    }
    if (!state.countryGroups.some((group) => group.key === state.countryGroupKey)) {
      state.countryGroupKey = state.countryGroups[0].key;
    }
    ensureDatasetSelection();
    renderCountryGrid();
    renderDatasetOptions();
  } catch (error) {
    console.error(error);
    promptEl.textContent = "Klarte ikke å laste land.";
  }
}

function renderCountryGrid() {
  countryGrid.innerHTML = "";
  state.countryGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "country-tile";
    const isActive = group.key === state.countryGroupKey;
    if (isActive) {
      button.classList.add("country-tile--active");
    }
    const count = group.count || 0;
    if (count === 0) {
      button.classList.add("country-tile--disabled");
      button.title = "Ingen koder ennå";
    }
    button.innerHTML = `
      <span class="country-tile__flag">${flagForGroup(group)}</span>
      <span class="country-tile__name">${group.label}</span>
      <span class="country-tile__count">${count}</span>
    `;
    button.addEventListener("click", () => {
      if (group.key !== state.countryGroupKey) {
        selectCountryGroup(group.key);
      }
    });
    countryGrid.appendChild(button);
  });
}

async function fetchQuestion() {
  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  notesEl.textContent = "";
  clearRegionGallery();
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
    let wasCorrect = false;

    if (result.correct) {
      state.score += 1;
      state.streak += 1;
      wasCorrect = true;
      feedbackEl.textContent = `Riktig! ${result.regions.join(", ")}.`;
      feedbackEl.className = "feedback good";
    } else {
      state.streak = 0;
      feedbackEl.textContent = `Feil. Det riktige var ${result.regions.join(", ")}.`;
      feedbackEl.className = "feedback bad";
    }


    const statsKey = getCurrentDatasetMeta()?.stats_key || state.country;
    recordAnswer(statsKey, wasCorrect, state.streak);


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
    showRegionImages({
      regions: result.regions,
      images: result.images && result.images.length ? result.images : state.question?.images,
    });

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
  const meta = getCurrentDatasetMeta();
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

function getCurrentGroup() {
  return state.countryGroups.find((group) => group.key === state.countryGroupKey) || null;
}

function getCurrentDatasetMeta() {
  const group = getCurrentGroup();
  if (!group) return null;
  return group.datasets.find((dataset) => dataset.filename === state.country) || null;
}

function buildCountryGroups(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const key = entry.group_key || entry.filename;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: entry.group_label || entry.display_name || key,
        datasets: [],
        defaultDataset: null,
        count: 0,
      });
    }
    const group = map.get(key);
    group.datasets.push(entry);
    if (!group.defaultDataset || entry.is_default_dataset) {
      group.defaultDataset = entry;
    }
  });

  return Array.from(map.values()).map((group) => {
    group.datasets.sort((a, b) => {
      if (a.is_default_dataset === b.is_default_dataset) {
        return a.dataset_label.localeCompare(b.dataset_label);
      }
      return a.is_default_dataset ? -1 : 1;
    });
    group.count =
      group.defaultDataset?.count ??
      group.datasets[0]?.count ??
      0;
    return group;
  });
}

function ensureDatasetSelection() {
  const group = getCurrentGroup();
  if (!group) {
    state.country = "";
    return;
  }
  const preferred = state.datasetSelections[group.key];
  const match = group.datasets.find((dataset) => dataset.filename === preferred);
  const fallback = match || group.defaultDataset || group.datasets[0];
  if (fallback) {
    state.country = fallback.filename;
    state.datasetSelections[group.key] = fallback.filename;
  } else {
    state.country = "";
  }
}

function selectCountryGroup(groupKey) {
  state.countryGroupKey = groupKey;
  ensureDatasetSelection();
  renderCountryGrid();
  renderDatasetOptions();
  resetScore();
  updatePracticeControls();
  fetchQuestion();
}

function changeDataset(datasetFilename) {
  state.country = datasetFilename;
  const group = getCurrentGroup();
  if (group) {
    state.datasetSelections[group.key] = datasetFilename;
  }
  renderDatasetOptions();
  resetScore();
  updatePracticeControls();
  fetchQuestion();
}

function renderDatasetOptions() {
  if (!datasetSelectEl || !datasetPickerEl) return;
  const group = getCurrentGroup();
  if (!group) {
    datasetPickerEl.hidden = true;
    return;
  }
  datasetSelectEl.innerHTML = "";
  group.datasets.forEach((dataset) => {
    const option = document.createElement("option");
    option.value = dataset.filename;
    option.textContent =
      dataset.dataset_display_label ||
      dataset.dataset_label ||
      dataset.display_name;
    datasetSelectEl.appendChild(option);
  });
  datasetSelectEl.value = state.country || group.datasets[0]?.filename || "";
  datasetSelectEl.disabled = group.datasets.length <= 1;
  datasetPickerEl.hidden = group.datasets.length <= 1;
}

function flagForGroup(group) {
  const label = group?.label || "";
  return renderFlag(label, group?.key);
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
  if (!regionName) return "";
  const slug = regionName
    .toLowerCase()
    .replace(/[()\s,.'-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `${slug}.png` : "";
}

function normalizeImageName(name) {
  if (!name) return "";
  return name.trim();
}

function buildImageSources(file) {
  if (!file) return [];
  const trimmed = file.trim();
  if (!trimmed) return [];
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return [trimmed];
  }

  const hasExtension = /\.[a-z0-9]{2,4}$/i.test(trimmed);
  const filename = hasExtension ? trimmed : `${trimmed}.png`;

  const sources = [];
  const datasetFolder = state.country;
  const baseFolder = getCurrentGroup()?.key;

  const pushFolder = (folder) => {
    if (!folder) return;
    sources.push(`/static/maps/${folder}/${filename}`);
  };

  pushFolder(datasetFolder);
  if (baseFolder && baseFolder !== datasetFolder) {
    pushFolder(baseFolder);
  }

  return Array.from(new Set(sources));
}

function gatherImageCandidates(images, regions) {
  const explicit = (images || [])
    .map(normalizeImageName)
    .filter(Boolean);
  if (explicit.length) {
    return Array.from(new Set(explicit));
  }
  const fromRegions = (regions || [])
    .map(regionNameToImage)
    .filter(Boolean);
  return Array.from(new Set(fromRegions));
}

function clearRegionGallery() {
  if (!regionGallery) return;
  regionGallery.querySelectorAll("img").forEach((img) => {
    img.dataset.cancelled = "true";
  });
  regionGallery.innerHTML = "";
  regionGallery.style.display = "none";
}

function showRegionImages({ regions = [], images = [] } = {}) {
  if (!regionGallery) return;
  clearRegionGallery();

  const candidates = gatherImageCandidates(images, regions);
  if (!candidates.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  candidates.forEach((file, index) => {
    const sources = buildImageSources(file);
    if (!sources.length) {
      return;
    }
    const img = document.createElement("img");
    img.className = "region-gallery__img";
    img.alt = regions[index] || regions[0] || "Region";
    appendImageWithFallback(img, sources);
    fragment.appendChild(img);
  });

  regionGallery.appendChild(fragment);
  if (regionGallery.children.length) {
    regionGallery.style.display = "flex";
  }
}

function appendImageWithFallback(img, sources) {
  const candidates = Array.from(new Set(sources.filter(Boolean)));
  if (!candidates.length) return;

  img.dataset.cancelled = "false";
  let index = 0;
  const debugLabel = img.alt || "ukjent region";
  const tryNext = () => {
    if (img.dataset.cancelled === "true") {
      return;
    }
    if (index >= candidates.length) {
      console.warn(
        "[quiz-images] Finner ingen fungerende bilde-URL for",
        debugLabel,
        candidates
      );
      img.remove();
      if (!regionGallery.children.length) {
        regionGallery.style.display = "none";
      }
      return;
    }
    const nextSrc = candidates[index];
    index += 1;
    if (nextSrc) {
      img.src = nextSrc;
    } else {
      tryNext();
    }
  };

  img.addEventListener(
    "load",
    () => {
      if (img.dataset.cancelled === "true") return;
      regionGallery.style.display = "flex";
      console.info("[quiz-images] Lastet bilde for", debugLabel, img.src);
    },
    { once: true }
  );
  img.addEventListener("error", () => {
    if (img.dataset.cancelled === "true") return;
    tryNext();
  });

  tryNext();
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
