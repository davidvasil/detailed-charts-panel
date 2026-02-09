/* detailed-charts-views.js */
/* Hier können Ansichten definiert werden, die auf allen Geräten verfügbar sind.
   Diese Ansichten werden im Panel mit einem Schloss-Symbol angezeigt 
   und können nicht über die GUI gelöscht werden.
*/

export const sharedViews = [
    
	/* Code hier drunter einfügen */
	
    {
    "name": "Meine neue Ansicht",
    "chartType": "bar",
    "timeMode": "relative",
    "timeSelect": "720",
    "fillArea": true,
    "stackedBars": true,
    "showStats": true,
    "layoutMode": "mixed",
    "gridColumns": 4,
    "zoomLevel": 1,
    "autoScale": false,
    "threshold": "12",
    "threshold2": "14",
    "hideAxislabels": false,
    "hideGrid": false,
    "chartTension": 0,
    "sensors": [
        {
            "entityId": "sensor.stromverbrauch_taglich",
            "color": "#d97e17"
        },
        {
            "entityId": "sensor.batterieladung_vr_kwh_taglich_2",
            "color": "#4f53bb"
        },
        {
            "entityId": "sensor.growatt_todaygenerateenergy",
            "color": "#37c70f"
        },
        {
            "entityId": "sensor.solar_netzeinspeisung_kwh_taglich",
            "color": "#d73114"
        },
        {
            "entityId": "sensor.batterieentladung_vr_kwh_taglich",
            "color": "#0a16ca"
        },
        {
            "entityId": "sensor.victron_system_battery_soc",
            "color": "#1cba14"
        }
    ]
}

];