# Installation

## Methode 1: HACS (Empfohlen)

1.  Füge dieses Repository als **Benutzerdefiniertes Repository** in HACS hinzu (Kategorie: Lovelace).
2.  Suche nach "Detailed Charts Panel" und klicke auf **Installieren**.
3.  Die Ressource wird meist automatisch hinzugefügt.

## Methode 2: Manuell

1.  Lade alle `.js` Dateien aus dem Repository herunter (`detailed-charts-panel.js`, `chart.umd.min.js`, etc.).
2.  Erstelle den Ordner `/config/www/community/detailed-charts-panel/`.
3.  Kopiere die Dateien dort hinein.
4.  Füge unter **Einstellungen > Dashboards > Ressourcen** den Pfad `/local/community/detailed-charts-panel/detailed-charts-panel.js` als JavaScript-Modul hinzu.

## WICHTIG: Sidebar Konfiguration

Damit das Panel als eigenständiger Menüpunkt in der linken Seitenleiste von Home Assistant erscheint (Panel Mode), musst du folgenden Code in deine `configuration.yaml` einfügen und Home Assistant neu starten:

```yaml
panel_custom:
  - name: detailed-charts-panel
    sidebar_title: Detailed Charts
    sidebar_icon: mdi:chart-bell-curve-cumulative
    module_url: /local/community/detailed-charts-panel/detailed-charts-panel.js
```	
