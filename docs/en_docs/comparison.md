# Why Detailed Charts?

Your data, finally understandable!

The Detailed Charts Panel is far more than just a simple history card. While the standard Home Assistant history is good for checking if the light was on, it quickly reaches its limits when analyzing energy, climate, or complex sensor relationships.

This project hopefully closes the gap between simple display and professional data analysis – directly on your dashboard.

Here are the reasons why this panel is better suited for analysis:

### 1. Total Control over Presentation
* **Standard HA:** Line colors are often random or fixed. Types like Bar Chart cannot be selected.
* **Detailed Charts:** You decide! Mix bar charts (for energy) with line trends (for SoC/Voltage) in one chart. Choose colors, fill areas, stack bars (Stacked Bars), or use Scatter plots for raw data points.

### 2. Live Interactivity & "Panel Mode + Card Mode"
You don't have to change YAML code every time to test a view.
* Click sensors together with desired color.
* Select chart view (line, bar, stepped, donut, scatter).
* Zoom continuously into time ranges or select time ranges.
* Change scaling (e.g., Watt to Kilowatt) at the push of a button.
* Analyze data *live*.

### 3. Intelligent Data Preparation
The panel calculates for you:
* Automatic calculation of **energy sums (kWh)** for the selected period.
* Min/Max/Average values at a glance.
* **Auto-Scale:** Intelligently switches values so charts remain readable.

### 4. Flexible Layouts
From classic **Combined Mode** (everything in one) to **Grid Mode** (Separated) to **Mixed Mode** (Overview top, details bottom). Plus an optional Donut Sidebar for percentage distribution (ideal for monthly/weekly charts).

---

### 5. Panel Mode vs. Card Mode – A Powerful Workflow

The project is designed with a dual concept. It serves both as an Explorer (Panel) or as a Display (Dashboard Card).

#### A. The Panel Mode (The "Editor")
Here the magic happens. If you integrate the panel as a sidebar element (View), you get a full-screen application.

* Search & Find: Search your sensors at lightning speed.
* Drag & Drop: Simply rearrange charts in Split-View with the mouse.
* Configuration: Set time periods (relative or fixed calendar), colors, and chart types via UI.
* Save: Save views and recall them later.

<img src="https://raw.githubusercontent.com/jayjojayson/detailed-charts-panel/main/docs/images/details-chart-panel.png" alt="Dashboard Card" width="50%">

#### B. The YAML Export (For Card Mode)
You have clicked together the perfect view for your solar system in Panel Mode? You want exactly this view on your dashboard on your tablet?

* Click on the Copy button (📋).
* Copy the generated yaml code from the top view in the selection window.
* Paste it into a details-chart-card or manual standard Lovelace card.

*Result:* A permanently defined card, configured exactly as you created it in Panel Mode.

<img src="https://raw.githubusercontent.com/jayjojayson/detailed-charts-panel/main/docs/images/details-chart-card-2.png" alt="Dashboard Card" width="40%">

#### B.2. The Card Editor (Dashboard)

* Configure your charts directly in the card on the dashboard.
* The editor instructs you accordingly.
* Simply search in the HA Card selection for "details-chart-card".

*Result:* A custom Card, created directly in the dashboard.

<img src="https://raw.githubusercontent.com/jayjojayson/detailed-charts-panel/main/docs/images/details-chart-card.png" alt="Dashboard Card" width="40%">
