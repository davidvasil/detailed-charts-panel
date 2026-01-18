# Technische Funktionsweise & Architektur

Das **Detailed Charts Panel** ist als **Custom Element** (Web Component) für Home Assistant konzipiert. Es läuft vollständig clientseitig im Browser, benötigt keine Cloud und läuft daher rein lokal in deiner HA Instanz.

## Dateistruktur

Der Code ist modular aufgebaut:

* **`detailed-charts-panel.js` (Der Controller):** Dies ist die Startdatei und das Gesicht des Panels
* **`detailed-charts-panel-logic.js` (Das Gehirn / Die Engine) Hier findet die "Arbeit" statt, die nicht mit Klicks zu tun hat
* **`detailed-charts-panel-function.js` (Die Werkzeugkiste & Templates):** Enthält Hilfsfunktionen für Datenverarbeitung (Aggregation)
* **`detailed-charts-panel-editor.js` (Card-Editor):** Verantwortlich für das Layout und die Erstellung der Card auf dem Dashbaord
* **`detailed-charts-views.js` (Konfiguration):** Eine JSON-basierte Datei für globale, schreibgeschützte Ansichten

## Datenabruf (Smart Data Fetching)

Das Panel nutzt eine **hybride Strategie** für maximale Performance:

1.  **Kurzzeit-Analyse (< 48 Stunden):** Nutzung der **History API**. Es werden exakte Rohdaten geladen. Vorteil: Hohe Präzision.
2.  **Langzeit-Analyse (> 48 Stunden):** Automatische Umschaltung auf die **Long-Term Statistics API** via WebSocket. Es werden statistische Werte (Min/Max/Mean) geladen. Vorteil: Extrem schnell, auch bei Jahresansichten.

## Bibliotheken

Das Projekt nutzt bewährte Open-Source-Bibliotheken für die generierten Charts:
* **Chart.js:** Für performantes Rendering auf HTML5 Canvas.
* **Chart.js Plugin Zoom:** Für Zoom & Pan per Maus/Touch.
* **Hammer.js:** Für die Erkennung von Touch-Gesten auf mobilen Geräten.

---

## Architektur Details
Der Code ist in fünf logische Module unterteilt, um Wartbarkeit und Übersichtlichkeit zu gewährleisten:

#### `detailed-charts-panel.js` (Der Controller)
Dies ist die Startdatei und das Gesicht des Panels. Sie fungiert als "Verbinder" zwischen der Logik und der Benutzeroberfläche:

* Registrierung: Meldet das Custom Element (detailed-charts-panel) bei Home Assistant an
* UI-Initialisierung: Baut das Grundgerüst des Panels auf und setzt die Event-Listener für alle Schaltflächen und Schieberegler
* Hass-Anbindung: Reicht die Home Assistant Zustände (hass) an die Logik und an eingebettete Custom Cards weiter
* Schnittstelle zum Editor: Verknüpft das Panel mit der Editor-Datei für die Konfiguration

#### `detailed-charts-panel-logic.js` (Das Gehirn / Die Engine)
Diese Datei enthält die Basisklasse DetailedChartsLogic. Hier findet die eigentliche "Arbeit" statt, die nicht direkt mit Klicks zu tun hat:

* Datenbeschaffung: Beinhaltet die komplexen Funktionen zum Abrufen von Verlaufsdaten (fetchDataSmart) und Statistiken aus der Home Assistant Datenbank
* Chart-Management: Steuert das Erstellen, Aktualisieren und Zerstören der Chart.js-Instanzen
* Zustandsverwaltung: Verwaltet den internen Cache der Sensordaten und berechnet Zeitfenster
* Abhängigkeiten: Lädt externe Bibliotheken wie Chart.js oder Hammer.js dynamisch nach

#### `detailed-charts-panel-function.js` (Die Werkzeugkiste & Templates)
Diese Datei enthält reine Hilfsfunktionen ("Pure Functions"), die ausgelagert wurden, um den Hauptcode sauber zu halten:

* Daten-Prozessoren: Algorithmen, die rohe HA-Daten in ein Format umwandeln, das Chart.js versteht (z.B. Aggregation auf Stunden/Tage)
* HTML-Templates: Hier liegen die Entwürfe für Statistikkarten, die Sidebar und die verschiedenen Layout-Modi (Split/Combined)
* Helper: Kleine Helfer für Farben (Hex-zu-RGBA), Namensbereinigung und mathematische Berechnungen

#### `detailed-charts-panel-editor.js` (Der Card-Editors)
Diese Datei ist verantwortlich für das Layout und die Erstellung der Card auf dem Dashbaord:

* Verbindung: zur detailed-charts-panel.js, detailed-charts-panel-logic.js & detailed-charts-panel-function.js
* Visueller Editor: Erstellt die Benutzeroberfläche mit Dropdowns und Schaltern, um die Karte ohne YAML-Kenntnisse zu konfigurieren
* Live-Vorschau: Überträgt Änderungen sofort an das Hauptpanel, damit du siehst, wie sich die Chart verändert

#### `detailed-charts-views.js` (Die Konfiguration):
Eine reine Datendatei, die ein JSON-Objekt exportiert (sharedViews):

* Schreibschutz: Alle hier definierten Ansichten erscheinen im Panel mit einem Schloss-Symbol
* Sie sind global verfügbar und können nicht versehentlich über die Weboberfläche gelöscht werden

#### Datenverarbeitung & Rendering-Pipeline
Wenn du auf "Daten laden" klickst, passiert folgendes:

* Fetch: Die Daten werden asynchron (async/await) parallel für alle Sensoren von Home Assistant abgerufen.
* Process (processData): Die Rohdaten werden bereinigt (Fehlerwerte filtern).
* Falls nötig (z.B. bei "Bar"-Charts über lange Zeiträume), werden die Daten auf Tage oder Stunden heruntergerechnet (aggregiert).
* Auto-Scale: Werte werden bei Bedarf (z.B. W → kW) dividiert.
* Render: Ein Chart-Objekt wird instanziiert.
* Die Datasets (Linien/Balken) werden mit Farben, Fülloptionen und Kurvenglättung (cubicInterpolationMode: 'monotone') konfiguriert.
* Das Canvas wird gezeichnet.

#### Zustandspeicherung (Speicherung)
Damit du nach einem Neuladen (F5) nicht von vorne beginnen musst, nutzt das Panel den LocalStorage des Browsers.
Jede Änderung (Sensor hinzugefügt, Farbe geändert, View-Mode, usw.) wird sofort in ein JSON-Objekt im Browser-Speicher geschrieben (localStorage.setItem).
Beim Start prüft das Panel, ob Einstellungen vorhanden sind und stellt den letzten Zustand wieder her. Über die `detailed-charts-views.js` können zudem auch Ansichten zwischen Geräte ausgetauscht werden.
