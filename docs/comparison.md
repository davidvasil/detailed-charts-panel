# Warum Detailed Charts?

Deine Daten, endlich verständlich!

Das Detailed Charts Panel ist weit mehr als nur eine einfache Verlaufskarte. Während die standardmäßige Home Assistant Historie gut ist, um mal eben zu schauen, ob das Licht an war, stößt sie bei der Analyse von Energie, Klima oder komplexen Sensor-Zusammenhängen schnell an ihre Grenzen.

Dieses Projekt schließt hoffentlich die Lücke zwischen einfacher Anzeige und professioneller Datenanalyse – direkt in deinem Dashboard.

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

---

### 5. Panel Mode vs. Card Mode – Ein mächtiger Workflow

Das Projekt ist dual konzipiert. Es dient sowohl als Explorer (Panel) oder auch als Anzeige (Dashboard-Card).  

#### A. Der Panel Mode (Der "Editor")  
Hier passiert die Magie. Wenn du das Panel als Sidebar-Element (View) einbindest, erhältst du eine Vollbild-Anwendung.  

* Suchen & Finden: Durchsuche blitzschnell deine Sensoren.  
* Drag & Drop: Ordne Charts im Split-View einfach per Maus neu an.  
* Konfiguration: Stelle Zeiträume (relativ oder fester Kalender), Farben und Chart-Typen per UI ein.  

#### B. Der YAML Export (Für den Card Mode)  
Du hast im Panel Mode die perfekte Ansicht für deine Solaranlage zusammengeklickt? Du willst genau diese Ansicht auf deinem Dashboard auf dem Tablet haben?  

* Klicke auf den YAML-Button (📋).  
* Kopiere den generierten Code.  
* Füge ihn in eine beliebige Standard-Lovelace-Karte ein.
  
*Ergebnis:* Eine fest definierte Karte, genau so konfiguriert, wie du sie erstellt hast.
