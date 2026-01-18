# Saving Views

You can save your configurations in Panel Mode to quickly recall them later. There are two methods:

## 1. Local (Browser Storage)
Click on the **Save Symbol** 💾 in the sidebar.
* **Storage Location:** Browser's LocalStorage.
* **Advantage:** Quick and easy.
* **Disadvantage:** If you switch browsers or devices, the views are gone.

## 2. Global (JSON Export)
This is the "Pro Method" to make views available on **all devices** (Tablet, Mobile, PC). These views receive a **lock icon 🔒**.

### Procedure:

1.  Create your desired view in the panel.
2.  Click on the **Copy Button** (📋 Icon).
3.  Copy the lower **JSON Code** from the selection in the popup.
4.  Open the file `detailed-charts-views.js` in your Home Assistant folder (`/www/community/detailed-charts-panel/`).
5.  Paste the code into the `sharedViews` array.

<img src="../images/example4.png" alt="JSON Code" width="25%">

### Example for `detailed-charts-views.js`:

```javascript
export const sharedViews = [
    {
        "name": "My Global Solar Analysis",
        "chartType": "bar",
        "sensors": [
             { "entityId": "sensor.solar_yield", "color": "#ff9800" }
        ],
        "timeMode": "relative",
        "timeSelect": "720", // Last 30 days
        "fillArea": true
    }
];
```
