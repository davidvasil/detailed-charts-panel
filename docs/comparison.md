# Warum Detailed Charts?

Deine Daten, endlich verständlich!

Das Detailed Charts Panel ist weit mehr als nur eine einfache Verlaufskarte. Während die standardmäßige Home Assistant Historie gut ist, um mal eben zu schauen, ob das Licht an war, stößt sie bei der Analyse von Energie, Klima oder komplexen Sensor-Zusammenhängen schnell an ihre Grenzen.

Dieses Projekt schließt hoffentlich die Lücke zwischen einfacher Anzeige und professioneller Datenanalyse – direkt in deinem Dashboard.

Hier sind die Gründe, warum dieses Panel für Analysen besser geeignet ist:

### 1. Totale Kontrolle über die Darstellung
* **Standard HA:** Linienfarben sind oft zufällig oder fest vorgegeben. Typen wie Balken Chart können nicht ausgewählt werden.
* **Detailed Charts:** Du entscheidest! Mische Balkendiagramme (für Energie) mit Linienverläufen (für SoC/Spannung) in einem Chart. Wähle Farben, fülle Flächen, stapele Balken (Stacked Bars) oder nutze Scatter-Plots für Rohdatenpunkte.

### 2. Live-Interaktivität & "Panel-Modus + Card Modus"
Du musst nicht jedes Mal YAML-Code ändern, um eine Ansicht zu testen.
* Klicke Sensoren mit gewünschter Farbe zusammen.
* Wähle Chartsansicht (line, bar, stepped, donut, scatter)
* Zoome stufenlos in Zeitbereiche oder wähle Zeitbereiche aus.
* Ändere die Skalierung (z.B. Watt zu Kilowatt) per Knopfdruck.
* Analysiere die Daten *live*.

### 3. Intelligente Datenaufbereitung
Das Panel rechnet für dich:
* Automatische Berechnung von **Energiesummen (kWh)** für den gewählten Zeitraum.
* Min/Max/Durchschnittswerte auf einen Blick.
* **Auto-Scale:** Schaltet Werte intelligent um, damit Diagramme lesbar bleiben.

### 4. Flexible Layouts
Vom klassischen **Kombiniert-Modus** (alles in einem) über den **Grid-Modus** (Getrennt) bis hin zum **Mixed-Modus** (Übersicht oben, Details unten). Dazu gibt es optional eine Donut-Sidebar für die prozentuale Verteilung (ideal für Monats-/Wochen-Charts).

---

### 5. Panel Mode vs. Card Mode – Ein mächtiger Workflow

Das Projekt ist dual konzipiert. Es dient sowohl als Explorer (Panel) oder auch als Anzeige (Dashboard-Card).  

#### A. Der Panel Mode (Der "Editor")  
Hier passiert die Magie. Wenn du das Panel als Sidebar-Element (View) einbindest, erhältst du eine Vollbild-Anwendung.  

* Suchen & Finden: Durchsuche blitzschnell deine Sensoren.  
* Drag & Drop: Ordne Charts im Split-View einfach per Maus neu an.  
* Konfiguration: Stelle Zeiträume (relativ oder fester Kalender), Farben und Chart-Typen per UI ein.  
* Speichern: Ansichten speichern und später wieder aufrufen.

<img src="images/details-chart-panel.png" alt="Dashboard Card" width="50%">

#### B. Der YAML Export (Für den Card Mode)  
Du hast im Panel Mode die perfekte Ansicht für deine Solaranlage zusammengeklickt? Du willst genau diese Ansicht auf deinem Dashboard auf dem Tablet haben?  

* Klicke auf den Kopieren-Button (📋).
* Kopiere den generierten yaml Code aus der oberen Ansicht im Auswahlfenster.
* Füge ihn in eine details-chart-card oder manuelle Standard-Lovelace-Karte ein.  
 
*Ergebnis:* Eine fest definierte Card, genau so konfiguriert, wie du sie im Panel Modus erstellt hast.  

<img src="images/details-chart-card-2.png" alt="Dashboard Card" width="40%">

* Zweite Möglichkeit, konfiguriere deine Charts direkt in der Card im Dashboard.
* Der Editor weißt dich entsprechend an.  
* Suche dazu einfach in HA Card Menü nach "details-chart-card"

*Ergebnis:* Eine custom Card, erstellt direkt im Dahsboard

<img src="images/details-chart-card.png" alt="Dashboard Card" width="40%">