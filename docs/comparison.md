# Warum Detailed Charts?

Während die standardmäßige Home Assistant Historie gut ist, um mal eben zu schauen, ob das Licht an war, stößt sie bei der Analyse von Energie, Klima oder komplexen Sensor-Zusammenhängen schnell an ihre Grenzen.

Hier sind die Gründe, warum dieses Panel für Analysen besser geeignet ist:

### 1. Totale Kontrolle über die Darstellung
* **Standard HA:** Linienfarben sind oft zufällig oder fest vorgegeben. Typen (Balken/Linie) sind schwer mischbar.
* **Detailed Charts:** Du entscheidest! Mische Balkendiagramme (für Energie) mit Linienverläufen (für SoC/Spannung) in einem Chart. Wähle Farben, fülle Flächen, stapele Balken (Stacked Bars) oder nutze Scatter-Plots für Rohdatenpunkte.

### 2. Live-Interaktivität & "Labor-Modus"
Du musst nicht jedes Mal YAML-Code ändern, um eine Ansicht zu testen.
* Klicke Sensoren zusammen.
* Zoome stufenlos in Zeitbereiche.
* Ändere die Skalierung (z.B. Watt zu Kilowatt) per Knopfdruck.
* Analysiere die Daten *live*.

### 3. Intelligente Datenaufbereitung
Das Panel rechnet für dich:
* Automatische Berechnung von **Energiesummen (kWh)** für den gewählten Zeitraum.
* Min/Max/Durchschnittswerte auf einen Blick.
* **Auto-Scale:** Schaltet Werte intelligent um, damit Diagramme lesbar bleiben.

### 4. Flexible Layouts
Vom klassischen **Kombiniert-Modus** (alles in einem) über den **Grid-Modus** (Getrennt) bis hin zum **Mixed-Modus** (Übersicht oben, Details unten). Dazu gibt es optional eine Donut-Sidebar für die prozentuale Verteilung.