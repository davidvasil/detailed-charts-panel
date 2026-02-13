/* detailed-charts-views.js */
/* Hier können Ansichten definiert werden, die auf allen Geräten verfügbar sind.
   Diese Ansichten werden im Panel mit einem Schloss-Symbol angezeigt 
   und können nicht über die GUI gelöscht werden.
*/

export const sharedViews = [
    
	/* Paste your Code here */
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