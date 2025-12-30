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

---

Das Detailed Charts Panel ist als Custom Element (Web Component) für Home Assistant konzipiert. Es läuft vollständig clientseitig im Browser des Benutzers und kommuniziert direkt mit der Home Assistant API. Es wird kein externer Cloud-Dienst benötigt.

1. Architektur der Dateien (Modularer Aufbau)
Der Code ist in drei logische Module unterteilt, um Wartbarkeit und Übersichtlichkeit zu gewährleisten:
detailed-charts-panel.js (Der Controller): Dies ist die Hauptdatei. Sie definiert das Custom Element (HTMLElement). Hier liegt die Logik für:

Verbindung zu Home Assistant (this._hass).
Event-Handling (Klicks, Toggles, Slider).

State-Management (welche Sensoren sind ausgewählt, welcher Zeitbereich ist aktiv).
API-Aufrufe zum Laden der Daten.
detailed-charts-panel-function.js (Die Worker & View): Diese Datei enthält reine Hilfsfunktionen ("Pure Functions"), die ausgelagert wurden, um den Hauptcode sauber zu halten:
Datenverarbeitung: Algorithmen zur Aggregation (z.B. Umrechnung von Watt-Werten in Tages-kWh, Glättung von Kurven).
HTML-Templates: Generierung des HTML-Codes (Strings) für die Karten, Statistiken und die Sidebar.
Helper: Farbgnerierung, Hex-zu-RGBA Konvertierung etc.

detailed-charts-views.js (Die Konfiguration): Eine reine Datendatei, die ein JSON-Objekt exportiert (sharedViews). Hier werden globale, schreibgeschützte Ansichten definiert, die fest im System hinterlegt sind.

2. Datenverarbeitung & Rendering-Pipeline
Wenn du auf "Daten laden" klickst, passiert folgendes:

Fetch: Die Daten werden asynchron (async/await) parallel für alle Sensoren von Home Assistant abgerufen.

Process (processData):

Die Rohdaten werden bereinigt (Fehlerwerte filtern).
Falls nötig (z.B. bei "Bar"-Charts über lange Zeiträume), werden die Daten auf Tage oder Stunden heruntergerechnet (aggregiert).
Auto-Scale: Werte werden bei Bedarf (z.B. W → kW) dividiert.

Render:

Ein Chart-Objekt wird instanziiert.
Die Datasets (Linien/Balken) werden mit Farben, Fülloptionen und Kurvenglättung (cubicInterpolationMode: 'monotone') konfiguriert.
Das Canvas wird gezeichnet.

3. Zustandspeicherung (Speicherung)
Damit du nach einem Neuladen (F5) nicht von vorne beginnen musst, nutzt das Panel den LocalStorage des Browsers.
Jede Änderung (Sensor hinzugefügt, Farbe geändert, Zoom-Level) wird sofort in ein JSON-Objekt im Browser-Speicher geschrieben (localStorage.setItem).
Beim Start prüft das Panel, ob Einstellungen vorhanden sind, und stellt den letzten Zustand wieder her.