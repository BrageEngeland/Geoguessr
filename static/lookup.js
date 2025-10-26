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

const countryGrid = document.getElementById("lookup-country-grid");
const datasetPickerEl = document.getElementById("dataset-picker");
const datasetSelectEl = document.getElementById("lookup-dataset-select");
const form = document.getElementById("lookup-form");
const codeInput = document.getElementById("lookup-code");
const statusEl = document.getElementById("lookup-status");
const resultCard = document.getElementById("result");
const resultTitle = document.getElementById("result-title");
const resultRegions = document.getElementById("result-regions");
const resultCities = document.getElementById("result-cities");
const resultNotes = document.getElementById("result-notes");
const resultDifficulty = document.getElementById("result-difficulty");
const resultImages = document.getElementById("result-images");

const state = {
  countries: [],
  countryGroups: [],
  selectedGroupKey: "Russia",
  datasetSelections: {},
  selectedDataset: "Russia",
  shutdownArmed: false,
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

async function init() {
  setupDatasetPicker();
  await loadCountries();
  setupAutoShutdown();
}

async function loadCountries() {
  try {
    const res = await fetch("/api/countries");
    if (!res.ok) throw new Error("Kunne ikke hente land");
    state.countries = await res.json();
    state.countryGroups = buildCountryGroups(state.countries);

    if (!state.countryGroups.length) {
      statusEl.textContent = "Fant ingen land.";
      return;
    }

    if (!state.countryGroups.some((group) => group.key === state.selectedGroupKey)) {
      state.selectedGroupKey = state.countryGroups[0].key;
    }

    ensureDatasetSelection();
    renderCountryGrid();
    renderDatasetOptions();
    updatePlaceholder();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "Klarte ikke å laste land fra API-et.";
  }
}

function renderCountryGrid() {
  countryGrid.innerHTML = "";
  state.countryGroups.forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "country-tile";
    if (group.key === state.selectedGroupKey) {
      button.classList.add("country-tile--active");
    }
    button.innerHTML = `
      <span class="country-tile__flag">${flagForGroup(group)}</span>
      <span class="country-tile__name">${group.label}</span>
    `;
    button.addEventListener("click", () => {
      if (group.key !== state.selectedGroupKey) {
        selectGroup(group.key);
      }
    });
    countryGrid.appendChild(button);
  });
}

function selectGroup(groupKey) {
  state.selectedGroupKey = groupKey;
  ensureDatasetSelection();
  renderCountryGrid();
  renderDatasetOptions();
  updatePlaceholder();
  resultCard.classList.add("hidden");
  clearResultImages();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultCard.classList.add("hidden");
  clearResultImages();
  if (!state.selectedDataset) {
    statusEl.textContent = "Velg et land først.";
    return;
  }
  statusEl.textContent = "Slår opp …";
  const payload = {
    country: state.selectedDataset,
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
  renderResultImages(data.images, data.regions);
  resultCard.classList.remove("hidden");
}

function updatePlaceholder() {
  const meta = getSelectedDatasetMeta();
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

function setupDatasetPicker() {
  if (!datasetSelectEl) return;
  datasetSelectEl.addEventListener("change", () => {
    const nextValue = datasetSelectEl.value;
    if (nextValue && nextValue !== state.selectedDataset) {
      changeDataset(nextValue);
    }
  });
}

function renderDatasetOptions() {
  if (!datasetPickerEl || !datasetSelectEl) return;
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

  datasetSelectEl.value = state.selectedDataset || group.datasets[0]?.filename || "";
  datasetSelectEl.disabled = group.datasets.length <= 1;
  datasetPickerEl.hidden = group.datasets.length <= 1;
}

function ensureDatasetSelection() {
  const group = getCurrentGroup();
  if (!group) {
    state.selectedDataset = "";
    return;
  }
  const preferred = state.datasetSelections[group.key];
  const match = group.datasets.find((dataset) => dataset.filename === preferred);
  const fallback = match || group.defaultDataset || group.datasets[0];
  state.selectedDataset = fallback ? fallback.filename : "";
  if (fallback) {
    state.datasetSelections[group.key] = fallback.filename;
  }
}

function changeDataset(datasetFilename) {
  state.selectedDataset = datasetFilename;
  const group = getCurrentGroup();
  if (group) {
    state.datasetSelections[group.key] = datasetFilename;
  }
  renderDatasetOptions();
  updatePlaceholder();
  resultCard.classList.add("hidden");
  clearResultImages();
}

function getCurrentGroup() {
  return state.countryGroups.find((group) => group.key === state.selectedGroupKey) || null;
}

function getSelectedDatasetMeta() {
  const group = getCurrentGroup();
  if (!group) return null;
  return group.datasets.find((dataset) => dataset.filename === state.selectedDataset) || null;
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
    return group;
  });
}

function flagForGroup(group) {
  const label = group?.label || "";
  return renderFlag(label, group?.key);
}

function renderResultImages(images = [], regions = []) {
  if (!resultImages) return;
  clearResultImages();

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
    img.className = "result-images__img";
    img.alt = regions[index] || regions[0] || "Region";
    appendImageWithFallback(img, sources);
    fragment.appendChild(img);
  });

  resultImages.appendChild(fragment);
  if (resultImages.children.length) {
    resultImages.style.display = "flex";
  }
}

function clearResultImages() {
  if (!resultImages) return;
  resultImages.querySelectorAll("img").forEach((img) => {
    img.dataset.cancelled = "true";
  });
  resultImages.innerHTML = "";
  resultImages.style.display = "none";
}

function gatherImageCandidates(images, regions) {
  const explicit = (images || [])
    .map((name) => name && name.trim())
    .filter(Boolean);
  if (explicit.length) {
    return Array.from(new Set(explicit));
  }
  return Array.from(
    new Set(
      (regions || [])
        .map(regionNameToImage)
        .filter(Boolean)
    )
  );
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
  const datasetFolder = state.selectedDataset;
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
        "[lookup-images] Finner ingen fungerende bilde-URL for",
        debugLabel,
        candidates
      );
      img.remove();
      if (resultImages && !resultImages.children.length) {
        resultImages.style.display = "none";
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
      if (resultImages) {
        resultImages.style.display = "flex";
      }
      console.info("[lookup-images] Lastet bilde for", debugLabel, img.src);
    },
    { once: true }
  );
  img.addEventListener("error", () => {
    if (img.dataset.cancelled === "true") return;
    tryNext();
  });

  tryNext();
}
