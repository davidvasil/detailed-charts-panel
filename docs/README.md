[![HACS validation](https://img.shields.io/github/actions/workflow/status/jayjojayson/detailed-charts-panel/validate.yml?label=HACS%20Validation)](https://github.com/jayjojayson/detailed-charts-panel/actions?query=workflow%3Avalidate)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/v/release/jayjojayson/detailed-charts-panel?include_prereleases&sort=semver&color=blue&style=flat-square)](https://github.com/jayjojayson/detailed-charts-panel/releases/)
![Panel Size](https://img.shields.io/github/size/jayjojayson/detailed-charts-panel/dist/detailed-charts-panel.js?label=Panel%20Size)
![last commit](https://img.shields.io/github/last-commit/jayjojayson/detailed-charts-panel)
[![README English](https://img.shields.io/badge/README-Eng-orange)](https://github.com/jayjojayson/detailed-charts-panel/blob/main/docs/README-eng.md)
[![stars](https://img.shields.io/github/stars/jayjojayson/detailed-charts-panel)](https://github.com/jayjojayson/detailed-charts-panel/stargazers)

# Detailed Charts Panel
**Interaktive High-Performance Charts für Home Assistant – Deine Daten, endlich verständlich.**

Das 📉 **Detailed Charts Panel** ist eine leistungsstarke Visualisierungslösung für Home Assistant, um historische Daten deiner Sensoren tiefgehend zu analysieren. Es bietet Funktionen, die weit über die Standard-History hinausgehen.

Das Panel läuft vollständig lokal im Browser und nutzt die Websocket API von Home Assistant für maximale Performance.

## Features im Überblick

- **📉 Interaktive Charts:** Stufenloser Zoom & Pan (Touch & Mausrad) mit automatischem Nachladen der Daten (Infinite Scrolling).
- **⚡ Auto-Scale (W ➡ kW):** Rechnet Werte von `W`/`Wh` automatisch in `kW`/`kWh` um – kein Kopfrechnen mehr!
- **🍩 Donut Sidebar:** Optionale Seitenleiste für die prozentuale Verteilung (ideal für Stromverbrauch).
- **📊 Flexible Layouts:**
    - *Combined:* Alles in einem Chart.
    - *Grid:* 1 bis 4 Spalten nebeneinander.
    - *Mixed:* Übersicht oben, Details unten.
- **🔴 Thresholds:** Setze Warnlinien (z.B. bei 600W) als visuelle Referenz.
- **💾 Duales Speichern:** Speichere Ansichten lokal im Browser oder global in einer Datei.
- **📈 Live-Statistiken:** Min / Max / Durchschnitt / Summe / Aktuell – intelligent berechnet.
- **🏗️ Drag & Drop:** Ordne Charts im Grid-Modus einfach per Maus neu an.
- **🌑 Modern UI:** Voller Support für Home Assistant Themes (Light & Dark Mode).

Panel-View:

<img src="images/example3.png" alt="Panel View" width="50%">

Card on Dashboard:

<img src="images/example5-card.png" alt="Dashboard Card" width="50%">