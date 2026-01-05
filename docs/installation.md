# Installation

## Methode 1: HACS (Empfohlen)

1.  Füge dieses Repository als **Benutzerdefiniertes Repository** in HACS hinzu (Kategorie: Lovelace).

	[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jayjojayson&repository=detailed-charts-panel&category=plugin)

2.  Suche nach "Detailed Charts Panel" und klicke auf **Installieren**.
3.  Die Ressource wird automatisch hinzugefügt.

## WICHTIG: Sidebar Konfiguration

Damit das Panel als eigenständiger Menüpunkt in der linken Seitenleiste von Home Assistant erscheint (Panel Mode), musst du folgenden Code in deine `configuration.yaml` einfügen und Home Assistant neu starten:

```yaml
panel_custom:
  - name: detailed-charts-panel
    sidebar_title: Detailed Charts
    sidebar_icon: mdi:chart-bell-curve-cumulative
    module_url: /local/community/detailed-charts-panel/detailed-charts-panel.js
```	

---

## Methode 2: Manuell

1.  Lade alle `.js` Dateien aus dem Repository herunter (`akutelle Release - Sourc.zip`).
2.  Erstelle den Ordner `/config/www/community/detailed-charts-panel/`.
3.  Kopiere die Dateien aus der Source.zip aus dem Ordnder `/dist` dort hinein.
4.  Füge unter **Einstellungen > Dashboards > Ressourcen** den Pfad `/local/community/detailed-charts-panel/detailed-charts-panel.js` als JavaScript-Modul hinzu.
5.	WICHTIG, füge wie in Methode 1 erklärt den Code in deine `configuration.yaml` ein und starte Home Assistant neu.

---

## Methode 3: Manuell in HA

1.  **Dateien herunterladen:**
    * Lade alle Dateien aus diesem Repository herunter (`akutelle Release - Sourc.zip`).
    * **Wichtig:** Da dieses Panel externe Bibliotheken nutzt, stelle sicher, dass `chart.umd.min.js`, `hammer.min.js` und `chartjs-plugin-zoom.min.js` ebenfalls heruntergeladen werden.

2.  **Dateien in Home Assistant hochladen:**
    * Erstelle einen neuen Ordner namens `detailed-charts-panel` im `www/community`-Verzeichnis deiner Home Assistant-Konfiguration.
    * Kopiere **alle heruntergeladenen Dateien aus dem Ordner `/dist`** in diesen neuen Ordner. Deine Ordnerstruktur sollte wie folgt aussehen:
        ```
        /config/www/community/detailed-charts-panel/detailed-charts-panel.js
		/config/www/community/detailed-charts-panel/detailed-charts-panel-editor.js
		/config/www/community/detailed-charts-panel/detailed-charts-panel-function.js
		/config/www/community/detailed-charts-panel/detailed-charts-views.js
		/config/www/community/detailed-charts-panel/chart.umd.min.js
		/config/www/community/detailed-charts-panel/hammer.min.js
		/config/www/community/detailed-charts-panel/chartjs-plugin-zoom.min.js
        ```
		
3.  **Ressource zu Home Assistant hinzufügen:**
    * Gehe in Home Assistant zu **Einstellungen > Dashboards**.
    * Klicke auf das Menü mit den drei Punkten oben rechts und wähle **Ressourcen**.
    * Klicke auf **+ Ressource hinzufügen**.
    * Gebe als URL `/local/community/detailed-charts-panel/detailed-charts-panel.js` ein.
    * Wähle als Ressourcentyp **JavaScript-Modul**.
    * Klicke auf **Erstellen**.

4.	WICHTIG, füge wie in Methode 1 erklärt den Code in deine `configuration.yaml` ein und starte Home Assistant neu.