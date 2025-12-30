# Technische Funktionsweise & Architektur

Das **Detailed Charts Panel** ist als **Custom Element** (Web Component) für Home Assistant konzipiert. Es läuft vollständig clientseitig im Browser und benötigt keine Cloud.

## Dateistruktur

Der Code ist modular aufgebaut:

* **`detailed-charts-panel.js` (Der Controller):** Die Hauptdatei mit der Logik für Verbindung zu HA, Event-Handling und State-Management.
* **`detailed-charts-panel-function.js` (Worker & View):** Enthält Hilfsfunktionen für Datenverarbeitung (Aggregation), HTML-Template-Generierung und mathematische Berechnungen.
* **`detailed-charts-views.js` (Konfiguration):** Eine JSON-basierte Datei für globale, schreibgeschützte Ansichten.

## Datenabruf (Smart Data Fetching)

Das Panel nutzt eine **hybride Strategie** für maximale Performance:

1.  **Kurzzeit-Analyse (< 48 Stunden):** Nutzung der **History API**. Es werden exakte Rohdaten geladen. Vorteil: Hohe Präzision.
2.  **Langzeit-Analyse (> 48 Stunden):** Automatische Umschaltung auf die **Long-Term Statistics API** via WebSocket. Es werden statistische Werte (Min/Max/Mean) geladen. Vorteil: Extrem schnell, auch bei Jahresansichten.

## Bibliotheken

Das Projekt nutzt bewährte Open-Source-Bibliotheken:
* **Chart.js:** Für performantes Rendering auf HTML5 Canvas.
* **Chart.js Plugin Zoom:** Für Zoom & Pan per Maus/Touch.
* **Hammer.js:** Für die Erkennung von Touch-Gesten auf mobilen Geräten.