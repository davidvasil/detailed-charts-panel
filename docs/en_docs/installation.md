# Installation

## Method 1: HACS (Recommended)

1.  Add this repository as a **Custom Repository** in HACS (Category: Lovelace).

	[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jayjojayson&repository=detailed-charts-panel&category=plugin)

2.  Search for "Detailed Charts Panel" and click on **Install**.
3.  The resource is added automatically.

## IMPORTANT: Sidebar Configuration

For the panel to appear as an independent menu item in the left sidebar of Home Assistant (Panel Mode), you must insert the following code into your `configuration.yaml` and restart Home Assistant:

```yaml
panel_custom:
  - name: detailed-charts-panel
    sidebar_title: Detailed Charts
    sidebar_icon: mdi:chart-bell-curve-cumulative
    module_url: /local/community/detailed-charts-panel/detailed-charts-panel.js
```

---

## Method 2: Manual

1.  Download all `.js` files from the repository (`current Release - Source.zip`).
2.  Create the folder `/config/www/community/detailed-charts-panel/`.
3.  Copy the files from the Source.zip from the folder `/dist` into it.
4.  Add the path `/local/community/detailed-charts-panel/detailed-charts-panel.js` as a JavaScript Module under **Settings > Dashboards > Resources**.
5.  IMPORTANT, insert the code into your `configuration.yaml` as explained in Method 1 and restart Home Assistant.

---

## Method 3: Manual in HA

1.  **Download Files:**
    * Download all files from this repository (`current Release - Source.zip`).
    * **Important:** Since this panel uses external libraries, make sure `chart.umd.min.js`, `hammer.min.js`, and `chartjs-plugin-zoom.min.js` are also downloaded.

2.  **Upload Files to Home Assistant:**
    * Create a new folder named `detailed-charts-panel` in the `www/community` directory of your Home Assistant configuration.
    * Copy **all downloaded files from the folder `/dist`** into this new folder. Your folder structure should look like this:
        ```
        /config/www/community/detailed-charts-panel/detailed-charts-panel.js
		/config/www/community/detailed-charts-panel/detailed-charts-panel-logic.js
		/config/www/community/detailed-charts-panel/detailed-charts-panel-function.js
		/config/www/community/detailed-charts-panel/detailed-charts-panel-editor.js
		/config/www/detailed-charts-views.js
		/config/www/community/detailed-charts-panel/chart.umd.min.js
		/config/www/community/detailed-charts-panel/hammer.min.js
		/config/www/community/detailed-charts-panel/chartjs-plugin-zoom.min.js
        ```

3.  **Add Resource to Home Assistant:**
    * Go to **Settings > Dashboards** in Home Assistant.
    * Click on the menu with the three dots in the top right and select **Resources**.
    * Click on **+ Add Resource**.
    * Enter `/local/community/detailed-charts-panel/detailed-charts-panel.js` as the URL.
    * Select **JavaScript Module** as the resource type.
    * Click on **Create**.

4.  IMPORTANT, insert the code into your `configuration.yaml` as explained in Method 1 and restart Home Assistant.
