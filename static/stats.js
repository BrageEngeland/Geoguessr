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

function loadStats() {
  try {
    const raw = localStorage.getItem("quizStats");
    if (!raw) {
      return { global: { asked: 0, correct: 0, bestStreak: 0 } };
    }
    return JSON.parse(raw);
  } catch (e) {
    return { global: { asked: 0, correct: 0, bestStreak: 0 } };
  }
}

function getFlagPath(label) {
  const normalized = label?.replace(/\s*\(.*\)$/, "");
  return FLAG_PATHS[label] || FLAG_PATHS[normalized] || null;
}

function flagHTML(label) {
  const path = getFlagPath(label);
  if (!path) {
    return "🌍";
  }
  return `<img src="${path}" alt="" loading="lazy" decoding="async" />`;
}

function pct(correct, asked) {
  if (!asked || asked === 0) return "0%";
  const val = (correct / asked) * 100;
  return Math.round(val) + "%";
}

function renderGlobal(stats) {
  const g = stats.global || { asked: 0, correct: 0, bestStreak: 0 };

  document.getElementById("stat-global-accuracy").textContent =
    pct(g.correct || 0, g.asked || 0);

  document.getElementById("stat-global-score").textContent =
    `${g.correct || 0} / ${g.asked || 0}`;

  document.getElementById("stat-global-streak").textContent =
    g.bestStreak || 0;
}

function renderCountries(stats) {
  const listEl = document.getElementById("stat-country-list");
  listEl.innerHTML = "";

  Object.keys(stats)
    .filter((key) => key !== "global")
    .sort((a, b) => (stats[b].asked || 0) - (stats[a].asked || 0))
    .forEach((countryName) => {
      const data = stats[countryName];
      const asked = data.asked || 0;
      const correct = data.correct || 0;
      const bestStreak = data.bestStreak || 0;
      const flag = flagHTML(countryName);

      const item = document.createElement("div");
      item.className = "country-stats-item";

      item.innerHTML = `
        <div class="country-left">
          <div class="country-name">
            <span class="country-flag">${flag}</span>
            <span>${countryName}</span>
          </div>
          <div class="country-accuracy">
            Treffsikkerhet:
            <strong>${pct(correct, asked)}</strong>
          </div>
        </div>

        <div class="country-right">
          <div><strong>${correct} / ${asked}</strong> riktige</div>
          <div>Beste streak: <strong>${bestStreak}</strong></div>
        </div>
      `;

      listEl.appendChild(item);
    });
}

(function init() {
  const stats = loadStats();
  renderGlobal(stats);
  renderCountries(stats);
})();
