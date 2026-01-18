# Technical Functionality & Architecture

The **Detailed Charts Panel** is designed as a **Custom Element** (Web Component) for Home Assistant. It runs entirely client-side in the browser, requires no cloud, and therefore runs purely locally in your HA instance.

## File Structure

The code has a modular structure:

* **`detailed-charts-panel.js` (The Controller):** This is the start file and the face of the panel.
* **`detailed-charts-panel-logic.js` (The Brain / The Engine):** Here the "work" takes place that has nothing to do with clicks.
* **`detailed-charts-panel-function.js` (The Toolbox & Templates):** Contains helper functions for data processing (aggregation).
* **`detailed-charts-panel-editor.js` (Card Editor):** Responsible for the layout and creation of the card on the dashboard.
* **`detailed-charts-views.js` (Configuration):** A JSON-based file for global, read-only views.

## Smart Data Fetching

The panel uses a **hybrid strategy** for maximum performance:

1.  **Short-term Analysis (< 48 hours):** Use of the **History API**. Exact raw data is loaded. Advantage: High precision.
2.  **Long-term Analysis (> 48 hours):** Automatic switch to the **Long-Term Statistics API** via WebSocket. Statistical values (Min/Max/Mean) are loaded. Advantage: Extremely fast, even with yearly views.

## Libraries

The project uses proven open-source libraries for the generated charts:
* **Chart.js:** For high-performance rendering on HTML5 Canvas.
* **Chart.js Plugin Zoom:** For Zoom & Pan via mouse/touch.
* **Hammer.js:** For the detection of touch gestures on mobile devices.

---

## Architecture Details
The code is divided into five logical modules to ensure maintainability and clarity:

#### `detailed-charts-panel.js` (The Controller)
This is the start file and the face of the panel. It acts as a "connector" between the logic and the user interface:

* Registration: Registers the Custom Element (detailed-charts-panel) with Home Assistant.
* UI Initialization: Builds the basic framework of the panel and sets the event listeners for all buttons and sliders.
* Hass Connection: Passes Home Assistant states (hass) to the logic and embedded Custom Cards.
* Interface to Editor: Links the panel with the editor file for configuration.

#### `detailed-charts-panel-logic.js` (The Brain / The Engine)
This file contains the base class DetailedChartsLogic. Here is where the actual "work" takes place that is not directly related to clicks:

* Data Acquisition: Contains complex functions for retrieving history data (fetchDataSmart) and statistics from the Home Assistant database.
* Chart Management: Controls the creation, updating, and destruction of Chart.js instances.
* State Management: Manages the internal cache of sensor data and calculates time windows.
* Dependencies: Dynamically loads external libraries like Chart.js or Hammer.js.

#### `detailed-charts-panel-function.js` (The Toolbox & Templates)
This file contains pure helper functions ("Pure Functions") that have been outsourced to keep the main code clean:

* Data Processors: Algorithms that convert raw HA data into a format that Chart.js understands (e.g., aggregation to hours/days).
* HTML Templates: Here lie the drafts for statistics cards, the sidebar, and the various layout modes (Split/Combined).
* Helpers: Small helpers for colors (Hex-to-RGBA), name cleaning, and mathematical calculations.

#### `detailed-charts-panel-editor.js` (The Card Editor)
This file is responsible for the layout and creation of the card on the dashboard:

* Connection: to detailed-charts-panel.js, detailed-charts-panel-logic.js & detailed-charts-panel-function.js
* Visual Editor: Creates the user interface with dropdowns and switches to configure the card without YAML knowledge.
* Live Preview: Transmits changes immediately to the main panel so you can see how the chart changes.

#### `detailed-charts-views.js` (The Configuration):
A pure data file exporting a JSON object (sharedViews):

* Read-only: All views defined here appear in the panel with a lock symbol.
* They are globally available and cannot be accidentally deleted via the web interface.

#### Data Processing & Rendering Pipeline
When you click on "Load Data", the following happens:

* Fetch: The data is retrieved asynchronously (async/await) in parallel for all sensors from Home Assistant.
* Process (processData): Raw data is cleaned (filter error values).
* If necessary (e.g., with "Bar" charts over long periods), the data is downsampled to days or hours (aggregated).
* Auto-Scale: Values are divided if needed (e.g., W → kW).
* Render: A chart object is instantiated.
* The datasets (lines/bars) are configured with colors, fill options, and curve smoothing (cubicInterpolationMode: 'monotone').
* The canvas is drawn.

#### State Storage (Saving)
To ensure you don't have to start over after a reload (F5), the panel uses the browser's LocalStorage.
Every change (sensor added, color changed, view mode, etc.) is immediately written to a JSON object in the browser storage (localStorage.setItem).
At startup, the panel checks if settings exist and restores the last state. Via `detailed-charts-views.js`, views can also be exchanged between devices.
