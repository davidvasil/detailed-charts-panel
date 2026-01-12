/* detailed-charts-panel.js */
console.log("DetailedChartsPanel: v_2.2");

import { 
    cleanName, 
    getRandomColor, 
    hexToRgba, 
    calculateEnergySum, 
    processData, 
    createStatsCard,
    getPanelTemplate,
    getSplitCardHTML,
    getSplitStatsHTML,
    getCombinedChartHTML,
    getCombinedDoughnutHTML,
    getSideBySideHTML
} from './detailed-charts-panel-function.js';

import { sharedViews } from './detailed-charts-views.js';

class DetailedChartsPanel extends HTMLElement {
  constructor() {
    super();
    this.selectedSensors = [];
    this.savedViews = []; 
    this.sharedViews = sharedViews || []; 
    this._sensorDataCache = []; 
    this._globalStartTime = null;
    this._globalEndTime = null;
    this.libsLoaded = false;
    this._allSensors = [];
    this._dataLoadedInit = false;
    
    this.STORAGE_KEY_CONFIG = 'detailed-charts-config';
    this.STORAGE_KEY_VIEWS = 'detailed-charts-saved-views';
    
    this.chartInstances = []; 
    
    // Settings Defaults
    this.fillArea = false;
    this.layoutMode = 'combined'; 
    this.gridColumns = 1;
    this.stackedBars = false;
    this.showStats = true; 
    this.showDonutSidebar = false;
    this.zoomLevel = 1.0;
    this.monochromeMode = false;
    this.sidebarCollapsed = false;
    this.thresholdValue = ""; 
    this.autoScale = false; 
    this.chartTension = 4; 
    
    // NEW DEFAULTS
    this.hideAxislabels = false;
    this.hideGrid = false;
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
      this._config = config;
      this.setAttribute('card-mode', '');
      
      if (!this.content) {
          this.initUI();
          this.loadDependencies();
      }

      this.selectedSensors = config.sensors || [];
      this.chartType = config.chartType || 'line';
      this.timeMode = config.timeMode || 'relative';
      this.timeSelect = config.timeSelect || '24';
      this.fillArea = (config.fillArea === true);
      
      this.layoutMode = config.layoutMode || 'combined'; 
      this.gridColumns = config.gridColumns || 1; 
      
      this.stackedBars = config.stackedBars !== undefined ? config.stackedBars : false;
      this.showStats = config.showStats !== undefined ? config.showStats : true;
      this.showDonutSidebar = config.showDonutSidebar || false;
      this.zoomLevel = config.zoomLevel || 1.0;
      this.autoScale = config.autoScale || false; 
      this.thresholdValue = config.threshold || "";
      this.chartTension = config.chartTension !== undefined ? config.chartTension : 4;
      
      // NEW CONFIG MAPPING
      this.hideAxislabels = config.hideAxislabels || false;
      this.hideGrid = config.hideGrid || false;

      if(this.content) {
          const updateInput = (id, val, isCheck = false) => {
              const el = this.content.querySelector(id);
              if(el) { 
                  if(isCheck) el.checked = val; 
                  else el.value = val; 
              }
          };

          updateInput('#chart-type', this.chartType);
          updateInput('#time-select', this.timeSelect);
          if(config.dateStart) updateInput('#date-start', config.dateStart);
          if(config.dateEnd) updateInput('#date-end', config.dateEnd);
          
          updateInput('#fill-switch', this.fillArea, true);
          updateInput('#layout-select', this.layoutMode);
          updateInput('#stacked-switch', this.stackedBars, true);
          updateInput('#grid-slider', this.gridColumns); 
          updateInput('#tension-slider', this.chartTension); 
          
          // NEW UPDATES
          updateInput('#hide-axis-switch', this.hideAxislabels, true);
          updateInput('#hide-grid-switch', this.hideGrid, true);

          const gridDisp = this.content.querySelector('#grid-value-display');
          if(gridDisp) gridDisp.textContent = this.gridColumns;
          
          const tensionDisp = this.content.querySelector('#tension-value-display');
          if(tensionDisp) tensionDisp.textContent = this.chartTension;
          
          const zoomDisp = this.content.querySelector('#zoom-value-display');
          if(zoomDisp) zoomDisp.textContent = Math.round(this.zoomLevel * 100) + '%';
          updateInput('#zoom-slider', this.zoomLevel);

          updateInput('#stats-switch', this.showStats, true);
          updateInput('#donut-switch', this.showDonutSidebar, true);
          updateInput('#autoscale-switch', this.autoScale, true);
          updateInput('#threshold-input', this.thresholdValue);
          
          this.updateSliderVisibility();
          this.updateStackedVisibility();
          this.switchTimeMode(this.timeMode);
          
          this.renderSensorListUI();
      }
      
      if (this._hass && this.libsLoaded) {
          if(this._reloadTimeout) clearTimeout(this._reloadTimeout);
          this._reloadTimeout = setTimeout(() => {
              if (this._sensorDataCache.length > 0 && !config.forceReload) {
                  this.updateChartFromCache();
              } else {
                  this.loadHistory();
              }
          }, 500);
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
          if(!this._config) this.loadSettings();
      } catch (e) {
          console.error("Critical Error", e);
          this.innerHTML = `<div style="color:red;padding:20px;">Fehler: ${e.message}</div>`;
      }
    }
    
    if (this._hass && this._hass.states && !this._allSensorsLoaded) {
        this._allSensors = Object.keys(this._hass.states)
            .filter(k => k.startsWith('sensor.') || k.startsWith('binary_sensor.') || k.startsWith('input_number.'))
            .sort();
        this._allSensorsLoaded = true;
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

    this.content.querySelector('#add-btn').addEventListener('click', () => this.addSensor());
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
        if(e.target.id === 'export-modal') {
            this.content.querySelector('#export-modal').style.display = 'none';
            this.content.querySelectorAll('.copy-success-msg').forEach(el => el.style.display = 'none');
        }
    });
    
    const handleCopy = (areaId, msgId) => {
         const txt = this.content.querySelector(areaId);
         const msg = this.content.querySelector(msgId);
         txt.select();
         txt.setSelectionRange(0, 99999); 
         
         const showSuccess = () => {
             msg.style.display = 'block';
             setTimeout(() => msg.style.display = 'none', 3000);
         };

         try {
             const successful = document.execCommand('copy');
             if(successful) showSuccess();
             else throw new Error("execCommand failed");
         } catch(err) {
             navigator.clipboard.writeText(txt.value).then(() => showSuccess())
             .catch(() => alert("Kopieren fehlgeschlagen."));
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
        if(this.shadowRoot && !e.composedPath().includes(this.content.querySelector('.control-group'))) {
            this.content.querySelector('#suggestions').style.display = 'none';
        }
    });

    const inputs = [
        '#chart-type', '#time-select', '#date-start', '#date-end', 
        '#fill-switch', '#layout-select', '#stacked-switch', 
        '#stats-switch', '#donut-switch', '#autoscale-switch',
        '#hide-axis-switch', '#hide-grid-switch' // NEW INPUTS
    ];
    inputs.forEach(id => {
        const el = this.content.querySelector(id);
        if(!el) return;
        el.addEventListener('change', (e) => {
            if (id === '#fill-switch') this.fillArea = e.target.checked;
            
            if (id === '#chart-type') {
                if (e.target.value !== 'bar') {
                    this.stackedBars = false;
                    const sw = this.content.querySelector('#stacked-switch');
                    if(sw) sw.checked = false;
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
            
            // NEW HANDLERS
            if (id === '#hide-axis-switch') this.hideAxislabels = e.target.checked;
            if (id === '#hide-grid-switch') this.hideGrid = e.target.checked;
            
            this.updateStackedVisibility();
            if(!this._config) this.saveSettings();
            
            if (this._sensorDataCache.length > 0 && (id !== '#time-select' && id !== '#date-start' && id !== '#date-end')) {
                this.updateChartFromCache();
            }
        });
    });

    const threshInput = this.content.querySelector('#threshold-input');
    threshInput.addEventListener('change', (e) => {
        this.thresholdValue = e.target.value;
        if(!this._config) this.saveSettings();
        if (this._sensorDataCache.length > 0) this.updateChartFromCache();
    });

    const zoomSlider = this.content.querySelector('#zoom-slider');
    zoomSlider.addEventListener('input', (e) => {
        this.zoomLevel = parseFloat(e.target.value);
        this.content.querySelector('#zoom-value-display').textContent = Math.round(this.zoomLevel * 100) + '%';
        this.applyZoom();
    });
    zoomSlider.addEventListener('change', (e) => {
        if(!this._config) this.saveSettings();
    });

    ['#time-select', '#date-start', '#date-end'].forEach(id => {
        this.content.querySelector(id).addEventListener('change', (e) => {
            if(!this._config) this.saveSettings(); 
            this.loadHistory(); 
        });
    });

    const gridSlider = this.content.querySelector('#grid-slider');
    gridSlider.addEventListener('input', (e) => {
        this.gridColumns = parseInt(e.target.value);
        this.content.querySelector('#grid-value-display').textContent = this.gridColumns;
    });
    gridSlider.addEventListener('change', (e) => {
        if(!this._config) this.saveSettings();
        if (this._sensorDataCache.length > 0 && this.layoutMode !== 'combined') this.updateChartFromCache();
    });
    
    // NEW TENSION SLIDER
    const tensionSlider = this.content.querySelector('#tension-slider');
    if(tensionSlider) {
        tensionSlider.addEventListener('input', (e) => {
            this.chartTension = parseInt(e.target.value);
            const disp = this.content.querySelector('#tension-value-display');
            if(disp) disp.textContent = this.chartTension;
        });
        tensionSlider.addEventListener('change', (e) => {
            if(!this._config) this.saveSettings();
            if (this._sensorDataCache.length > 0) this.updateChartFromCache();
        });
    }

    const setMode = (mode) => { this.switchTimeMode(mode); if(!this._config) this.saveSettings(); };
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
      setTimeout(() => {
         this.chartInstances.forEach(c => c.resize());
      }, 350); 
  }

  toggleMonochrome() {
      this.monochromeMode = !this.monochromeMode;
      const btn = this.shadowRoot.querySelector('#toggle-mono-btn');
      if(btn) btn.classList.toggle('active', !this.monochromeMode);

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
                      if(p.y < minVal) minVal = p.y;
                      if(p.y > maxVal) maxVal = p.y;
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
      if (this.selectedSensors.length === 0) {
          alert("Keine Sensoren ausgewählt.");
          return;
      }

      this.fillArea = this.content.querySelector('#fill-switch').checked;

      let yaml = `type: custom:detailed-charts-panel\n`;
      yaml += `chartType: ${this.content.querySelector('#chart-type').value}\n`;
      yaml += `timeMode: ${this.timeMode}\n`;
      
      if(this.timeMode === 'relative') {
          yaml += `timeSelect: "${this.content.querySelector('#time-select').value}"\n`;
      } else {
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
      
      if(this.thresholdValue) yaml += `threshold: ${this.thresholdValue}\n`;
      
      if(this.gridColumns > 1) yaml += `gridColumns: ${this.gridColumns}\n`;

      yaml += `sensors:\n`;
      this.selectedSensors.forEach(s => {
          yaml += `  - entityId: ${s.entityId}\n`;
          yaml += `    color: "${s.color}"\n`;
          if (s.hidden) yaml += `    hidden: true\n`;
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
          // FIX for OFFSET: Only apply transform if zoomLevel is NOT 1.0
          if (this.zoomLevel === 1.0) {
              scaler.style.transform = 'none';
              scaler.style.width = '100%';
          } else {
              scaler.style.transform = `scale(${this.zoomLevel})`;
              scaler.style.transformOrigin = 'top left';
              scaler.style.width = `calc(100% / ${this.zoomLevel})`;
          }
          scaler.style.zoom = ''; // Clear zoom property
      }
  }

  handleSearch(query) {
      const list = this.content.querySelector('#suggestions');
      if(!this._allSensors || this._allSensors.length === 0) return;
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

  // --- SAVED VIEWS LOGIC ---
  saveCurrentView() {
      if (this.selectedSensors.length === 0) { alert("Bitte erst Sensoren hinzufügen."); return; }
      const name = prompt("Name für diese LOKALE Ansicht:", "");
      if (!name) return;

      let sensorsToSave = JSON.parse(JSON.stringify(this.selectedSensors));
      if (this.chartInstances.length > 0 && (this.layoutMode === 'combined' || this.layoutMode === 'mixed')) {
           const chart = this.chartInstances[0]; 
           if(chart.config.type !== 'doughnut') {
               chart.data.datasets.forEach((ds, idx) => {
                   const meta = chart.getDatasetMeta(idx);
                   if (meta.hidden === true || ds.hidden === true) {
                       if(sensorsToSave[idx]) sensorsToSave[idx].hidden = true;
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
          hideAxislabels: this.hideAxislabels,
          hideGrid: this.hideGrid,
          chartTension: this.chartTension
      };
      this.savedViews.push(viewConfig);
      localStorage.setItem(this.STORAGE_KEY_VIEWS, JSON.stringify(this.savedViews));
      this.renderSavedViewsUI();
  }

  deleteSavedView(index, event) {
      if(event) event.stopPropagation();
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
      this.chartTension = config.chartTension !== undefined ? config.chartTension : 4;
      
      this.hideAxislabels = config.hideAxislabels || false;
      this.hideGrid = config.hideGrid || false;

      this.content.querySelector('#chart-type').value = config.chartType || 'line';
      this.content.querySelector('#time-select').value = config.timeSelect || '24';
      if(config.dateStart) this.content.querySelector('#date-start').value = config.dateStart;
      if(config.dateEnd) this.content.querySelector('#date-end').value = config.dateEnd;
      
      this.content.querySelector('#fill-switch').checked = this.fillArea;
      this.content.querySelector('#layout-select').value = this.layoutMode;
      this.content.querySelector('#stacked-switch').checked = this.stackedBars;
      this.content.querySelector('#stats-switch').checked = this.showStats;
      this.content.querySelector('#donut-switch').checked = this.showDonutSidebar;
      this.content.querySelector('#grid-slider').value = this.gridColumns;
      this.content.querySelector('#grid-value-display').textContent = this.gridColumns;
      
      const tSlider = this.content.querySelector('#tension-slider');
      if(tSlider) tSlider.value = this.chartTension;
      const tDisp = this.content.querySelector('#tension-value-display');
      if(tDisp) tDisp.textContent = this.chartTension;
      
      this.content.querySelector('#zoom-slider').value = this.zoomLevel;
      this.content.querySelector('#zoom-value-display').textContent = Math.round(this.zoomLevel * 100) + '%';
      
      this.content.querySelector('#threshold-input').value = this.thresholdValue;
      this.content.querySelector('#autoscale-switch').checked = this.autoScale; 
      
      this.content.querySelector('#hide-axis-switch').checked = this.hideAxislabels;
      this.content.querySelector('#hide-grid-switch').checked = this.hideGrid;

      this.updateSliderVisibility();
      this.updateStackedVisibility();
      this.switchTimeMode(this.timeMode);
      this.renderSensorListUI();
      if(!this._config) this.saveSettings();
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
          if(isShared) item.classList.add('shared');
          
          let actionBtn = `<div class="remove-sensor" title="Löschen">✕</div>`;
          if(isShared) {
              actionBtn = `<div class="lock-icon" title="Globale Ansicht (in Datei)">🔒</div>`;
          }

          item.innerHTML = `<div class="saved-view-name">${view.name}</div>${actionBtn}`;
          
          item.addEventListener('click', () => this.loadSavedView(index));
          
          if(!isShared) {
            item.querySelector('.remove-sensor').addEventListener('click', (e) => this.deleteSavedView(index, e));
          }
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

  loadDependencies() {
      const loadScript = (src) => new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Fehler bei ${src}`));
          this.content.appendChild(script);
      });
      const isModernChart = window.Chart && typeof window.Chart.getChart === 'function';
      const p1 = isModernChart ? Promise.resolve() : loadScript('/local/community/detailed-charts-panel/chart.umd.min.js');
      const p2 = window.Hammer ? Promise.resolve() : loadScript('/local/community/detailed-charts-panel/hammer.min.js');

      Promise.all([p1, p2])
        .then(() => loadScript('/local/community/detailed-charts-panel/chartjs-plugin-zoom.min.js'))
        .then(() => { 
            console.log("Libs ready."); 
            this.libsLoaded = true; 
            if(this._config) {
                 this.loadHistory();
            } else if(this.selectedSensors.length > 0) {
                 this.loadHistory();
            }
        })
        .catch(err => { console.error(err); this.showError("Fehler beim Laden der Libs."); });
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
      if (views) { try { this.savedViews = JSON.parse(views); } catch(e) {} }
      
      this.renderSavedViewsUI();

      const stored = localStorage.getItem(this.STORAGE_KEY_CONFIG);
      if (!stored) return;
      try {
          const settings = JSON.parse(stored);
          if (settings.sensors) { this.selectedSensors = settings.sensors; this.renderSensorListUI(); }
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
          if (settings.autoScale !== undefined) { 
              this.autoScale = settings.autoScale; 
              this.content.querySelector('#autoscale-switch').checked = settings.autoScale; 
          }
          this.chartTension = settings.chartTension !== undefined ? settings.chartTension : 4;
          
          // NEW LOAD LOGIC
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
      if (mode === 'relative') { rel.style.display='block'; fix.classList.remove('visible'); bRel.classList.add('active'); bFix.classList.remove('active'); bFix.classList.remove('active'); }
      else { rel.style.display='none'; fix.classList.add('visible'); bRel.classList.remove('active'); bFix.classList.add('active'); }
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
      if(!this._config) this.saveSettings();
      if (this._globalStartTime && this._globalEndTime) {
          const loader = this.content.querySelector('#loader');
          loader.style.display = 'block';
          try {
              const newData = await this.fetchDataSmart(entityId, this._globalStartTime, this._globalEndTime);
              this._sensorDataCache.push({ data: newData, startTime: this._globalStartTime, endTime: this._globalEndTime });
              this.updateChartFromCache();
          } catch (e) { console.error(e); this.loadHistory(); } finally { loader.style.display = 'none'; }
      } else { this.loadHistory(); }
  }

  clearAllSensors() {
      if (this.selectedSensors.length === 0) return;
      if (!confirm("Alle Sensoren aus der Liste löschen?")) return;
      this.selectedSensors = [];
      this._sensorDataCache = [];
      this.renderSensorListUI();
      if(!this._config) this.saveSettings();
      this.destroyAllCharts();
      this.content.querySelector('#main-content-area').innerHTML = '';
  }

  removeSensor(index) {
      this.selectedSensors.splice(index, 1);
      if (this._sensorDataCache.length > index) { this._sensorDataCache.splice(index, 1); }
      this.renderSensorListUI();
      if(!this._config) this.saveSettings();
      if (this._sensorDataCache.length > 0) { this.updateChartFromCache(); } else { this.destroyAllCharts(); this.content.querySelector('#main-content-area').innerHTML = ''; }
  }

  updateSensorColor(index, newColor) {
      if(this.selectedSensors[index]) {
          this.selectedSensors[index].color = newColor;
          if(!this._config) this.saveSettings();
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
          item.draggable = true;
          item.dataset.index = index;

          const colorInput = document.createElement('input');
          colorInput.type = 'color';
          colorInput.value = sensor.color;
          colorInput.className = 'sensor-list-color-picker';
          colorInput.title = "Farbe ändern";
          colorInput.addEventListener('change', (e) => this.updateSensorColor(index, e.target.value));
          // Prevent drag when interacting with color input
          colorInput.addEventListener('click', (e) => e.stopPropagation());
          colorInput.addEventListener('mousedown', (e) => e.stopPropagation());

          const nameDiv = document.createElement('div');
          nameDiv.className = 'sensor-name';
          nameDiv.title = sensor.entityId;
          nameDiv.textContent = cleanName(sensor.entityId);

          const removeBtn = document.createElement('div');
          removeBtn.className = 'remove-sensor';
          removeBtn.textContent = '✕';
          removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.removeSensor(index);
          });
          // Prevent drag start on remove button
          removeBtn.addEventListener('mousedown', (e) => e.stopPropagation());

          item.appendChild(colorInput);
          item.appendChild(nameDiv);
          item.appendChild(removeBtn);

          // DRAG & DROP HANDLERS
          item.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('text/plain', index);
              e.dataTransfer.effectAllowed = 'move';
              item.classList.add('dragging');
          });

          item.addEventListener('dragend', () => {
              item.classList.remove('dragging');
              container.querySelectorAll('.sensor-item').forEach(el => el.classList.remove('drag-over'));
          });

          item.addEventListener('dragover', (e) => {
              e.preventDefault();
              item.classList.add('drag-over');
              e.dataTransfer.dropEffect = 'move';
          });

          item.addEventListener('dragleave', () => {
              item.classList.remove('drag-over');
          });

          item.addEventListener('drop', (e) => {
              e.preventDefault();
              item.classList.remove('drag-over');
              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
              const toIndex = index;
              if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                  this.reorderSensors(fromIndex, toIndex);
              }
          });

          container.appendChild(item);
      });
  }

  showError(text) {
      const e = this.content.querySelector('#error-msg');
      e.innerHTML = text; e.style.display = 'block';
      this.content.querySelector('#loader').style.display = 'none';
  }

  updateChartFromCache() {
      if (!this._sensorDataCache.length) return;
      const st = this._sensorDataCache[0].startTime;
      const et = this._sensorDataCache[0].endTime;
      const chartType = this.content.querySelector('#chart-type').value;
      const dh = (et - st) / 3600000;
      if (chartType === 'scatter' && dh > 24.1) { alert("Scatter nur <= 24h."); return; }
      this.renderDispatcher(this._sensorDataCache, chartType, st, et);
  }

  async fetchDataSmart(entityId, startTime, endTime) {
      const durationHours = (endTime - startTime) / (1000 * 60 * 60);
      if (durationHours > 48) {
          try {
              const result = await this._hass.callWS({
                  type: 'recorder/statistics_during_period',
                  start_time: startTime.toISOString(),
                  end_time: endTime.toISOString(),
                  statistic_ids: [entityId],
                  period: 'hour'
              });
              if (result && result[entityId] && result[entityId].length > 0) {
                  return result[entityId].map(pt => {
                      let val = pt.mean; 
                      if (val === null || val === undefined) val = pt.state;
                      if (val === null || val === undefined) val = pt.sum;
                      return { state: val || 0, last_changed: new Date(pt.start).getTime() }; 
                  });
              }
          } catch(e) { console.warn("LTS WS failed", e); }
      }
      const data = await this._hass.callApi('GET', `history/period/${startTime.toISOString()}?end_time=${endTime.toISOString()}&filter_entity_id=${entityId}&minimal_response`);
      return (data && data.length > 0) ? data[0] : [];
  }

  async loadSpecificRange(newStart, newEnd) {
      const loader = this.content.querySelector('#loader');
      loader.style.display = 'block';
      try {
          const promises = this.selectedSensors.map(s => this.fetchDataSmart(s.entityId, newStart, newEnd));
          const results = await Promise.all(promises);
          
          if (this.layoutMode === 'mixed' || this.showDonutSidebar) {
              this._globalStartTime = newStart;
              this._globalEndTime = newEnd;
              const topChart = this.chartInstances[0];
              if(topChart) {
                  const chartType = this.content.querySelector('#chart-type').value;
                  topChart.data.datasets.forEach((ds, idx) => {
                       const conf = this.selectedSensors[idx];
                       const u = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
                       const effectiveType = this.stackedBars ? 'bar' : chartType;
                       ds.data = processData(results[idx], effectiveType, u, newStart);
                  });
                  topChart.options.scales.x.min = newStart.getTime();
                  topChart.options.scales.x.max = newEnd.getTime();
                  topChart.update();
              }
              const statsWrapper = this.content.querySelector('#stats-wrapper-top');
              if(statsWrapper) {
                  let allStatsHTML = '';
                  results.forEach((data, idx) => {
                      const conf = this.selectedSensors[idx];
                      const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
                      const effectiveType = this.stackedBars ? 'bar' : this.content.querySelector('#chart-type').value;
                      let points = processData(data, effectiveType, unit, newStart);
                      if(!points.length) return;
                      const values = points.map(p => p.y);
                      const min = Math.min(...values); const max = Math.max(...values);
                      const avg = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2);
                      const curr = values[values.length-1].toFixed(2);
                      let displayVal = curr; let displayLabel = "Aktuell";
                      const hours = (newEnd - newStart) / 3600000;
                      if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
                          const isAggregated = (effectiveType === 'bar' && hours > 24);
                          displayVal = calculateEnergySum(values, isAggregated).toFixed(2);
                          displayLabel = "Summe";
                      }
                      allStatsHTML += createStatsCard(conf, min.toFixed(2), avg, max.toFixed(2), displayVal, unit, displayLabel);
                  });
                  statsWrapper.innerHTML = allStatsHTML;
              }
              if (this.showDonutSidebar) {
                  const donutCanvas = this.shadowRoot.getElementById('canvas-side-donut');
                  if(donutCanvas) {
                      const donutChart = this.chartInstances.find(c => c.canvas.id === 'canvas-side-donut');
                      if(donutChart) {
                          let newValues = [], newLabels = [], newColors = [], units = [];
                          let totalSum = 0;
                          results.forEach((data, idx) => {
                              const conf = this.selectedSensors[idx];
                              if(!conf || conf.hidden) return;
                              const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
                              
                              const isPercent = unit === '%' || cleanName(conf.entityId).toLowerCase().includes('soc');
                              if (isPercent) return;

                              const points = processData(data, 'bar', unit, newStart);
                              const valArray = points.map(p=>p.y);
                              const isEnergy = unit && (unit.includes("Wh") || unit.includes("kWh"));
                              const hours = (newEnd - newStart) / 3600000;
                              const isDailyAgg = (hours > 24);
                              let sum = isEnergy ? calculateEnergySum(valArray, isDailyAgg) : valArray.reduce((a,b)=>a+b,0);
                              if(sum>0) {
                                  newLabels.push(cleanName(conf.entityId));
                                  newValues.push(sum);
                                  newColors.push(conf.color);
                                  units.push(unit);
                                  totalSum += sum;
                              }
                          });
                          
                          const container = this.shadowRoot.querySelector('.doughnut-sidebar');
                          if(container) {
                              const legendContainer = container.querySelector('#doughnut-legend-container');
                              if(legendContainer) {
                                  legendContainer.innerHTML = '';
                                  newLabels.forEach((label, i) => {
                                      const pct = totalSum > 0 ? ((newValues[i] / totalSum) * 100).toFixed(1) : 0;
                                      const item = document.createElement('div');
                                      item.className = 'donut-legend-item';
                                      item.innerHTML = `
                                        <div class="donut-legend-left">
                                           <div class="donut-legend-color" style="background-color:${newColors[i]}"></div>
                                           <div class="donut-legend-name" title="${label}">${label}</div>
                                        </div>
                                        <div class="donut-legend-right">${pct}%</div>
                                      `;
                                      item.onclick = () => {
                                          const meta = donutChart.getDatasetMeta(0);
                                          meta.data[i].hidden = !meta.data[i].hidden;
                                          item.classList.toggle('hidden', meta.data[i].hidden);
                                          donutChart.update();
                                      };
                                      legendContainer.appendChild(item);
                                  });
                              }
                              const totalContainer = container.querySelector('#doughnut-total-container');
                              if(totalContainer) {
                                  const u = units.length > 0 ? units[0] : '';
                                  totalContainer.innerHTML = `Gesamt: ${totalSum.toFixed(2)} ${u}`;
                              }
                          }

                          donutChart.data.labels = newLabels;
                          donutChart.data.datasets[0].data = newValues;
                          donutChart.data.datasets[0].backgroundColor = newColors;
                          donutChart.update();
                      }
                  }
              }
          } else {
               this._sensorDataCache = results.map(res => ({ data: res, startTime: newStart, endTime: newEnd }));
               this._globalStartTime = newStart; this._globalEndTime = newEnd;
               setTimeout(() => this.updateChartFromCache(), 50);
          }
      } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
  }

  async loadSingleSensorHistory(index, startTime, endTime) {
      const sensor = this.selectedSensors[index];
      if (!sensor) return;
      const loader = this.content.querySelector('#loader');
      loader.style.display = 'block';
      try {
          const newData = await this.fetchDataSmart(sensor.entityId, startTime, endTime);
          this._sensorDataCache[index] = { data: newData, startTime: startTime, endTime: endTime };
          const canvasId = `split-canvas-${index}`;
          const targetChart = this.chartInstances.find(c => c.canvas.id === canvasId);
          if (targetChart) {
              const conf = this.selectedSensors[index];
              const currentType = conf.typeOverride || this.content.querySelector('#chart-type').value;
              const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
              const points = processData(newData, currentType, unit, startTime);
              targetChart.data.datasets[0].data = points;
              targetChart.options.scales.x.min = startTime.getTime();
              targetChart.options.scales.x.max = endTime.getTime();
              targetChart.update();
              const footer = this.shadowRoot.getElementById(`footer-${index}`);
              if (footer) {
                  const values = points.map(p => p.y);
                  const min = Math.min(...values); const max = Math.max(...values);
                  const avg = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2);
                  const curr = values[values.length-1].toFixed(2);
                  let displayVal = curr; let displayLabel = "Aktuell";
                  const hours = (endTime - startTime) / 3600000;
                  if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
                      const isAggregated = (currentType === 'bar' && hours > 24);
                      displayVal = calculateEnergySum(values, isAggregated).toFixed(2);
                      displayLabel = "Summe";
                  }
                  let statsBox = footer.querySelector('.split-stats-box');
                  if(!statsBox) {
                      statsBox = document.createElement('div');
                      statsBox.className = 'split-stats-box';
                      footer.insertBefore(statsBox, footer.firstChild);
                  }
                  statsBox.innerHTML = getSplitStatsHTML(displayLabel, conf.color, displayVal, unit, min.toFixed(2), avg, max.toFixed(2));
              }
          }
      } catch (e) { console.error(e); } finally { loader.style.display = 'none'; }
  }

  async loadHistory() {
      const chartType = this.content.querySelector('#chart-type').value;
      const loader = this.content.querySelector('#loader');
      const errDiv = this.content.querySelector('#error-msg');
      errDiv.style.display = 'none';
      if (!this.libsLoaded || this.selectedSensors.length === 0) return;
      let st, et, dh;
      const now = new Date();
      if (this.timeMode === 'relative') { dh = parseInt(this.content.querySelector('#time-select').value); et = now; st = new Date(now.getTime() - (dh * 3600000)); } 
      else { st = new Date(this.content.querySelector('#date-start').value); et = new Date(this.content.querySelector('#date-end').value); dh = (et - st) / 3600000; if (st >= et) { this.showError("Enddatum muss nach Startdatum liegen."); return; } }
      if (chartType === 'scatter' && dh > 24.1) { this.showError("Scatter nur <= 24h."); return; }
      this._globalStartTime = st;
      this._globalEndTime = et;
      loader.style.display = 'block';
      this._sensorDataCache = []; 
      try {
          const promises = this.selectedSensors.map(s => this.fetchDataSmart(s.entityId, st, et));
          const results = await Promise.all(promises);
          results.forEach(res => { this._sensorDataCache.push({ data: res, startTime: st, endTime: et }); });
          this.updateChartFromCache();
      } catch (e) { console.error(e); this.showError(`Fehler: ${e.message}`); } finally { loader.style.display = 'none'; }
  }

  renderDispatcher(cacheData, globalChartType, startTime, endTime) {
      this.destroyAllCharts();
      const mainArea = this.content.querySelector('#main-content-area');
      mainArea.innerHTML = ''; 
      mainArea.className = 'main-content'; 
      mainArea.style.display = 'block';
      mainArea.style.gridTemplateColumns = '';
      mainArea.style.gap = '';
      mainArea.style.alignContent = '';

      const scaler = document.createElement('div');
      scaler.id = 'content-scaler';
      scaler.style.transform = `scale(${this.zoomLevel})`;
      scaler.style.transformOrigin = 'top left';
      scaler.style.width = `calc(100% / ${this.zoomLevel})`;
      // FIX OFFSET: Native scale at zoom 1.0
      if (this.zoomLevel === 1.0) {
          scaler.style.transform = 'none';
          scaler.style.width = '100%';
      }
      mainArea.appendChild(scaler);

      if (this.layoutMode === 'mixed') {
          const topWrap = document.createElement('div');
          topWrap.style.marginBottom = '20px';
          scaler.appendChild(topWrap); 
          this.renderCombinedView(cacheData, globalChartType, topWrap);
          const sw = topWrap.querySelector('.stats-wrapper');
          if(sw) sw.id = 'stats-wrapper-top';
          const botWrap = document.createElement('div');
          scaler.appendChild(botWrap); 
          this.renderSplitView(cacheData, globalChartType, botWrap);
      } else if (this.layoutMode === 'split') { this.renderSplitView(cacheData, globalChartType, scaler); } 
      else { this.renderCombinedView(cacheData, globalChartType, scaler); } 
  }

  destroyAllCharts() {
      if (this.chartInstances) this.chartInstances.forEach(c => c.destroy());
      this.chartInstances = [];
  }

  resetZoomAll() {
      this.loadHistory();
      this.content.querySelector('#reset-zoom-btn').style.display = 'none';
  }

  reorderSensors(fromIndex, toIndex) {
      const element = this.selectedSensors.splice(fromIndex, 1)[0];
      this.selectedSensors.splice(toIndex, 0, element);
      if(this._sensorDataCache.length > fromIndex) {
          const cached = this._sensorDataCache.splice(fromIndex, 1)[0];
          this._sensorDataCache.splice(toIndex, 0, cached);
      }
      this.saveSettings();
      this.renderSensorListUI(); 
      this.updateChartFromCache();
  }

  renderDoughnut(cacheData, ctx, statsWrapper) {
      const styles = getComputedStyle(this);
      const textColor = styles.getPropertyValue('--primary-text-color').trim();
      const labels=[], values=[], bgColors=[], units=[];
      let totalSum = 0;
      const st = this._globalStartTime || cacheData[0]?.startTime || new Date();
      const et = this._globalEndTime || cacheData[0]?.endTime || new Date();
      const hours = (et - st) / 3600000;
      const isDailyAgg = (hours > 24);

      cacheData.forEach((obj, i) => {
          const conf = this.selectedSensors[i];
          if(!conf || !obj.data.length) return;
          if(conf.hidden) return; 
          const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
          
          const isPercent = unit === '%' || cleanName(conf.entityId).toLowerCase().includes('soc');
          if (isPercent) return;
          
          const points = processData(obj.data, 'bar', unit, st); 
          const valArray = points.map(p => p.y);
          const isEnergy = unit && (unit.includes("Wh") || unit.includes("kWh"));
          let sensorSum = 0;
          if(isEnergy) { sensorSum = calculateEnergySum(valArray, isDailyAgg); } else { sensorSum = valArray.reduce((a,b)=>a+b, 0); }
          if(sensorSum > 0) {
              labels.push(cleanName(conf.entityId));
              values.push(sensorSum);
              bgColors.push(conf.color);
              units.push(unit);
              totalSum += sensorSum;
          }
      });

      const container = ctx.canvas.closest('.doughnut-container-flex');
      if(container) {
          const legendContainer = container.querySelector('#doughnut-legend-container');
          const totalContainer = container.querySelector('#doughnut-total-container');
          if(legendContainer) {
              legendContainer.innerHTML = '';
              labels.forEach((label, i) => {
                  const pct = totalSum > 0 ? ((values[i] / totalSum) * 100).toFixed(1) : 0;
                  const item = document.createElement('div');
                  item.className = 'donut-legend-item';
                  item.innerHTML = `
                    <div class="donut-legend-left">
                       <div class="donut-legend-color" style="background-color:${bgColors[i]}"></div>
                       <div class="donut-legend-name" title="${label}">${label}</div>
                    </div>
                    <div class="donut-legend-right">${pct}%</div>
                  `;
                  item.onclick = () => {
                      const meta = chart.getDatasetMeta(0);
                      meta.data[i].hidden = !meta.data[i].hidden;
                      item.classList.toggle('hidden', meta.data[i].hidden);
                      chart.update();
                  };
                  legendContainer.appendChild(item);
              });
          }
          if(totalContainer) {
              const u = units.length > 0 ? units[0] : '';
              totalContainer.innerHTML = `Gesamt: ${totalSum.toFixed(2)} ${u}`; 
              totalContainer.style.color = textColor;
          }
      }

      const chart = new window.Chart(ctx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 10 }] },
          options: {
              responsive: true, maintainAspectRatio: false, layout: { padding: 20 },
              plugins: {
                  legend: { display: false }, 
                  tooltip: { backgroundColor: 'rgba(20, 20, 20, 0.95)', callbacks: { label: (c) => { const val = c.parsed; const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : 0; return `\u00A0\u00A0${c.label}: ${c.formattedValue} ${units[c.dataIndex]} (${pct}%)`; } } }
              }
          }
      });
      this.chartInstances.push(chart);
      
      if(statsWrapper && this.layoutMode === 'combined' && this.content.querySelector('#chart-type').value === 'doughnut') {
         const u = units.length > 0 ? units[0] : '';
         statsWrapper.innerHTML = `<div style="text-align:center;width:100%;color:${textColor};padding:15px;font-size:1.5em;font-weight:bold;">Gesamt: ${totalSum.toFixed(2)} ${u}</div>`;
      }
  }

  renderCombinedView(cacheData, chartType, container) {
      const wrapper = document.createElement('div');
      if (chartType === 'doughnut') {
          wrapper.innerHTML = getCombinedDoughnutHTML();
      } else if (this.showDonutSidebar && (this.layoutMode === 'combined' || this.layoutMode === 'mixed')) {
          wrapper.innerHTML = getSideBySideHTML(this.showStats);
      } else {
          wrapper.innerHTML = getCombinedChartHTML(this.showStats);
      }
      wrapper.style.width = '100%';
      container.appendChild(wrapper);
      const chartContainer = wrapper.querySelector('#chart-container-single');
      
      if (!this.showDonutSidebar && chartType !== 'doughnut') {
           chartContainer.style.height = this.savedContainerHeight ? this.savedContainerHeight : '450px';
      }

      if (chartType !== 'doughnut') { this.initResizeHandler(wrapper.querySelector('#resize-handle'), chartContainer, wrapper.querySelector('#resize-ghost')); }
	  
      const ctx = wrapper.querySelector('#canvas-combined').getContext('2d');
      const statsWrapper = wrapper.querySelector('#stats-wrapper');

      const monoBtn = wrapper.querySelector('#toggle-mono-btn');
      if(monoBtn) {
          monoBtn.addEventListener('click', () => this.toggleMonochrome());
          if(!this.monochromeMode) monoBtn.classList.add('active');
      }

      if (chartType === 'doughnut') { this.renderDoughnut(cacheData, ctx, statsWrapper); return; }

      const datasets = [];
      let allStatsHTML = '';
      const st = this._globalStartTime || cacheData[0]?.startTime || new Date();
      const et = this._globalEndTime || cacheData[0]?.endTime || new Date();

      let hasSecondaryAxis = false;

      cacheData.forEach((sensorDataObj, idx) => {
          const conf = this.selectedSensors[idx];
          if (!conf || !sensorDataObj.data.length) return;
          let unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
          
          const useRightAxis = (unit === '%' || cleanName(conf.entityId).toLowerCase().includes('soc'));
          if (useRightAxis) hasSecondaryAxis = true;

          // --- STEPPED LOGIC FIX ---
          let effectiveType = this.stackedBars ? 'bar' : chartType;
          if (useRightAxis) effectiveType = 'line'; 
          
          let isStepped = false;
          if (effectiveType === 'stepped') {
              effectiveType = 'line';
              isStepped = true;
          }

          let points = processData(sensorDataObj.data, effectiveType, unit, st);
          if (!points.length) return;
          
          if (this.autoScale) {
             if (unit === 'W') {
                 points = points.map(p => ({x: p.x, y: p.y / 1000}));
                 unit = 'kW';
             } else if (unit === 'Wh') {
                 points = points.map(p => ({x: p.x, y: p.y / 1000}));
                 unit = 'kWh';
             }
          }

          const values = points.map(p => p.y);
          const min = Math.min(...values); const max = Math.max(...values);
          const avg = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2);
          const curr = values[values.length-1].toFixed(2);
          let displayVal = curr; let displayLabel = "AKTUELL";
          if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
              const hours = (et - st) / 3600000;
              const isAggregated = (effectiveType === 'bar' && hours > 24);
              displayVal = calculateEnergySum(values, isAggregated).toFixed(2);
              displayLabel = "SUMME";
          }
          allStatsHTML += createStatsCard(conf, min.toFixed(2), avg, max.toFixed(2), displayVal, unit, displayLabel);
          
          let dsBorderColor = conf.color;
          let dsBgColor = conf.color; 
          let dsPointRadius = (effectiveType === 'scatter') ? 4 : 0;
          let dsPointBg = conf.color;
          let dsPointBorder = conf.color;
          let dsBorderWidth = (effectiveType === 'bar') ? 0 : 2.5;

          if (this.monochromeMode && chartType !== 'doughnut') { 
              dsBorderColor = 'rgba(128, 128, 128, 0.4)';
              dsBgColor = 'transparent';
              dsBorderWidth = 1.5;
              
              let minV = Infinity, maxV = -Infinity;
              points.forEach(p => {
                  if (p.y < minV) minV = p.y;
                  if (p.y > maxV) maxV = p.y;
              });

              dsPointRadius = (ctx) => {
                  const v = ctx.parsed.y;
                  return (v === minV || v === maxV) ? 5 : 0;
              };
              dsPointBg = (ctx) => {
                  const v = ctx.parsed.y;
                  if (v === maxV) return '#f44336'; 
                  if (v === minVal) return '#2196f3'; 
                  return 'transparent';
              };
              dsPointBorder = dsPointBg;
          } else {
              if (this.fillArea && effectiveType === 'line') {
                  const grad = ctx.createLinearGradient(0, 0, 0, 400);
                  grad.addColorStop(0, hexToRgba(conf.color, 0.5));
                  grad.addColorStop(1, hexToRgba(conf.color, 0.05));
                  dsBgColor = grad;
              }
          }

          const isHidden = conf.hidden === true;
          datasets.push({ 
              label: cleanName(conf.entityId), 
              hidden: isHidden, 
              data: points, 
              borderColor: dsBorderColor, 
              backgroundColor: dsBgColor, 
              fill: this.fillArea && !this.monochromeMode, 
              borderWidth: dsBorderWidth, 
              categoryPercentage: 0.98, 
              barPercentage: 0.98, 
              pointRadius: dsPointRadius, 
              pointHoverRadius: 6, 
              pointBackgroundColor: dsPointBg, 
              pointBorderColor: dsPointBorder,
              tension: this.chartTension / 10,
              // REMOVED MONOTONE HERE TO FIX SMOOTHING
              stepped: isStepped, // FIXED: Correctly applied here
              yAxisID: useRightAxis ? 'y1' : 'y', 
              type: effectiveType 
          });
      });
      
      // THRESHOLD DATASET
      if (this.thresholdValue !== null && this.thresholdValue !== '') {
          const val = parseFloat(this.thresholdValue);
          if(!isNaN(val)) {
              datasets.push({
                  label: 'Limit',
                  data: [{x: st.getTime(), y: val}, {x: et.getTime(), y: val}],
                  borderColor: '#f44336', 
                  borderWidth: 1.5,
                  borderDash: [10, 5],
                  pointRadius: 0,
                  fill: false,
                  type: 'line',
                  yAxisID: 'y',
                  order: -1
              });
          }
      }

      if(statsWrapper) statsWrapper.innerHTML = allStatsHTML;
      
      // Use 'line' instead of 'stepped' for the chart type
      const finalChartType = (this.stackedBars ? 'bar' : (chartType === 'stepped' ? 'line' : chartType));
      
      this.createChartInstance(ctx, finalChartType, datasets, st, et, true, null, false, hasSecondaryAxis);

      if (this.showDonutSidebar && chartType !== 'doughnut') {
          const donutCanvas = wrapper.querySelector('#canvas-side-donut');
          if (donutCanvas) {
              const ctxDonut = donutCanvas.getContext('2d');
              this.renderDoughnut(cacheData, ctxDonut, null);
          }
      }
      
      if(this.monochromeMode) {
          setTimeout(() => {
              this.monochromeMode = !this.monochromeMode; 
              this.toggleMonochrome(); 
          }, 50);
      }
  }

  renderSplitView(cacheData, globalChartType, container) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'split-grid-wrapper';
      container.appendChild(gridWrapper);
      const st = this._globalStartTime || cacheData[0]?.startTime || new Date();
      const et = this._globalEndTime || cacheData[0]?.endTime || new Date();
      const hours = (et - st) / 3600000;

      cacheData.forEach((sensorDataObj, idx) => {
          const conf = this.selectedSensors[idx];
          if (!conf || !sensorDataObj.data.length) return;
          
          const card = document.createElement('div');
          card.className = 'split-chart-card';
          card.dataset.index = idx; 
          const pct = 99 / this.gridColumns;
          card.style.flex = `1 1 calc(${pct}% - 20px)`;
          card.style.minWidth = '250px'; 
          const canvasId = `split-canvas-${idx}`;
          
          card.innerHTML = getSplitCardHTML(idx, conf.color, cleanName(conf.entityId));
          gridWrapper.appendChild(card);
          
          const handle = card.querySelector('.drag-handle');
          handle.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('text/plain', idx);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setDragImage(card, 0, 0); 
              card.classList.add('dragging');
          });
          handle.addEventListener('dragend', () => {
              card.classList.remove('dragging');
              this.shadowRoot.querySelectorAll('.split-chart-card').forEach(c => c.classList.remove('drag-over'));
          });
          card.addEventListener('dragover', (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              card.classList.add('drag-over');
          });
          card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
          card.addEventListener('drop', (e) => {
              e.preventDefault();
              const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
              const toIndex = idx;
              if (fromIndex !== toIndex) { this.reorderSensors(fromIndex, toIndex); }
          });

          let currentType = conf.typeOverride || globalChartType;
          let unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
          
          // STEPPED LOGIC FOR SPLIT
          let isStepped = false;
          if (currentType === 'stepped') { currentType = 'line'; isStepped = true; }

          let points = processData(sensorDataObj.data, currentType, unit, st);
          
          if (this.autoScale) {
             if (unit === 'W') {
                 points = points.map(p => ({x: p.x, y: p.y / 1000}));
                 unit = 'kW';
             } else if (unit === 'Wh') {
                 points = points.map(p => ({x: p.x, y: p.y / 1000}));
                 unit = 'kWh';
             }
          }

          const values = points.map(p => p.y);
          const min = Math.min(...values); const max = Math.max(...values);
          const avg = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2);
          const curr = values[values.length-1].toFixed(2);
          let displayVal = curr; let displayLabel = "Aktuell";
          if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
              const isAggregated = (currentType === 'bar' && hours > 24);
              displayVal = calculateEnergySum(values, isAggregated).toFixed(2);
              displayLabel = "Summe";
          }

          const footer = card.querySelector(`#footer-${idx}`);
          footer.querySelector('.split-stats-box').innerHTML = getSplitStatsHTML(displayLabel, conf.color, displayVal, unit, min.toFixed(2), avg, max.toFixed(2));
          
          const controlsBox = document.createElement('div');
          controlsBox.className = 'split-controls-box';
          const btnLine = document.createElement('button');
          btnLine.className = `chart-toggle-btn ${currentType === 'line' ? 'active' : ''}`; btnLine.title = "Line";
          btnLine.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z"></path></svg>`;
          const btnBar = document.createElement('button');
          btnBar.className = `chart-toggle-btn ${currentType === 'bar' ? 'active' : ''}`; btnBar.title = "Bar";
          btnBar.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z"></path></svg>`;
          const btnScatter = document.createElement('button');
          btnScatter.className = `chart-toggle-btn ${currentType === 'scatter' ? 'active' : ''}`; btnScatter.title = "Scatter";
          btnScatter.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M11 6C11 4.9 10.1 4 9 4S7 4.9 7 6 7.9 8 9 8 11 7.1 11 6M5 13C3.9 13 3 13.9 3 15S3.9 17 5 17 7 16.1 7 15 6.1 13 5 13M13 11C11.9 11 11 10.1 11 9S11.9 7 13 7 15 7.9 15 9 14.1 11 13 11M16 15C14.9 15 14 15.9 14 17S14.9 19 16 19 18 18.1 18 17 17.1 15 16 15M20 20H4V4H2V22H22V20Z"></path></svg>`;

          controlsBox.appendChild(btnLine); controlsBox.appendChild(btnBar); controlsBox.appendChild(btnScatter);
          footer.appendChild(controlsBox);

          const ctx = card.querySelector(`#${canvasId}`).getContext('2d');
          
          const updateThisChart = (newType) => {
              this.selectedSensors[idx].typeOverride = newType;
              this.saveSettings();
              btnLine.className = `chart-toggle-btn ${newType === 'line' ? 'active' : ''}`;
              btnBar.className = `chart-toggle-btn ${newType === 'bar' ? 'active' : ''}`;
              btnScatter.className = `chart-toggle-btn ${newType === 'scatter' ? 'active' : ''}`;
              const chartIdx = this.chartInstances.findIndex(c => c.canvas === card.querySelector('canvas'));
              if (chartIdx > -1) { this.chartInstances[chartIdx].destroy(); this.chartInstances.splice(chartIdx, 1); }
              
              let newPoints = processData(sensorDataObj.data, newType, unit, sensorDataObj.startTime);
              
              if (this.autoScale) {
                 if (unit === 'W' || unit === 'kW') newPoints = newPoints.map(p => ({x: p.x, y: p.y / 1000}));
                 if (unit === 'Wh' || unit === 'kWh') newPoints = newPoints.map(p => ({x: p.x, y: p.y / 1000}));
              }

              let bg = conf.color;
              if (this.fillArea && newType === 'line') {
                  const grad = ctx.createLinearGradient(0, 0, 0, 300);
                  grad.addColorStop(0, hexToRgba(conf.color, 0.5));
                  grad.addColorStop(1, hexToRgba(conf.color, 0.05));
                  bg = grad;
              }
              const pRadius = (newType === 'scatter') ? 4 : 0;
              const dataset = { 
                  label: cleanName(conf.entityId), 
                  data: newPoints, 
                  borderColor: conf.color, 
                  backgroundColor: bg, 
                  fill: this.fillArea, 
                  borderWidth: (newType === 'bar') ? 0 : 2.5, 
                  categoryPercentage: 0.98, 
                  barPercentage: 0.98, 
                  pointRadius: pRadius, 
                  pointHoverRadius: 6, 
                  pointBackgroundColor: conf.color, 
                  tension: this.chartTension / 10,
                  // REMOVED MONOTONE HERE TO FIX SMOOTHING
                  stepped: isStepped 
              };
              this.createChartInstance(ctx, newType, [dataset], sensorDataObj.startTime, sensorDataObj.endTime, false, idx, true);
          };
          btnLine.onclick = () => updateThisChart('line');
          btnBar.onclick = () => updateThisChart('bar');
          btnScatter.onclick = () => updateThisChart('scatter');
          
          // ADDED GRADIENT LOGIC HERE
          let bg = conf.color;
          if (this.fillArea && currentType === 'line') {
              const grad = ctx.createLinearGradient(0, 0, 0, 300);
              grad.addColorStop(0, hexToRgba(conf.color, 0.5));
              grad.addColorStop(1, hexToRgba(conf.color, 0.05));
              bg = grad;
          }

          const dataset = { 
              label: cleanName(conf.entityId), 
              data: points, 
              borderColor: conf.color, 
              backgroundColor: bg, // Changed from conf.color to bg
              fill: this.fillArea, 
              borderWidth: (currentType === 'bar') ? 0 : 2.5, 
              pointRadius: (currentType === 'scatter' ? 4 : 0),
              tension: this.chartTension / 10,
              stepped: isStepped 
          };
          this.createChartInstance(ctx, currentType, [dataset], st, et, false, idx, true);
      });
  }

  createChartInstance(ctx, type, datasets, startTime, endTime, showZoomBtn, sensorIndex, hideLegend, hasSecondaryAxis) {
      const styles = getComputedStyle(this);
      const textColor = styles.getPropertyValue('--primary-text-color').trim();
      const gridColor = styles.getPropertyValue('--divider-color').trim();
      const secondaryText = styles.getPropertyValue('--secondary-text-color').trim();
      const resetBtn = this.content.querySelector('#reset-zoom-btn');

      // --- CUSTOM TOOLTIP POSITIONER (STATIC TOP RIGHT) ---
      if (window.Chart && !window.Chart.Tooltip.positioners.fixedTopRight) {
          window.Chart.Tooltip.positioners.fixedTopRight = function(elements, eventPosition) {
              const chart = this.chart;
              return {
                  x: chart.chartArea.right,
                  y: chart.chartArea.top
              };
          };
      }

      // --- CUSTOM PLUGIN: VERTICAL HOVER LINE ---
      const verticalHoverLine = {
          id: 'verticalHoverLine',
          afterDraw: (chart) => {
              if (chart.tooltip?._active?.length) {
                  const activePoint = chart.tooltip._active[0];
                  const ctx = chart.ctx;
                  
                  // Use element.x directly from the active point. 
                  const x = activePoint.element.x;
                  
                  const topY = chart.chartArea.top;
                  const bottomY = chart.chartArea.bottom;

                  ctx.save();
                  ctx.beginPath();
                  ctx.moveTo(x, topY);
                  ctx.lineTo(x, bottomY);
                  ctx.lineWidth = 1;
                  // Use accent color from styles or fallback to blue
                  ctx.strokeStyle = styles.getPropertyValue('--accent-color').trim() || '#03a9f4';
                  ctx.setLineDash([5, 5]); // Dashed line
                  ctx.globalAlpha = 0.6;   // Slightly transparent
                  ctx.stroke();
                  ctx.restore();
              }
          }
      };

      const chart = new window.Chart(ctx, {
          type: type === 'stepped' ? 'line' : type,
          data: { datasets },
          plugins: [verticalHoverLine], // Plugin registered here
          options: {
              responsive: true, maintainAspectRatio: false,
              animation: { duration: 0 }, // Disable initial animation for snap
              hover: { animationDuration: 0 }, // Disable hover animation for snap
              interaction: { 
                 mode: 'x',        // Shows all items at same X position
                 intersect: false
              }, 
              plugins: {
                  legend: { 
                      display: !hideLegend, position: 'top', align: 'end', 
                      labels: { color: textColor, usePointStyle: true, boxWidth: 8, boxPadding: 6, padding: 15, generateLabels: (chart) => { const original = Chart.defaults.plugins.legend.labels.generateLabels(chart); original.forEach(label => { label.text = '\u00A0\u00A0' + label.text; }); return original; } } 
                  },
                  tooltip: {
                      // STATIC POSITION CONFIG
                      position: 'fixedTopRight',
                      xAlign: 'right',
                      yAlign: 'top',
                      
                      backgroundColor: 'rgba(20, 20, 20, 0.95)', titleColor: '#fff', bodyColor: '#bbb', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12,
                      callbacks: {
                          title: (c) => new Date(c[0].parsed.x).toLocaleString('de-DE'), 
                          label: (c) => {
                              const lbl = c.dataset.label || '';
                              let unit = this._hass.states[this.selectedSensors.find(s=>cleanName(s.entityId)===lbl)?.entityId]?.attributes?.unit_of_measurement||'';
                              const val = c.parsed.y;
                              if(lbl === 'Limit') return `\u00A0\u00A0Limit: ${val}`;
                              
                              if (this.autoScale) {
                                  if (unit === 'W') unit = 'kW';
                                  if (unit === 'Wh') unit = 'kWh';
                              }

                              return `\u00A0\u00A0${lbl}: ${c.formattedValue} ${unit}`;
                          }
                      }
                  },
                  zoom: {
                      pan: { enabled: true, mode: 'x', 
                             onPan: () => { if(showZoomBtn) resetBtn.style.display = 'block'; },
                             onPanComplete: ({chart}) => { 
                                 const min = chart.scales.x.min;
                                 const max = chart.scales.x.max;
                                 chart.stop();
                                 if (this.layoutMode !== 'combined' && sensorIndex !== null) {
                                     this.loadSingleSensorHistory(sensorIndex, new Date(min), new Date(max));
                                 } else {
                                     if (min < startTime.getTime() || max > endTime.getTime()) {
                                         this.loadSpecificRange(new Date(min), new Date(max));
                                     }
                                 }
                             } 
                      },
                      zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', onZoom: () => { if(showZoomBtn) resetBtn.style.display = 'block'; } }
                  }
              },
              scales: {
                  x: {
                      type: 'linear', position: 'bottom', min: startTime.getTime(), max: endTime.getTime(), stacked: this.stackedBars, offset: false, 
                      ticks: { 
                          display: !this.hideAxislabels, // NEW FEATURE
                          color: secondaryText, maxTicksLimit: 8, 
                          callback: function(value) { const d = new Date(value); const diffHours = (endTime - startTime) / (1000 * 60 * 60); if (diffHours > 48) return d.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}); return d.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}); } 
                      },
                      grid: { 
                          color: gridColor, drawBorder: false, 
                          display: !this.hideGrid // NEW FEATURE (Note: might need customization based on chartjs version, typically display: false hides grid lines)
                      } 
                  },
                  y: { 
                      type: 'linear',
                      position: 'left',
                      stacked: this.stackedBars, 
                      grace: '5%', 
                      ticks: { 
                          display: !this.hideAxislabels, // NEW FEATURE
                          color: secondaryText 
                      }, 
                      grid: { 
                          color: gridColor, borderDash: [5, 5],
                          display: !this.hideGrid // NEW FEATURE
                      } 
                  },
                  y1: {
                      type: 'linear',
                      display: !!hasSecondaryAxis, 
                      position: 'right',
                      grid: { drawOnChartArea: false }, 
                      ticks: { 
                          display: !this.hideAxislabels, // NEW FEATURE
                          color: secondaryText, callback: function(value) { return value + '%'; } 
                      } 
                  }
              }
          }
      });
      this.chartInstances.push(chart);
  }

  initResizeHandler(handle, container, ghost) {
      if(!handle || !container || !ghost) return;
      let startY, startHeight;
      const doDrag = (e) => {
          const clientY = e.clientY || e.touches[0].clientY;
          let newHeight = startHeight + (clientY - startY);
          if (newHeight < 200) newHeight = 200; if (newHeight > 1500) newHeight = 1500;
          ghost.style.top = (container.offsetTop + newHeight) + 'px';
          ghost.style.display = 'block';
          ghost.dataset.targetHeight = newHeight;
      };
      const stopDrag = () => {
          document.documentElement.removeEventListener('mousemove', doDrag);
          document.documentElement.removeEventListener('mouseup', stopDrag);
          document.documentElement.removeEventListener('touchmove', doDrag);
          document.documentElement.removeEventListener('touchend', stopDrag);
          ghost.style.display = 'none';
          if (ghost.dataset.targetHeight) {
              container.style.height = ghost.dataset.targetHeight + 'px';
              this.saveSettings();
          }
      };
      const startDrag = (e) => {
          startY = e.clientY || e.touches[0].clientY;
          startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
          ghost.style.top = (container.offsetTop + startHeight) + 'px';
          ghost.dataset.targetHeight = startHeight;
          ghost.style.display = 'block';
          document.documentElement.addEventListener('mousemove', doDrag);
          document.documentElement.addEventListener('mouseup', stopDrag);
          document.documentElement.addEventListener('touchmove', doDrag);
          document.documentElement.addEventListener('touchend', stopDrag);
          e.preventDefault();
      };
      handle.addEventListener('mousedown', startDrag);
      handle.addEventListener('touchstart', startDrag);
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
