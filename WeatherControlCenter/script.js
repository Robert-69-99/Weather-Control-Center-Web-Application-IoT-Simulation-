// Weather Control Center — simulare senzori IoT (fără backend)

const el = (id) => document.getElementById(id);

// KPI UI
const tempValue = el("tempValue");
const humValue = el("humValue");
const presValue = el("presValue");
const windValue = el("windValue");

// Status UI
const systemTime = el("systemTime");
const systemState = el("systemState");
const alertsContainer = el("alertsContainer");
const weatherLabel = el("weatherLabel");
const locationLabel = el("locationLabel");

// Controls
const locationSelect = el("locationSelect");
const modeSelect = el("modeSelect");
const pauseBtn = el("pauseBtn");
const clearAlertsBtn = el("clearAlertsBtn");

// Diagnostics UI
const diagTemp = el("diagTemp");
const diagHum = el("diagHum");
const diagPres = el("diagPres");
const diagWind = el("diagWind");
const packetInfo = el("packetInfo");
const lastUpdate = el("lastUpdate");

// Map UI
const mapCity = el("mapCity");
const mapCoords = el("mapCoords");
const mapStatus = el("mapStatus");
const mapTemp = el("mapTemp");
const mapHum = el("mapHum");
const mapWind = el("mapWind");
const stationDot = el("stationDot");

// Log UI
const logContainer = el("logContainer");
const clearLogBtn = el("clearLogBtn");

// Chart (Canvas)
const canvas = el("tempChart");
const ctx = canvas.getContext("2d");

// buffer pentru ultimele 60 valori (1/sec)
const MAX_POINTS = 60;
let tempSeries = Array.from({ length: MAX_POINTS }, () => 20);
let packets = 0;

let isPaused = false;
let intervalHandle = null;

// preseturi orașe: coordonate + poziție pe hartă (procente)
const CITY_PRESETS = {
  "Galați":      { coords: "45.435°N, 28.010°E", left: 68, top: 54, base: { temp: 20, hum: 55, pres: 1012, wind: 3.0 } },
  "București":   { coords: "44.426°N, 26.103°E", left: 55, top: 62, base: { temp: 21, hum: 48, pres: 1013, wind: 2.2 } },
  "Cluj-Napoca": { coords: "46.771°N, 23.624°E", left: 34, top: 40, base: { temp: 18, hum: 52, pres: 1014, wind: 2.5 } },
  "Iași":        { coords: "47.158°N, 27.601°E", left: 70, top: 33, base: { temp: 19, hum: 50, pres: 1013, wind: 2.8 } },
  "Timișoara":   { coords: "45.748°N, 21.208°E", left: 20, top: 63, base: { temp: 20, hum: 47, pres: 1014, wind: 2.4 } },
  "Constanța":   { coords: "44.159°N, 28.635°E", left: 80, top: 72, base: { temp: 22, hum: 60, pres: 1011, wind: 4.0 } }
};

// State „meteo” (random walk + bias)
let state = { temp: 20, hum: 45, pres: 1013, wind: 2.5 };

// Alerts + Event Log
let alerts = [];
let eventLog = [];
let lastGlobalState = "ok"; // ok | warn | bad

function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}

function nowString() {
  return new Date().toLocaleString("ro-RO", { hour12: false });
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function computeModeBias(mode) {
  // bias-uri ca să simulezi scenarii plauzibile
  switch (mode) {
    case "storm":
      return { t: rand(-0.2, 0.2), h: rand(0.6, 1.8), p: rand(-1.8, -0.4), w: rand(0.3, 1.2) };
    case "heatwave":
      return { t: rand(0.4, 1.2), h: rand(-0.8, 0.2), p: rand(-0.4, 0.4), w: rand(-0.2, 0.4) };
    case "coldfront":
      return { t: rand(-1.2, -0.3), h: rand(0.2, 0.9), p: rand(0.2, 1.0), w: rand(0.0, 0.7) };
    default:
      return { t: rand(-0.4, 0.4), h: rand(-0.8, 0.8), p: rand(-0.8, 0.8), w: rand(-0.3, 0.3) };
  }
}

function inferWeatherLabel(s) {
  if (s.wind > 12 && s.hum > 70 && s.pres < 995) return "Furtună probabilă";
  if (s.temp > 30 && s.hum < 45) return "Caniculă";
  if (s.temp < 0 && s.wind > 6) return "Viscol / frig accentuat";
  if (s.hum > 80) return "Umezeală ridicată";
  return "Condiții stabile";
}

/* -----------------------------
   Event Log
-------------------------------- */
function pushLog(level, title, meta) {
  const last = eventLog[0];
  if (last && last.title === title && last.level === level && last.meta === meta) return;

  eventLog.unshift({
    level,
    title,
    meta,
    time: nowString()
  });

  if (eventLog.length > 40) eventLog = eventLog.slice(0, 40);
  renderLog();
}

function renderLog() {
  logContainer.innerHTML = "";

  if (eventLog.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Nu există evenimente încă.";
    logContainer.appendChild(p);
    return;
  }

  for (const e of eventLog) {
    const div = document.createElement("div");
    div.className = `log-item ${e.level}`;

    const t = document.createElement("p");
    t.className = "title";
    t.textContent = e.title;

    const m = document.createElement("p");
    m.className = "meta";
    m.textContent = `${e.time} • ${e.meta}`;

    div.appendChild(t);
    div.appendChild(m);
    logContainer.appendChild(div);
  }
}

/* -----------------------------
   Alerts
-------------------------------- */
function pushAlert(level, title, meta) {
  const last = alerts[0];
  if (last && last.title === title && last.level === level) return;

  alerts.unshift({
    level,
    title,
    meta,
    time: nowString()
  });

  if (alerts.length > 12) alerts = alerts.slice(0, 12);

  renderAlerts();

  // log automat pentru alertă
  pushLog(level, `ALERT: ${title}`, meta);
}

function evaluateAlerts(s) {
  // praguri
  if (s.temp >= 35) pushAlert("bad", "Temperatură critică", `T=${s.temp.toFixed(1)}°C • risc supraîncălzire echipamente`);
  else if (s.temp >= 30) pushAlert("warn", "Temperatură ridicată", `T=${s.temp.toFixed(1)}°C • recomandare ventilație`);

  if (s.temp <= -5) pushAlert("warn", "Temperatură scăzută", `T=${s.temp.toFixed(1)}°C • risc îngheț`);

  if (s.hum >= 85) pushAlert("warn", "Umiditate foarte mare", `H=${Math.round(s.hum)}% • posibil condens`);
  if (s.hum <= 20) pushAlert("warn", "Umiditate foarte mică", `H=${Math.round(s.hum)}% • disconfort / electricitate statică`);

  if (s.pres <= 980) pushAlert("warn", "Presiune joasă", `P=${Math.round(s.pres)} hPa • instabilitate atmosferică`);
  if (s.wind >= 15) pushAlert("bad", "Vânt puternic", `V=${s.wind.toFixed(1)} m/s • risc rafale`);
  else if (s.wind >= 10) pushAlert("warn", "Vânt moderat", `V=${s.wind.toFixed(1)} m/s`);
}

function renderAlerts() {
  alertsContainer.innerHTML = "";

  if (alerts.length === 0) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = "Nu există alerte.";
    alertsContainer.appendChild(p);
    return;
  }

  for (const a of alerts) {
    const div = document.createElement("div");
    div.className = `alert ${a.level}`;

    const t = document.createElement("p");
    t.className = "title";
    t.textContent = a.title;

    const m = document.createElement("p");
    m.className = "meta";
    m.textContent = `${a.time} • ${a.meta}`;

    div.appendChild(t);
    div.appendChild(m);
    alertsContainer.appendChild(div);
  }
}

/* -----------------------------
   Diagnostics + Global State
-------------------------------- */
function randomDiagState(faultChance, warnChance) {
  const r = Math.random();
  if (r < faultChance) return "bad";
  if (r < faultChance + warnChance) return "warn";
  return "ok";
}

function setDiagBadge(node, level) {
  node.dataset.level = level;
  node.className = `diag-badge ${level}`;
  node.textContent = level.toUpperCase();
}

function computeGlobalLevel() {
  const hasBad = alerts.some(a => a.level === "bad");
  const hasWarn = alerts.some(a => a.level === "warn");

  const anySensorBad = [diagTemp, diagHum, diagPres, diagWind].some(x => x.dataset.level === "bad");
  const anySensorWarn = [diagTemp, diagHum, diagPres, diagWind].some(x => x.dataset.level === "warn");

  if (hasBad || anySensorBad) return "bad";
  if (hasWarn || anySensorWarn) return "warn";
  return "ok";
}

function updateSystemState() {
  // simulăm diagnoză senzori
  const faultChance = 0.06;
  const warnChance = 0.10;
  setDiagBadge(diagTemp, randomDiagState(faultChance, warnChance));
  setDiagBadge(diagHum,  randomDiagState(faultChance, warnChance));
  setDiagBadge(diagPres, randomDiagState(faultChance, warnChance));
  setDiagBadge(diagWind, randomDiagState(faultChance, warnChance));

  const level = computeGlobalLevel();

  if (level === "bad") {
    systemState.textContent = "CRITICAL • intervenție necesară";
    systemState.className = "state bad";
  } else if (level === "warn") {
    systemState.textContent = "WARNING • parametri în afara optimului";
    systemState.className = "state warn";
  } else {
    systemState.textContent = "OK • senzori activi";
    systemState.className = "state ok";
  }

  // loghează doar când se schimbă statusul global
  if (level !== lastGlobalState) {
    const title =
      level === "bad" ? "SYSTEM STATE: CRITICAL" :
      level === "warn" ? "SYSTEM STATE: WARNING" :
      "SYSTEM STATE: OK";

    pushLog(level, title, "Schimbare de stare globală în funcție de praguri și diagnoză senzori");
    lastGlobalState = level;
  }
}

/* -----------------------------
   Map panel
-------------------------------- */
function updateMapPanel() {
  const city = locationSelect.value;
  const preset = CITY_PRESETS[city] || CITY_PRESETS["Galați"];

  mapCity.textContent = city;
  mapCoords.textContent = preset.coords;

  mapTemp.textContent = state.temp.toFixed(1);
  mapHum.textContent = Math.round(state.hum).toString();
  mapWind.textContent = state.wind.toFixed(1);

  const level = systemState.classList.contains("bad")
    ? "bad"
    : systemState.classList.contains("warn")
      ? "warn"
      : "ok";

  const text = level === "bad" ? "CRITICAL" : level === "warn" ? "WARNING" : "OK";
  mapStatus.textContent = `Status: ${text}`;

  // culoare punct
  if (level === "bad") stationDot.style.background = "rgba(255,107,107,0.9)";
  else if (level === "warn") stationDot.style.background = "rgba(255,204,102,0.9)";
  else stationDot.style.background = "rgba(46,229,157,0.9)";

  // poziție punct
  stationDot.style.left = `${preset.left}%`;
  stationDot.style.top = `${preset.top}%`;
}

function applyCityPreset(city) {
  const preset = CITY_PRESETS[city] || CITY_PRESETS["Galați"];
  // setează un punct de plecare plauzibil ca să „simți” că e alt oraș
  state.temp = preset.base.temp + rand(-1.0, 1.0);
  state.hum  = preset.base.hum  + rand(-5.0, 5.0);
  state.pres = preset.base.pres + rand(-3.0, 3.0);
  state.wind = clamp(preset.base.wind + rand(-1.0, 1.0), 0, 30);

  pushLog("ok", "LOCATION CHANGED", `Locație selectată: ${city}`);
}

/* -----------------------------
   Chart (Canvas)
-------------------------------- */
function drawTempChart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const pad = 28;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;

  let minT = Math.min(...tempSeries);
  let maxT = Math.max(...tempSeries);

  if (Math.abs(maxT - minT) < 2) {
    maxT += 1;
    minT -= 1;
  }

  // axe
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad + h);
  ctx.lineTo(pad + w, pad + h);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + h);
  ctx.stroke();

  // grid
  ctx.globalAlpha = 0.35;
  for (let i = 1; i <= 4; i++) {
    const y = pad + (h * i) / 5;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + w, y);
    ctx.stroke();
  }

  // plot
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = "rgba(255,255,255,0.90)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  tempSeries.forEach((t, i) => {
    const x = pad + (w * i) / (MAX_POINTS - 1);
    const y = pad + (1 - (t - minT) / (maxT - minT)) * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // labels min/max
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "12px ui-sans-serif, system-ui";
  ctx.fillText(`${maxT.toFixed(1)}°C`, pad + 6, pad + 14);
  ctx.fillText(`${minT.toFixed(1)}°C`, pad + 6, pad + h + 18);
}

/* -----------------------------
   Main loop
-------------------------------- */
function updateSensors() {
  const mode = modeSelect.value;
  const b = computeModeBias(mode);

  state.temp = clamp(state.temp + b.t + rand(-0.25, 0.25), -15, 45);
  state.hum  = clamp(state.hum  + b.h + rand(-1.5, 1.5), 0, 100);
  state.pres = clamp(state.pres + b.p + rand(-0.9, 0.9), 940, 1055);
  state.wind = clamp(state.wind + b.w + rand(-0.4, 0.4), 0, 30);

  // KPI
  tempValue.textContent = state.temp.toFixed(1);
  humValue.textContent = Math.round(state.hum).toString();
  presValue.textContent = Math.round(state.pres).toString();
  windValue.textContent = state.wind.toFixed(1);

  // labels top
  locationLabel.textContent = locationSelect.value;
  weatherLabel.textContent = inferWeatherLabel(state);

  // chart series
  tempSeries.push(state.temp);
  if (tempSeries.length > MAX_POINTS) tempSeries.shift();
  drawTempChart();

  // packets
  packets += 1;
  packetInfo.textContent = `Pachete primite: ${packets}`;
  lastUpdate.textContent = `Ultima actualizare: ${nowString()}`;

  // alerts + status
  evaluateAlerts(state);
  updateSystemState();

  // time
  systemTime.textContent = `Timp sistem: ${nowString()}`;

  // map
  updateMapPanel();
}

function start() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(() => {
    if (!isPaused) updateSensors();
  }, 1000);
}

/* -----------------------------
   UI events
-------------------------------- */
pauseBtn.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? "Reia" : "Pauză";
  pushLog("ok", "SYSTEM", isPaused ? "Actualizări puse pe pauză" : "Actualizări reluate");
});

clearAlertsBtn.addEventListener("click", () => {
  alerts = [];
  renderAlerts();
  pushLog("ok", "ALERTS", "Alertele au fost șterse manual");
  // recompute status după ștergere
  updateSystemState();
  updateMapPanel();
});

clearLogBtn.addEventListener("click", () => {
  eventLog = [];
  renderLog();
  // note: nu logăm acest eveniment, pentru că tocmai am șters log-ul
});

locationSelect.addEventListener("change", () => {
  applyCityPreset(locationSelect.value);
  // update instant UI
  locationLabel.textContent = locationSelect.value;
  updateMapPanel();
});

modeSelect.addEventListener("change", () => {
  const mode = modeSelect.value;

  // “împinge” starea spre un scenariu mai clar
  if (mode === "storm") {
    state.hum = clamp(state.hum + 20, 0, 100);
    state.pres = clamp(state.pres - 18, 940, 1055);
    state.wind = clamp(state.wind + 5, 0, 30);
  } else if (mode === "heatwave") {
    state.temp = clamp(state.temp + 6, -15, 45);
    state.hum = clamp(state.hum - 10, 0, 100);
  } else if (mode === "coldfront") {
    state.temp = clamp(state.temp - 8, -15, 45);
    state.wind = clamp(state.wind + 2, 0, 30);
  }

  pushLog("ok", "MODE CHANGED", `Mod selectat: ${mode}`);
});

/* -----------------------------
   Init
-------------------------------- */
(function init() {
  systemTime.textContent = `Timp sistem: ${nowString()}`;

  // inițializează locația implicită (Galați e selectat)
  applyCityPreset(locationSelect.value);

  renderAlerts();
  renderLog();
  drawTempChart();

  // update imediat
  updateSensors();

  // start loop
  start();
})();
