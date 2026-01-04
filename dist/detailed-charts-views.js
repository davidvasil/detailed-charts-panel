/* detailed-charts-views.js */
/* Hier können Ansichten definiert werden, die auf allen Geräten verfügbar sind.
   Diese Ansichten werden im Panel mit einem Schloss-Symbol angezeigt 
   und können nicht über die GUI gelöscht werden.
*/

export const sharedViews = [
    {
		"name": "Test 1",
		"chartType": "bar",
		"timeMode": "relative",
		"timeSelect": "24",
		"fillArea": true,
		"stackedBars": false,
		"showStats": false,
		"layoutMode": "mixed",
		"gridColumns": 3,
		"zoomLevel": 1,
		"autoScale": true,
		"threshold": "",
		"sensors": [
			{
				"entityId": "sensor.dein_Sensor",
				"color": "#03a9f4",
				"typeOverride": "line"
			},
			{
				"entityId": "sensor.dein_Sensor",
				"color": "#ab7fe6",
				"typeOverride": "line"
			},
			{
				"entityId": "sensor.dein_Sensor",
				"color": "#ef827f",
				"typeOverride": "line"
			}
		]
	},
    {
		"name": "Test 2",
		"chartType": "bar",
		"timeMode": "relative",
		"timeSelect": "24",
		"fillArea": true,
		"stackedBars": false,
		"showStats": false,
		"layoutMode": "mixed",
		"gridColumns": 3,
		"zoomLevel": 1,
		"autoScale": true,
		"threshold": "",
		"sensors": [
			{
				"entityId": "sensor.dein_Sensor",
				"color": "#03a9f4",
				"typeOverride": "line"
			},
			{
				"entityId": "sensor.dein_Sensor",
				"color": "#ab7fe6",
				"typeOverride": "line"
			},
			{
				"entityId": "sensor.dein_Sensor",
				"color": "#ef827f",
				"typeOverride": "line"
			}
		]
	}
];
