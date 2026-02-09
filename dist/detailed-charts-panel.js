/* detailed-charts-panel.js */
console.log(
  "%c📉️ DetailedChartsPanel: v_2.5 ready",
  "background: #5596c5; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold;"
);

import {
    cleanName,
    getRandomColor,
    getPanelTemplate
} from './detailed-charts-panel-function.js';

import { DetailedChartsLogic } from './detailed-charts-panel-logic.js';

class DetailedChartsPanel extends DetailedChartsLogic {
    constructor() {
        super();
        this.STORAGE_KEY_CONFIG = 'detailed-charts-config';
        this.STORAGE_KEY_VIEWS = 'detailed-charts-saved-views';
    }

    // --- EDITOR SUPPORT ---
    static async getConfigElement() {
        await import("./detailed-charts-panel-editor.js");
        return document.createElement("detailed-charts-panel-editor");
    }

    static getStubConfig() {
        return {
            sensors: [],
            chartType: 'line',
            timeMode: 'relative',
            timeSelect: '24',
            layoutMode: 'combined',
            fillArea: false
        };
    }

    // --- LOVELACE CARD CONFIGURATION ---
    setConfig(config) {
        this._settingsLoaded = true; // Prevent loadSettings from running in set hass (Card Mode)

        const oldConfig = this._config;
        this._config = config;
        this.setAttribute('card-mode', '');

        if (!this.content) {
            this.initUI();
            this.loadDependencies();
        }

        // Deduplicate sensors by entityId to prevent double tooltips
        const uniqueSensors = [];
        const seenIds = new Set();
        (config.sensors || []).forEach(s => {
            if (!s) return;
            if (!s.isCard && s.entityId) {
                if (!seenIds.has(s.entityId)) {
                    seenIds.add(s.entityId);
                    uniqueSensors.push(s);
                }
            } else {
                uniqueSensors.push(s);
            }
        });
        this.selectedSensors = uniqueSensors;

        this.chartType = config.chartType || 'line';
        this.timeMode = config.timeMode || 'relative';
        this.timeSelect = config.timeSelect || '24';
        this.fillArea = (config.fillArea === true);

        this.layoutMode = config.layoutMode || 'combined';
        this.gridColumns = config.gridColumns || 1;

        // Legacy Check: map splitCharts to layoutMode if layoutMode not set
        if (!config.layoutMode && config.splitCharts !== undefined) {
            this.layoutMode = config.splitCharts ? 'split' : 'combined';
        }

        this.stackedBars = config.stackedBars !== undefined ? config.stackedBars : false;
        this.showStats = config.showStats !== undefined ? config.showStats : true;
        this.showDonutSidebar = config.showDonutSidebar || false;
        this.zoomLevel = config.zoomLevel || 1.0;
        this.autoScale = config.autoScale || false;
        this.thresholdValue = config.threshold || "";
        this.thresholdValue2 = config.threshold2 || "";
        this.chartTension = config.chartTension !== undefined ? config.chartTension : 4;

        this.hideAxislabels = config.hideAxislabels || false;
        this.hideGrid = config.hideGrid || false;

        if (this.content) {
            const updateInput = (id, val, isCheck = false) => {
                const el = this.content.querySelector(id);
                if (el) {
                    if (isCheck) el.checked = val;
                    else el.value = val;
                }
            };

            updateInput('#chart-type', this.chartType);
            updateInput('#time-select', this.timeSelect);
            if (config.dateStart) updateInput('#date-start', config.dateStart);
            if (config.dateEnd) updateInput('#date-end', config.dateEnd);

            updateInput('#fill-switch', this.fillArea, true);
            updateInput('#layout-select', this.layoutMode);
            updateInput('#stacked-switch', this.stackedBars, true);
            updateInput('#grid-slider', this.gridColumns);
            updateInput('#tension-slider', this.chartTension);

            updateInput('#hide-axis-switch', this.hideAxislabels, true);
            updateInput('#hide-grid-switch', this.hideGrid, true);

            const gridDisp = this.content.querySelector('#grid-value-display');
            if (gridDisp) gridDisp.textContent = this.gridColumns;

            const tensionDisp = this.content.querySelector('#tension-value-display');
            if (tensionDisp) tensionDisp.textContent = this.chartTension;

            const zoomDisp = this.content.querySelector('#zoom-value-display');
            if (zoomDisp) zoomDisp.textContent = Math.round(this.zoomLevel * 100) + '%';
            updateInput('#zoom-slider', this.zoomLevel);

            updateInput('#stats-switch', this.showStats, true);
            updateInput('#donut-switch', this.showDonutSidebar, true);
            updateInput('#autoscale-switch', this.autoScale, true);
            updateInput('#threshold-input', this.thresholdValue);
            updateInput('#threshold2-input', this.thresholdValue2);

            this.updateSliderVisibility();
            this.updateStackedVisibility();
            this.switchTimeMode(this.timeMode);

            this.renderSensorListUI();

            // FIX: If config changed (Editor), sync to localStorage to prevent loadSettings from reverting it
            if (oldConfig) {
                const keysToCheck = ['layoutMode', 'chartType', 'timeMode', 'timeSelect', 'fillArea', 'stackedBars', 'gridColumns', 'zoomLevel', 'showStats', 'showDonutSidebar', 'autoScale', 'threshold', 'threshold2', 'hideAxislabels', 'hideGrid'];
                let hasChanged = keysToCheck.some(k => oldConfig[k] !== config[k]);
                if (!hasChanged) {
                    if (JSON.stringify(config.sensors) !== JSON.stringify(oldConfig.sensors)) hasChanged = true;
                }
                if (hasChanged) {
                    this.saveSettings();
                }
            }
        }

        // Force update of internal state for LayoutMode if changed via Editor
        if (this.libsLoaded) {
            // If we have data, we can just re-render the chart with new settings
            if (this._sensorDataCache.length > 0) {
                if (this._reloadTimeout) clearTimeout(this._reloadTimeout);
                this._reloadTimeout = setTimeout(() => {
                    this.updateChartFromCache();
                }, 100);
            } else if (this._hass) {
                // No data yet, load it
                if (this._reloadTimeout) clearTimeout(this._reloadTimeout);
                this._reloadTimeout = setTimeout(() => {
                    this.loadHistory();
                }, 500);
            }
        }
    }

    getCardSize() {
        return 4;
    }

    set hass(hass) {
        this._hass = hass;
        if (!this.content) {
            try {
                this.initUI();
                this.loadDependencies();
                if (!this._config) this.loadSettings();
            } catch (e) {
                console.error("Critical Error", e);
                this.innerHTML = `<div style="color:red;padding:20px;">Fehler: ${e.message}</div>`;
            }
        }

        // --- FIX: Pass Hass updates to Custom Cards ---
        if (this.shadowRoot) {
            const customCardContainers = this.shadowRoot.querySelectorAll('.split-card-container');
            customCardContainers.forEach(container => {
                // Find the first child that is a custom element (has a dash)
                const card = Array.from(container.children).find(child => child.tagName.includes('-'));
                if (card) {
                    card.hass = hass;
                }
            });
        }

        if (this._hass && this._hass.states && !this._allSensorsLoaded) {
            this._allSensors = Object.keys(this._hass.states)
                .filter(k => k.startsWith('sensor.') || k.startsWith('binary_sensor.') || k.startsWith('input_number.'))
                .sort();
            this._allSensorsLoaded = true;
        }

        // Ensure persistence: Load settings if we haven't already, even if setConfig was called.
        // However, avoid overwriting if loadHistory already started or if we assume setConfig provided the truth.
        // The issue is that setConfig prevents loadSettings call because this._config is true.
        // But if persistence is desired, loadSettings should run at least once.
        if (!this._settingsLoaded && !this._loadSettingsFailed) {
            this._settingsLoaded = true; // Mark as attempted
            this.loadSettings();
        }

        if (this._config && this.libsLoaded && this.selectedSensors.length > 0 && !this._dataLoadedInit) {
            this._dataLoadedInit = true;
            this.loadHistory();
        }
    }

    initUI() {
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = getPanelTemplate();
        this.content = root;
        this.chartLibReady = false;
        this.timeMode = 'relative';

        const haMenuBtn = this.content.querySelector('#ha-menu-btn');
        if (haMenuBtn) {
            haMenuBtn.addEventListener('click', () => {
                this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true }));
            });
        }

        const mobSidebarBtn = this.content.querySelector('#mobile-open-sidebar-btn');
        if (mobSidebarBtn) {
            mobSidebarBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        this.content.querySelector('#add-card-btn').addEventListener('click', () => {
            this.content.querySelector('#import-card-modal').style.display = 'flex';
            this.content.querySelector('#card-import-area').focus();
        });

        this.content.querySelector('#clear-all-btn').addEventListener('click', () => this.clearAllSensors());
        this.content.querySelector('#save-view-btn').addEventListener('click', () => this.saveCurrentView());

        this.content.querySelector('#reset-zoom-btn').addEventListener('click', () => this.resetZoomAll());
        this.content.querySelector('#copy-yaml-btn').addEventListener('click', () => this.copyToClipboard());

        this.content.querySelector('#toggle-sidebar-btn').addEventListener('click', () => this.toggleSidebar());
        this.content.querySelector('#open-sidebar-floating').addEventListener('click', () => this.toggleSidebar());

        this.content.querySelector('#close-modal-btn').addEventListener('click', () => {
            this.content.querySelector('#export-modal').style.display = 'none';
            this.content.querySelectorAll('.copy-success-msg').forEach(el => el.style.display = 'none');
        });
        this.content.querySelector('#export-modal').addEventListener('click', (e) => {
            if (e.target.id === 'export-modal') {
                this.content.querySelector('#export-modal').style.display = 'none';
                this.content.querySelectorAll('.copy-success-msg').forEach(el => el.style.display = 'none');
            }
        });

        this.content.querySelector('#close-import-modal-btn').addEventListener('click', () => {
            this.content.querySelector('#import-card-modal').style.display = 'none';
        });
        this.content.querySelector('#import-card-confirm-btn').addEventListener('click', () => this.importCustomCard());

        const handleCopy = (areaId, msgId) => {
            const txt = this.content.querySelector(areaId);
            const msg = this.content.querySelector(msgId);
            txt.select();
            txt.setSelectionRange(0, 99999);
            const showSuccess = () => { msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); };
            try {
                const successful = document.execCommand('copy');
                if (successful) showSuccess(); else throw new Error("execCommand failed");
            } catch (err) {
                navigator.clipboard.writeText(txt.value).then(() => showSuccess()).catch(() => alert("Kopieren fehlgeschlagen."));
            }
        };

        this.content.querySelector('#copy-yaml-btn-action').addEventListener('click', () => handleCopy('#yaml-export-area', '#msg-yaml'));
        this.content.querySelector('#copy-json-btn-action').addEventListener('click', () => handleCopy('#json-export-area', '#msg-json'));

        this.content.querySelector('#sensor-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSensor();
        });

        const sInput = this.content.querySelector('#sensor-input');
        sInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        sInput.addEventListener('focus', (e) => this.handleSearch(e.target.value));

        document.addEventListener('click', (e) => {
            if (this.shadowRoot && !e.composedPath().includes(this.content.querySelector('.control-group'))) {
                this.content.querySelector('#suggestions').style.display = 'none';
            }
        });

        const inputs = [
            '#chart-type', '#time-select', '#date-start', '#date-end',
            '#fill-switch', '#layout-select', '#stacked-switch',
            '#stats-switch', '#donut-switch', '#autoscale-switch',
            '#hide-axis-switch', '#hide-grid-switch'
        ];
        inputs.forEach(id => {
            const el = this.content.querySelector(id);
            if (!el) return;
            el.addEventListener('change', (e) => {
                if (id === '#fill-switch') this.fillArea = e.target.checked;

                if (id === '#chart-type') {
                    if (e.target.value !== 'bar') {
                        this.stackedBars = false;
                        const sw = this.content.querySelector('#stacked-switch');
                        if (sw) sw.checked = false;
                        this.updateStackedVisibility();
                    }
                }

                if (id === '#layout-select') {
                    this.layoutMode = e.target.value;
                    this.updateSliderVisibility();
                }
                if (id === '#stacked-switch') this.stackedBars = e.target.checked;
                if (id === '#stats-switch') this.showStats = e.target.checked;
                if (id === '#donut-switch') this.showDonutSidebar = e.target.checked;
                if (id === '#autoscale-switch') this.autoScale = e.target.checked;
                if (id === '#hide-axis-switch') this.hideAxislabels = e.target.checked;
                if (id === '#hide-grid-switch') this.hideGrid = e.target.checked;

                this.updateStackedVisibility();
                if (!this._config) this.saveSettings();

                if (this._sensorDataCache.length > 0 && (id !== '#time-select' && id !== '#date-start' && id !== '#date-end')) {
                    this.updateChartFromCache();
                }
            });
        });

        const threshInput = this.content.querySelector('#threshold-input');
        threshInput.addEventListener('change', (e) => {
            this.thresholdValue = e.target.value;
            if (!this._config) this.saveSettings();
            if (this._sensorDataCache.length > 0) this.updateChartFromCache();
        });

        const threshInput2 = this.content.querySelector('#threshold2-input');
        if (threshInput2) {
            threshInput2.addEventListener('change', (e) => {
                this.thresholdValue2 = e.target.value;
                if (!this._config) this.saveSettings();
                if (this._sensorDataCache.length > 0) this.updateChartFromCache();
            });
        }

        const zoomSlider = this.content.querySelector('#zoom-slider');
        zoomSlider.addEventListener('input', (e) => {
            this.zoomLevel = parseFloat(e.target.value);
            this.content.querySelector('#zoom-value-display').textContent = Math.round(this.zoomLevel * 100) + '%';
            this.applyZoom();
        });
        zoomSlider.addEventListener('change', (e) => { if (!this._config) this.saveSettings(); });

        ['#time-select', '#date-start', '#date-end'].forEach(id => {
            this.content.querySelector(id).addEventListener('change', (e) => {
                if (!this._config) this.saveSettings();
                this.loadHistory();
            });
        });

        const gridSlider = this.content.querySelector('#grid-slider');
        gridSlider.addEventListener('input', (e) => {
            this.gridColumns = parseInt(e.target.value);
            this.content.querySelector('#grid-value-display').textContent = this.gridColumns;
        });
        gridSlider.addEventListener('change', (e) => {
            if (!this._config) this.saveSettings();
            if (this._sensorDataCache.length > 0 && this.layoutMode !== 'combined') this.updateChartFromCache();
        });

        const tensionSlider = this.content.querySelector('#tension-slider');
        if (tensionSlider) {
            tensionSlider.addEventListener('input', (e) => {
                this.chartTension = parseInt(e.target.value);
                const disp = this.content.querySelector('#tension-value-display');
                if (disp) disp.textContent = this.chartTension;
            });
            tensionSlider.addEventListener('change', (e) => {
                if (!this._config) this.saveSettings();
                if (this._sensorDataCache.length > 0) this.updateChartFromCache();
            });
        }

        const setMode = (mode) => { this.switchTimeMode(mode); if (!this._config) this.saveSettings(); };
        this.content.querySelector('#btn-mode-relative').addEventListener('click', () => setMode('relative'));
        this.content.querySelector('#btn-mode-fixed').addEventListener('click', () => setMode('fixed'));

        if (!this.content.querySelector('#date-end').value) {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const toLocalISO = (date) => {
                const offset = date.getTimezoneOffset() * 60000;
                return new Date(date.getTime() - offset).toISOString().slice(0, 16);
            };
            this.content.querySelector('#date-end').value = toLocalISO(now);
            this.content.querySelector('#date-start').value = toLocalISO(yesterday);
        }
    }

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        const sidebar = this.shadowRoot.getElementById('sidebar-panel');
        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            this.classList.add('sidebar-hidden');
        } else {
            sidebar.classList.remove('collapsed');
            this.classList.remove('sidebar-hidden');
        }
        setTimeout(() => { this.chartInstances.forEach(c => c.resize()); }, 350);
    }

    toggleMonochrome() {
        this.monochromeMode = !this.monochromeMode;
        const btn = this.shadowRoot.querySelector('#toggle-mono-btn');
        if (btn) btn.classList.toggle('active', !this.monochromeMode);

        if (this.monochromeMode) {
            this.chartInstances.forEach(chart => {
                if (chart.config.type === 'doughnut') return;
                chart.data.datasets.forEach((ds, idx) => {
                    ds.borderColor = 'rgba(128, 128, 128, 0.4)';
                    ds.backgroundColor = 'transparent';
                    ds.borderWidth = 1.5;
                    ds.fill = false;
                    let minVal = Infinity, maxVal = -Infinity;
                    ds.data.forEach(p => {
                        if (p.y < minVal) minVal = p.y;
                        if (p.y > maxVal) maxVal = p.y;
                    });
                    ds.pointRadius = (ctx) => {
                        const v = ctx.parsed.y;
                        return (v === minVal || v === maxVal) ? 5 : 0;
                    };
                    ds.pointBackgroundColor = (ctx) => {
                        const v = ctx.parsed.y;
                        if (v === maxVal) return '#f44336';
                        if (v === minVal) return '#2196f3';
                        return 'transparent';
                    };
                    ds.pointBorderColor = (ctx) => {
                        const v = ctx.parsed.y;
                        if (v === maxVal) return '#f44336';
                        if (v === minVal) return '#2196f3';
                        return 'transparent';
                    };
                });
                chart.update();
            });
        } else {
            this.updateChartFromCache();
        }
    }

    copyToClipboard() {
        if (this.selectedSensors.length === 0) { alert("Keine Sensoren ausgewählt."); return; }
        this.fillArea = this.content.querySelector('#fill-switch').checked;

        let yaml = `type: custom:detailed-charts-panel\n`;
        yaml += `chartType: ${this.content.querySelector('#chart-type').value}\n`;
        yaml += `timeMode: ${this.timeMode}\n`;
        if (this.timeMode === 'relative') { yaml += `timeSelect: "${this.content.querySelector('#time-select').value}"\n`; }
        else {
            yaml += `dateStart: "${this.content.querySelector('#date-start').value}"\n`;
            yaml += `dateEnd: "${this.content.querySelector('#date-end').value}"\n`;
        }
        yaml += `fillArea: ${this.fillArea}\n`;
        yaml += `layoutMode: ${this.layoutMode}\n`;
        yaml += `stackedBars: ${this.stackedBars}\n`;
        yaml += `showStats: ${this.showStats}\n`;
        yaml += `showDonutSidebar: ${this.showDonutSidebar}\n`;
        yaml += `zoomLevel: ${this.zoomLevel}\n`;
        yaml += `autoScale: ${this.autoScale}\n`;
        yaml += `hideAxislabels: ${this.hideAxislabels}\n`;
        yaml += `hideGrid: ${this.hideGrid}\n`;
        yaml += `chartTension: ${this.chartTension}\n`;
        if (this.thresholdValue) yaml += `threshold: ${this.thresholdValue}\n`;
        if (this.thresholdValue2) yaml += `threshold2: ${this.thresholdValue2}\n`;
        if (this.gridColumns > 1) yaml += `gridColumns: ${this.gridColumns}\n`;

        yaml += `sensors:\n`;
        this.selectedSensors.forEach(s => {
            if (s.isCard) return;
            yaml += `  - entityId: ${s.entityId}\n`;
            yaml += `    color: "${s.color}"\n`;
            if (s.hidden) yaml += `    hidden: true\n`;
            if (s.alias) yaml += `    alias: "${s.alias}"\n`; // Export Alias
        });

        const jsonObject = {
            name: "Meine neue Ansicht",
            chartType: this.content.querySelector('#chart-type').value,
            timeMode: this.timeMode,
            timeSelect: this.content.querySelector('#time-select').value,
            fillArea: this.fillArea,
            stackedBars: this.stackedBars,
            showStats: this.showStats,
            layoutMode: this.layoutMode,
            gridColumns: this.gridColumns,
            zoomLevel: this.zoomLevel,
            autoScale: this.autoScale,
            threshold: this.thresholdValue,
            threshold2: this.thresholdValue2,
            hideAxislabels: this.hideAxislabels,
            hideGrid: this.hideGrid,
            chartTension: this.chartTension,
            sensors: this.selectedSensors
        };

        const jsonString = JSON.stringify(jsonObject, null, 4);
        this.content.querySelector('#yaml-export-area').value = yaml;
        this.content.querySelector('#json-export-area').value = jsonString;
        this.content.querySelector('#export-modal').style.display = 'flex';
    }

    applyZoom() {
        const scaler = this.content.querySelector('#content-scaler');
        if (scaler) {
            if (this.zoomLevel === 1.0) {
                scaler.style.transform = 'none';
                scaler.style.width = '100%';
            } else {
                scaler.style.transform = `scale(${this.zoomLevel})`;
                scaler.style.transformOrigin = 'top left';
                scaler.style.width = `calc(100% / ${this.zoomLevel})`;
            }
            scaler.style.zoom = '';
        }
    }

    handleSearch(query) {
        const list = this.content.querySelector('#suggestions');
        if (!this._allSensors || this._allSensors.length === 0) return;
        const q = query.toLowerCase();
        const matches = this._allSensors.filter(id => {
            if (id.toLowerCase().includes(q)) return true;
            const state = this._hass.states[id];
            if (state && state.attributes.friendly_name && state.attributes.friendly_name.toLowerCase().includes(q)) return true;
            return false;
        }).slice(0, 50);

        if (matches.length === 0) { list.style.display = 'none'; return; }
        list.innerHTML = '';
        matches.forEach(id => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            const name = cleanName(id);
            const state = this._hass.states[id];
            const friendly = state && state.attributes.friendly_name ? state.attributes.friendly_name : name;
            div.innerHTML = `<div class="s-name">${friendly}</div><div class="s-id">${id}</div>`;
            div.onclick = () => {
                this.content.querySelector('#sensor-input').value = id;
                list.style.display = 'none';
                this.addSensor();
            };
            list.appendChild(div);
        });
        list.style.display = 'block';
    }

    saveCurrentView() {
        if (this.selectedSensors.length === 0) { alert("Bitte erst Sensoren hinzufügen."); return; }
        const name = prompt("Name für diese LOKALE Ansicht:", "");
        if (!name) return;

        let sensorsToSave = JSON.parse(JSON.stringify(this.selectedSensors));
        if (this.chartInstances.length > 0 && (this.layoutMode === 'combined' || this.layoutMode === 'mixed')) {
            const chart = this.chartInstances[0];
            if (chart && chart.config.type !== 'doughnut') {
                chart.data.datasets.forEach((ds, idx) => {
                    const meta = chart.getDatasetMeta(idx);
                    if (sensorsToSave[idx] && !sensorsToSave[idx].isCard) {
                        if (meta.hidden === true || ds.hidden === true) {
                            sensorsToSave[idx].hidden = true;
                        }
                    }
                });
            }
        }

        const viewConfig = {
            name: name,
            sensors: sensorsToSave,
            chartType: this.content.querySelector('#chart-type').value,
            timeMode: this.timeMode,
            timeSelect: this.content.querySelector('#time-select').value,
            dateStart: this.content.querySelector('#date-start').value,
            dateEnd: this.content.querySelector('#date-end').value,
            fillArea: this.fillArea,
            layoutMode: this.layoutMode,
            gridColumns: this.gridColumns,
            stackedBars: this.stackedBars,
            showStats: this.showStats,
            showDonutSidebar: this.showDonutSidebar,
            zoomLevel: this.zoomLevel,
            autoScale: this.autoScale,
            threshold: this.thresholdValue,
            threshold2: this.thresholdValue2,
            hideAxislabels: this.hideAxislabels,
            hideGrid: this.hideGrid,
            chartTension: this.chartTension
        };
        this.savedViews.push(viewConfig);
        localStorage.setItem(this.STORAGE_KEY_VIEWS, JSON.stringify(this.savedViews));
        this.renderSavedViewsUI();
    }

    deleteSavedView(index, event) {
        if (event) event.stopPropagation();
        if (index < this.sharedViews.length) {
            alert("Globale Ansichten können nur in der JS Datei gelöscht werden.");
            return;
        }

        const localIndex = index - this.sharedViews.length;
        if (!confirm("Ansicht wirklich löschen?")) return;
        this.savedViews.splice(localIndex, 1);
        localStorage.setItem(this.STORAGE_KEY_VIEWS, JSON.stringify(this.savedViews));
        this.renderSavedViewsUI();
    }

    loadSavedView(index) {
        const allViews = [...this.sharedViews, ...this.savedViews];
        const config = allViews[index];

        if (!config) return;
        this.selectedSensors = config.sensors || [];
        this.fillArea = config.fillArea || false;
        this.layoutMode = config.layoutMode || 'combined';
        this.gridColumns = config.gridColumns || 1;
        this.timeMode = config.timeMode || 'relative';
        this.stackedBars = config.stackedBars || false;
        this.showStats = config.showStats !== undefined ? config.showStats : true;
        this.showDonutSidebar = config.showDonutSidebar || false;
        this.zoomLevel = config.zoomLevel || 1.0;
        this.autoScale = config.autoScale || false;
        this.thresholdValue = config.threshold || "";
        this.thresholdValue2 = config.threshold2 || "";
        this.chartTension = config.chartTension !== undefined ? config.chartTension : 4;
        this.hideAxislabels = config.hideAxislabels || false;
        this.hideGrid = config.hideGrid || false;

        this.content.querySelector('#chart-type').value = config.chartType || 'line';
        this.content.querySelector('#time-select').value = config.timeSelect || '24';
        if (config.dateStart) this.content.querySelector('#date-start').value = config.dateStart;
        if (config.dateEnd) this.content.querySelector('#date-end').value = config.dateEnd;

        this.content.querySelector('#fill-switch').checked = this.fillArea;
        this.content.querySelector('#layout-select').value = this.layoutMode;
        this.content.querySelector('#stacked-switch').checked = this.stackedBars;
        this.content.querySelector('#stats-switch').checked = this.showStats;
        this.content.querySelector('#donut-switch').checked = this.showDonutSidebar;
        this.content.querySelector('#grid-slider').value = this.gridColumns;
        this.content.querySelector('#grid-value-display').textContent = this.gridColumns;

        const tSlider = this.content.querySelector('#tension-slider');
        if (tSlider) tSlider.value = this.chartTension;
        const tDisp = this.content.querySelector('#tension-value-display');
        if (tDisp) tDisp.textContent = this.chartTension;

        this.content.querySelector('#zoom-slider').value = this.zoomLevel;
        this.content.querySelector('#zoom-value-display').textContent = Math.round(this.zoomLevel * 100) + '%';

        this.content.querySelector('#threshold-input').value = this.thresholdValue;
        if (this.content.querySelector('#threshold2-input')) this.content.querySelector('#threshold2-input').value = this.thresholdValue2;
        this.content.querySelector('#autoscale-switch').checked = this.autoScale;
        this.content.querySelector('#hide-axis-switch').checked = this.hideAxislabels;
        this.content.querySelector('#hide-grid-switch').checked = this.hideGrid;

        this.updateSliderVisibility();
        this.updateStackedVisibility();
        this.switchTimeMode(this.timeMode);
        this.renderSensorListUI();
        if (!this._config) this.saveSettings();
        this.loadHistory();
    }

    renderSavedViewsUI() {
        const container = this.content.querySelector('#saved-views-container');
        container.innerHTML = '';
        const allViews = [...this.sharedViews, ...this.savedViews];

        if (allViews.length === 0) {
            container.innerHTML = '<div style="font-size:12px; color:var(--secondary-text-color); padding:5px;">Keine gespeichert.</div>';
            return;
        }

        allViews.forEach((view, index) => {
            const isShared = index < this.sharedViews.length;
            const item = document.createElement('div');
            item.className = 'saved-view-item';
            if (isShared) item.classList.add('shared');

            let actionBtn = `<div class="remove-sensor" title="Löschen">✕</div>`;
            if (isShared) { actionBtn = `<div class="lock-icon" title="Globale Ansicht (in Datei)">🔒</div>`; }

            item.innerHTML = `<div class="saved-view-name">${view.name}</div>${actionBtn}`;
            item.addEventListener('click', () => this.loadSavedView(index));

            if (!isShared) { item.querySelector('.remove-sensor').addEventListener('click', (e) => this.deleteSavedView(index, e)); }
            container.appendChild(item);
        });
    }

    updateSliderVisibility() {
        const row = this.content.querySelector('#grid-slider-row');
        if (this.layoutMode !== 'combined') row.classList.add('visible');
        else row.classList.remove('visible');
        this.updateStackedVisibility();
        this.updateStatsToggleVisibility();
        this.updateDonutToggleVisibility();
    }

    updateStackedVisibility() {
        const stackedRow = this.content.querySelector('#toggle-stacked-row');
        const chartType = this.content.querySelector('#chart-type').value;
        if (chartType === 'bar' && this.layoutMode !== 'split') { stackedRow.style.display = 'flex'; } else { stackedRow.style.display = 'none'; }
    }

    updateStatsToggleVisibility() {
        const statsRow = this.content.querySelector('#toggle-stats-row');
        if (this.layoutMode !== 'split') { statsRow.style.display = 'flex'; } else { statsRow.style.display = 'none'; }
    }

    updateDonutToggleVisibility() {
        const row = this.content.querySelector('#toggle-donut-row');
        const chartType = this.content.querySelector('#chart-type').value;
        if (this.layoutMode !== 'split' && chartType !== 'doughnut') { row.style.display = 'flex'; } else { row.style.display = 'none'; }
    }

    saveSettings() {
        try {
            const settings = {
                sensors: this.selectedSensors,
                chartType: this.content.querySelector('#chart-type').value,
                timeMode: this.timeMode,
                timeSelect: this.content.querySelector('#time-select').value,
                dateStart: this.content.querySelector('#date-start').value,
                dateEnd: this.content.querySelector('#date-end').value,
                fillArea: this.fillArea,
                layoutMode: this.layoutMode,
                gridColumns: this.gridColumns,
                stackedBars: this.stackedBars,
                showStats: this.showStats,
                showDonutSidebar: this.showDonutSidebar,
                zoomLevel: this.zoomLevel,
                threshold: this.thresholdValue,
                threshold2: this.thresholdValue2,
                autoScale: this.autoScale,
                hideAxislabels: this.hideAxislabels,
                hideGrid: this.hideGrid,
                chartTension: this.chartTension
            };
            const singleContainer = this.content.querySelector('#chart-container-single');
            if (singleContainer) settings.containerHeight = singleContainer.style.height;
            localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(settings));
        } catch (e) { console.warn(e); }
    }

    loadSettings() {
        const views = localStorage.getItem(this.STORAGE_KEY_VIEWS);
        if (views) { try { this.savedViews = JSON.parse(views); } catch (e) { } }
        this.renderSavedViewsUI();

        const stored = localStorage.getItem(this.STORAGE_KEY_CONFIG);
        if (!stored) return;
        try {
            const settings = JSON.parse(stored);

            // FIX: In Card Mode (this._config is set), do not load settings from localStorage
            // as they overwrite the YAML configuration.
            if (this._config) {
                if (settings.containerHeight) this.savedContainerHeight = settings.containerHeight;
                return;
            }

            if (settings.sensors) {
                // Deduplicate logic for loaded settings
                const uniqueSensors = [];
                const seenIds = new Set();
                (settings.sensors || []).forEach(s => {
                    if (!s) return;
                    if (!s.isCard && s.entityId) {
                        if (!seenIds.has(s.entityId)) {
                            seenIds.add(s.entityId);
                            uniqueSensors.push(s);
                        }
                    } else {
                        uniqueSensors.push(s);
                    }
                });
                this.selectedSensors = uniqueSensors;
                this.renderSensorListUI();
            }
            if (settings.chartType) this.content.querySelector('#chart-type').value = settings.chartType;
            if (settings.timeSelect) this.content.querySelector('#time-select').value = settings.timeSelect;
            if (settings.dateStart) this.content.querySelector('#date-start').value = settings.dateStart;
            if (settings.dateEnd) this.content.querySelector('#date-end').value = settings.dateEnd;
            if (settings.timeMode) this.switchTimeMode(settings.timeMode);
            if (settings.fillArea !== undefined) { this.fillArea = settings.fillArea; this.content.querySelector('#fill-switch').checked = settings.fillArea; }
            if (settings.layoutMode) { this.layoutMode = settings.layoutMode; this.content.querySelector('#layout-select').value = settings.layoutMode; }
            else if (settings.splitCharts !== undefined) { this.layoutMode = settings.splitCharts ? 'split' : 'combined'; this.content.querySelector('#layout-select').value = this.layoutMode; }
            if (settings.gridColumns) { this.gridColumns = settings.gridColumns; this.content.querySelector('#grid-slider').value = settings.gridColumns; this.content.querySelector('#grid-value-display').textContent = settings.gridColumns; }
            if (settings.stackedBars !== undefined) { this.stackedBars = settings.stackedBars; this.content.querySelector('#stacked-switch').checked = settings.stackedBars; }
            if (settings.showStats !== undefined) { this.showStats = settings.showStats; this.content.querySelector('#stats-switch').checked = settings.showStats; }
            if (settings.showDonutSidebar !== undefined) { this.showDonutSidebar = settings.showDonutSidebar; this.content.querySelector('#donut-switch').checked = settings.showDonutSidebar; }
            if (settings.zoomLevel) {
                this.zoomLevel = settings.zoomLevel;
                this.content.querySelector('#zoom-slider').value = this.zoomLevel;
                this.content.querySelector('#zoom-value-display').textContent = Math.round(this.zoomLevel * 100) + '%';
            }
            if (settings.threshold) {
                this.thresholdValue = settings.threshold;
                this.content.querySelector('#threshold-input').value = settings.threshold;
            }
            if (settings.threshold2) {
                this.thresholdValue2 = settings.threshold2;
                if (this.content.querySelector('#threshold2-input')) this.content.querySelector('#threshold2-input').value = settings.threshold2;
            }
            if (settings.autoScale !== undefined) {
                this.autoScale = settings.autoScale;
                this.content.querySelector('#autoscale-switch').checked = settings.autoScale;
            }
            this.chartTension = settings.chartTension !== undefined ? settings.chartTension : 4;

            if (settings.hideAxislabels !== undefined) { this.hideAxislabels = settings.hideAxislabels; this.content.querySelector('#hide-axis-switch').checked = settings.hideAxislabels; }
            if (settings.hideGrid !== undefined) { this.hideGrid = settings.hideGrid; this.content.querySelector('#hide-grid-switch').checked = settings.hideGrid; }

            this.updateSliderVisibility();
            this.savedContainerHeight = settings.containerHeight;
        } catch (e) { localStorage.removeItem(this.STORAGE_KEY_CONFIG); }
    }

    switchTimeMode(mode) {
        this.timeMode = mode;
        const rel = this.content.querySelector('#container-relative');
        const fix = this.content.querySelector('#container-fixed');
        const bRel = this.content.querySelector('#btn-mode-relative');
        const bFix = this.content.querySelector('#btn-mode-fixed');
        if (mode === 'relative') { rel.style.display = 'block'; fix.classList.remove('visible'); bRel.classList.add('active'); bFix.classList.remove('active'); bFix.classList.remove('active'); }
        else { rel.style.display = 'none'; fix.classList.add('visible'); bRel.classList.remove('active'); bFix.classList.add('active'); }
    }

    async addSensor() {
        const input = this.content.querySelector('#sensor-input');
        const entityId = input.value.trim();
        const color = this.content.querySelector('#color-input').value;
        if (!entityId) return;
        if (this.selectedSensors.some(s => s.entityId === entityId)) { alert("Sensor ist bereits in der Liste."); return; }
        this.selectedSensors.push({ entityId, color });
        input.value = '';
        this.content.querySelector('#color-input').value = getRandomColor();
        this.renderSensorListUI();
        if (!this._config) this.saveSettings();
        if (this._globalStartTime && this._globalEndTime) {
            const loader = this.content.querySelector('#loader');
            if (loader) loader.style.display = 'block';
            try {
                const newData = await this.fetchDataSmart(entityId, this._globalStartTime, this._globalEndTime);
                this._sensorDataCache.push({ data: newData, startTime: this._globalStartTime, endTime: this._globalEndTime });
                this.updateChartFromCache();
            } catch (e) { console.error(e); this.loadHistory(); } finally { if (loader) loader.style.display = 'none'; }
        } else { this.loadHistory(); }
    }

    async importCustomCard() {
        const input = this.content.querySelector('#card-import-area');
        const val = input.value.trim();
        if (!val) return;

        let config;
        try {
            if (window.jsyaml) { config = window.jsyaml.load(val); } else { config = JSON.parse(val); }
        } catch (e) { alert("Fehler beim Parsen des Codes (YAML/JSON ungültig)."); return; }

        if (!config || !config.type) { alert("Keine gültige Card-Konfiguration (Feld 'type' fehlt)."); return; }
        const name = config.title || config.type;

        this.selectedSensors.push({ entityId: name, isCard: true, cardConfig: config, color: '#ffffff' });
        input.value = '';
        this.content.querySelector('#import-card-modal').style.display = 'none';
        this.renderSensorListUI();
        if (!this._config) this.saveSettings();
        this.updateChartFromCache();
    }

    clearAllSensors() {
        if (this.selectedSensors.length === 0) return;
        if (!confirm("Alle Sensoren aus der Liste löschen?")) return;
        this.selectedSensors = [];
        this._sensorDataCache = [];
        this.renderSensorListUI();
        if (!this._config) this.saveSettings();
        this.destroyAllCharts();
        this.content.querySelector('#main-content-area').innerHTML = '';
    }

    removeSensor(index) {
        this.selectedSensors.splice(index, 1);
        this.renderSensorListUI();
        if (!this._config) this.saveSettings();
        this.loadHistory();
    }

    reorderSensors(fromIndex, toIndex) {
        const element = this.selectedSensors.splice(fromIndex, 1)[0];
        this.selectedSensors.splice(toIndex, 0, element);
        this.saveSettings();
        this.renderSensorListUI();
        this.loadHistory();
    }

    updateSensorColor(index, newColor) {
        if (this.selectedSensors[index]) {
            this.selectedSensors[index].color = newColor;
            if (!this._config) this.saveSettings();
            if (this._sensorDataCache.length > 0) this.updateChartFromCache();
        }
    }

    // --- NEW: Rename Sensor Function ---
    renameSensor(index) {
        const currentName = this.selectedSensors[index].alias || (this.selectedSensors[index].isCard ? (this.selectedSensors[index].entityId || "Custom Card") : cleanName(this.selectedSensors[index].entityId));
        const newName = prompt("Neuer Name für den Sensor:", currentName);

        // Check if user pressed Cancel (newName is null)
        if (newName !== null) {
            this.selectedSensors[index].alias = newName.trim();
            // If empty, remove the alias to revert to default
            if (this.selectedSensors[index].alias === "") delete this.selectedSensors[index].alias;

            if (!this._config) this.saveSettings();
            this.renderSensorListUI();
            if (this._sensorDataCache.length > 0) this.updateChartFromCache();
        }
    }

    renderSensorListUI() {
        const container = this.content.querySelector('#sensor-list-container');
        if (this.selectedSensors.length === 0) { container.innerHTML = `<div style="color:var(--secondary-text-color);font-size:12px;text-align:center;padding:10px;">Liste leer.</div>`; return; }
        container.innerHTML = '';

        this.selectedSensors.forEach((sensor, index) => {
            const item = document.createElement('div');
            item.className = 'sensor-item';
            if (sensor.isCard) item.classList.add('is-card');
            item.draggable = true;
            item.dataset.index = index;

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = sensor.color;
            colorInput.className = 'sensor-list-color-picker';
            if (sensor.isCard) colorInput.style.visibility = 'hidden';
            else {
                colorInput.title = "Farbe ändern";
                colorInput.addEventListener('change', (e) => this.updateSensorColor(index, e.target.value));
                colorInput.addEventListener('click', (e) => e.stopPropagation());
                colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
            }

            const nameDiv = document.createElement('div');
            nameDiv.className = 'sensor-name';

            // --- UPDATED: Clickable name logic ---
            if (sensor.isCard) {
                nameDiv.textContent = "🎴 " + (sensor.alias || sensor.entityId || "Custom Card");
            } else {
                nameDiv.title = "Klicken zum Umbenennen: " + sensor.entityId;
                nameDiv.textContent = sensor.alias || cleanName(sensor.entityId);
            }

            // Add Click Listener for Renaming
            nameDiv.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renameSensor(index);
            });

            const removeBtn = document.createElement('div');
            removeBtn.className = 'remove-sensor';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.removeSensor(index); });
            removeBtn.addEventListener('mousedown', (e) => e.stopPropagation());

            item.appendChild(colorInput);
            item.appendChild(nameDiv);
            item.appendChild(removeBtn);

            item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', index); e.dataTransfer.effectAllowed = 'move'; item.classList.add('dragging'); });
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); container.querySelectorAll('.sensor-item').forEach(el => el.classList.remove('drag-over')); });
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); e.dataTransfer.dropEffect = 'move'; });
            item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
            item.addEventListener('drop', (e) => { e.preventDefault(); item.classList.remove('drag-over'); const fromIndex = parseInt(e.dataTransfer.getData('text/plain')); const toIndex = index; if (fromIndex !== toIndex && !isNaN(fromIndex)) { this.reorderSensors(fromIndex, toIndex); } });

            container.appendChild(item);
        });
    }

    resetZoomAll() {
        this.loadHistory();
        this.content.querySelector('#reset-zoom-btn').style.display = 'none';
    }
}

customElements.define('detailed-charts-panel', DetailedChartsPanel);

// --- REGISTER CARD IN LOVELACE PICKER ---
window.customCards = window.customCards || [];
window.customCards.push({
    type: "detailed-charts-panel",
    name: "Detailed Charts Panel",
    description: "Detaillierte Analyse-Charts mit Editor.",
    preview: true
});
