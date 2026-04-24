# 🌦️ Weather Control Center

O aplicație web de tip dashboard pentru monitorizarea și simularea datelor de la senzori IoT virtuali — stație meteo simulată, fără backend.

---

## 📸 Demo

> Deschide `index.html` direct în browser — nu necesită server.

---

## ✨ Funcționalități

- **Monitorizare în timp real** a 4 senzori virtuali: temperatură, umiditate, presiune atmosferică și viteză vânt
- **Simulare scenarii meteo**: Normal, Storm, Heatwave, Cold Front
- **Sistem de alerte** bazat pe praguri configurabile (ex: T > 35°C → alertă critică)
- **Grafic temperatură** în timp real — ultimele 60 de secunde, generat cu Canvas API (fără librării externe)
- **Hartă stație** cu localizarea punctului meteo și indicatori de status (OK / WARNING / CRITICAL)
- **Event Log** cu istoricul schimbărilor de stare și alertelor (max 40 înregistrări)
- **Diagnoză senzori** cu simulare aleatorie de defecte/avertizări
- **6 locații presetate**: Galați, București, Cluj-Napoca, Iași, Timișoara, Constanța
- **Buton Pauză** pentru oprirea actualizărilor
- Design **responsive** (desktop + mobil)

---

## 🚀 Cum rulezi proiectul

```bash
git clone https://github.com/<username>/weather-control-center.git
cd weather-control-center
```

Deschide `index.html` în browser. Nu necesită instalare, server sau dependențe externe.

---

## 🗂️ Structura proiectului

```
weather-control-center/
├── index.html      # Structura HTML a dashboard-ului
├── style.css       # Stilizare (dark theme, grid layout, responsive)
└── script.js       # Logica simulare senzori, alerte, grafic, event log
```

---

## 🛠️ Tehnologii utilizate

| Tehnologie | Rol |
|---|---|
| HTML5 | Structura paginii |
| CSS3 (Grid, Custom Properties) | Layout și design dark theme |
| JavaScript (Vanilla) | Simulare senzori, logică alerte, Canvas API |
| Canvas API | Grafic temperatură (fără librării externe) |

---

## ⚙️ Logica de simulare

Senzorii sunt actualizați **la fiecare secundă** folosind un algoritm de tip **random walk** cu bias în funcție de modul selectat:

| Mod | Comportament |
|---|---|
| Normal | Fluctuații mici și aleatoare |
| Storm | Umiditate ↑, presiune ↓, vânt ↑ |
| Heatwave | Temperatură ↑, umiditate ↓ |
| Cold Front | Temperatură ↓, vânt ↑ |

### Praguri de alertă

| Senzor | Avertizare (WARN) | Critică (BAD) |
|---|---|---|
| Temperatură | ≥ 30°C sau ≤ -5°C | ≥ 35°C |
| Umiditate | ≥ 85% sau ≤ 20% | — |
| Presiune | ≤ 980 hPa | — |
| Vânt | ≥ 10 m/s | ≥ 15 m/s |

---

## 📌 Note

- Aplicația nu consumă date reale — totul este simulat client-side
- Nu are dependențe externe (fără npm, fără framework-uri, fără CDN)
- Proiect realizat în cadrul cursului TWEB — Universitatea „Dunărea de Jos" Galați
