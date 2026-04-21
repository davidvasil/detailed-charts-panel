# Ansichten Speichern

Du kannst deine Konfigurationen im Panel Modus speichern, um sie später schnell wieder aufzurufen. Es gibt zwei Methoden:

## 1. Lokal (Browser Storage)
Klicke auf das **Speichern-Symbol** 💾 in der Sidebar.
* **Speicherort:** LocalStorage des Browsers.
* **Vorteil:** Schnell und einfach.
* **Nachteil:** Wenn du den Browser wechselst oder das Gerät wechselst, sind die Ansichten weg.

## 2. Global (JSON Export)
Das ist die "Profi-Methode", um Ansichten auf **allen Geräten** (Tablet, Handy, PC) verfügbar zu machen. Diese Ansichten erhalten ein **Schloss-Icon 🔒**.

### Vorgehensweise:

1.  Erstelle deine Wunsch-Ansicht im Panel.
2.  Klicke auf den **Kopieren-Button** (📋 Icon).
3.  Kopiere aus der Auswahl im Popup den unteren **JSON-Code**.
4.  Öffne z.B. den File Explorer und navigiere zu deinem HA Ordner (`/www/`).
5.  Erstelle eine neue Datei `detailed-charts-views.js`.
6.  Füge den Code aus dem unten aufgeführten Beispiel in die Datei ein.
7.  Ersetze nun den Inhalt des `sharedViews` Arrays mit deinem JSON-Code.
8.  Speichere die Datei.

<img src="images/example4.png" alt="JSON Code" width="25%">

### Beispiel für `detailed-charts-views.js`:

```javascript
export const sharedViews = [
    
    /* Füge dein Code hierunter ein */
    {
        "name": "Meine globale Solar-Analyse",
        "chartType": "bar",
        "sensors": [
             { "entityId": "sensor.solar_yield", "color": "#ff9800" }
        ],
        "timeMode": "relative",
        "timeSelect": "720",
        "fillArea": true
    }
];
```
