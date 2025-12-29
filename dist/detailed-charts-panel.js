console.log("DetailedChartsPanel: v_1.3");

class DetailedChartsPanel extends HTMLElement {
  constructor() {
    super();
    this.selectedSensors = [];
    this.savedViews = [];
    this._sensorDataCache = []; 
    this._globalStartTime = null;
    this._globalEndTime = null;
    this.libsLoaded = false;
    this._allSensors = [];
    
    this.STORAGE_KEY_CONFIG = 'detailed-charts-config';
    this.STORAGE_KEY_VIEWS = 'detailed-charts-saved-views';
    
    this.chartInstances = []; 
    
    // Settings
    this.fillArea = false;
    this.layoutMode = 'combined'; 
    this.gridColumns = 1;
    this.stackedBars = false;
    this.showStats = true; 
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      try {
          this.initUI();
          this.loadDependencies();
          this.loadSettings();
      } catch (e) {
          console.error("Critical Error", e);
          this.innerHTML = `<div style="color:red;padding:20px;">Fehler: ${e.message}</div>`;
      }
    }
    if (this._hass && this._hass.states) {
        this._allSensors = Object.keys(this._hass.states)
            .filter(k => k.startsWith('sensor.') || k.startsWith('binary_sensor.') || k.startsWith('input_number.'))
            .sort();
    }
  }

  initUI() {
    const root = this.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        :host {
          display: block; height: 100vh;
          background-color: var(--primary-background-color);
          color: var(--primary-text-color);
          font-family: 'Roboto', 'Segoe UI', sans-serif;
          --sidebar-width: 320px;
          --accent-color: var(--primary-color, #03a9f4);
          --btn-color: #616161; 
        }
        /* GLOBAL BOX SIZING FIX */
        * { box-sizing: border-box; }

        .container { display: flex; height: 100%; overflow: hidden; }
        
        /* SIDEBAR */
        .sidebar { 
            width: var(--sidebar-width); min-width: var(--sidebar-width); 
            background-color: var(--card-background-color); 
            border-right: 1px solid var(--divider-color); 
            padding: 20px; display: flex; flex-direction: column; gap: 15px; 
            box-shadow: 2px 0 10px rgba(0,0,0,0.1); z-index: 10; overflow-y: auto; 
        }
        h2 { margin: 0 0 10px 0; font-weight: 300; letter-spacing: 1px; font-size: 1.5em; }
        label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 4px; display: block; letter-spacing: 0.5px; }
        .control-group { margin-bottom: 5px; position: relative; }
        
        input, select { 
            padding: 12px 10px; border-radius: 4px; border: 1px solid var(--divider-color); 
            background: var(--primary-background-color); color: var(--primary-text-color); 
            font-family: inherit; font-size: 14px; width: 100%; outline: none; 
            transition: border-color 0.2s, box-shadow 0.2s; -webkit-appearance: none; appearance: none;
        }
        input:focus, select:focus { border-color: var(--accent-color); }

        /* CUSTOM SEARCH DROPDOWN */
        .suggestions-list {
            position: absolute; top: 100%; left: 0; right: 0;
            background: var(--secondary-background-color, #2c2c2c); 
            border: 1px solid var(--divider-color);
            border-radius: 4px; max-height: 300px; overflow-y: auto; z-index: 100;
            display: none; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .suggestion-item {
            padding: 10px; border-bottom: 1px solid var(--divider-color); cursor: pointer;
            transition: background 0.2s;
        }
        .suggestion-item:hover { background: rgba(255, 255, 255, 0.1); }
        .s-name { font-weight: 500; font-size: 14px; color: var(--primary-text-color); }
        .s-id { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }

        .add-sensor-row { display: flex; gap: 8px; align-items: center; }
        .color-picker { width: 44px; height: 44px; padding: 2px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--primary-background-color); cursor: pointer; }
        .btn-icon { width: 44px; height: 44px; background: var(--btn-color); color: white; border: none; border-radius: 4px; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
        .btn-icon:hover { background-color: #757575; }
        .btn-icon.grey { background-color: #757575; }
        .btn-icon.grey:hover { background-color: #616161; }

        /* SENSOR LIST - INCREASED HEIGHT & HIDDEN SCROLLBAR */
        .sensor-list { 
            display: flex; flex-direction: column; gap: 8px; 
            max-height: 230px; /* INCREASED HEIGHT */
            overflow-y: auto; 
            padding: 5px 0; margin-bottom: 10px; 
            border-top: 1px solid var(--divider-color); padding-top: 15px; 
            scrollbar-width: none; 
        }
        .sensor-list::-webkit-scrollbar { display: none; }

        .sensor-item { display: flex; align-items: center; gap: 10px; background: rgba(128, 128, 128, 0.1); padding: 8px; border-radius: 4px; font-size: 13px; }
        .sensor-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
        .sensor-name { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .remove-sensor { cursor: pointer; color: var(--error-color, #f44336); font-weight: bold; padding: 0 8px; }

        .saved-views-section { margin-top: 20px; border-top: 1px solid var(--divider-color); padding-top: 15px; }
        .saved-view-item { 
            display: flex; align-items: center; gap: 10px; background: rgba(128, 128, 128, 0.1); 
            padding: 10px; border-radius: 4px; font-size: 13px; margin-bottom: 8px; cursor: pointer;
            transition: background 0.2s; border: 1px solid transparent;
        }
        .saved-view-item:hover { background: rgba(128, 128, 128, 0.2); border-color: var(--divider-color); }
        .saved-view-name { flex-grow: 1; font-weight: 500; }

        .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; cursor: pointer; }
        .toggle-label { font-size: 14px; color: var(--primary-text-color); }
        .toggle-switch { 
            appearance: none; -webkit-appearance: none; width: 40px; height: 24px; flex-shrink: 0;
            background: rgba(120, 120, 128, 0.3); border-radius: 12px; position: relative; cursor: pointer; outline: none; border: none; transition: background 0.25s;
        }
        .toggle-switch:checked { background: var(--accent-color); }
        .toggle-switch::after { 
            content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: white; border-radius: 50%; transition: transform 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.4); 
        }
        .toggle-switch:checked::after { transform: translateX(16px); }

        .slider-row { margin-top: 15px; border-top: 1px solid var(--divider-color); padding-top: 15px; display: none; }
        .slider-row.visible { display: block; }
        .slider-header { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; background: var(--divider-color); border-radius: 3px; outline: none; padding: 0; border: none; margin-top: 5px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-color); cursor: pointer; transition: transform 0.1s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }

        .mode-switch { display: flex; gap: 0; margin-bottom: 10px; border: 1px solid var(--divider-color); border-radius: 4px; overflow: hidden; }
        .mode-btn { flex: 1; padding: 10px; font-size: 13px; text-align: center; cursor: pointer; background: var(--card-background-color); color: var(--secondary-text-color); transition: all 0.2s; font-weight: 500; }
        .mode-btn:first-child { border-right: 1px solid var(--divider-color); }
        .mode-btn.active { background: var(--btn-color); color: white; }

        .custom-date-container { display: none; flex-direction: column; gap: 10px; }
        .custom-date-container.visible { display: flex; }

        #load-btn { background-color: var(--btn-color); color: white; cursor: pointer; font-weight: 500; border: none; margin-top: 20px; padding: 15px; font-size: 14px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1.25px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: background-color 0.2s; }
        #load-btn:hover { background-color: #757575; }
        
        #reset-zoom-btn { background-color: var(--card-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); margin-top: 10px; padding: 8px; font-size: 12px; width: 100%; border-radius: 4px; cursor: pointer; display: none; }

        .main-content { flex-grow: 1; padding: 40px; display: flex; flex-direction: column; background-color: var(--primary-background-color); overflow-y: auto; position: relative; }
        
        /* AUTO GRID for Stats */
        .stats-wrapper { 
            margin-top: 20px; 
            display: flex; flex-wrap: wrap; gap: 15px; 
        }
        
        .stats-card { 
            padding: 10px 15px; background: var(--card-background-color); border-left: 5px solid transparent; 
            border-radius: 4px; font-size: 0.9rem; box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            border: 1px solid var(--divider-color); border-left-width: 5px;
            display: flex; flex-direction: column; gap: 2px;
            /* Max 5 per row logic */
            flex: 1 1 calc(19% - 15px);
            min-width: 200px;
        }

        .stats-header { 
            font-weight: bold; color: var(--primary-text-color); 
            margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid var(--divider-color);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
        }
        
        /* CLASSIC DIVIDER ROW STYLE */
        .stats-row { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 3px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.1);
        }
        .stats-row:last-child { border-bottom: none; }
        
        .stats-row span:first-child { color: var(--secondary-text-color); text-transform: uppercase; font-size: 0.8em; font-weight: 500; }
        .stats-row span:last-child { font-weight: 700; color: var(--primary-text-color); }
        .stats-main-val { font-size: 1.0em; color: var(--primary-text-color); font-weight: bold; }

        .chart-container-outer { width: 100%; height: 450px; min-height: 200px; position: relative; background: var(--card-background-color); border-radius: 8px; padding: 15px; box-sizing: border-box; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid var(--divider-color); display: flex; flex-direction: column; }
        .canvas-wrapper { flex-grow: 1; position: relative; width: 100%; height: 100%; overflow: hidden; }
        #resize-handle { height: 14px; width: 100%; background: var(--card-background-color); cursor: ns-resize; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--divider-color); margin-top: 5px; }
        .grip-lines { width: 30px; height: 3px; border-top: 1px solid var(--secondary-text-color); border-bottom: 1px solid var(--secondary-text-color); opacity: 0.5; }
        #resize-ghost { position: absolute; left: 40px; right: 40px; height: 4px; background-color: var(--accent-color); opacity: 0.5; z-index: 100; display: none; pointer-events: none; cursor: ns-resize; }
        
        /* FLEX SPLIT WRAPPER */
        .split-grid-wrapper { 
            display: flex; flex-wrap: wrap; gap: 20px; width: 100%; 
        }

        .split-chart-card {
            background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px; padding: 15px; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 0; height: fit-content;
            flex-grow: 1;
        }
        .split-chart-header { font-weight: bold; font-size: 1.1em; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        .split-canvas-container { height: 300px; position: relative; width: 100%; }
        .split-footer { display: flex; gap: 20px; margin-top: 10px; align-items: stretch; border-top: 1px solid var(--divider-color); padding-top: 15px; }
        .split-stats-box { flex-grow: 1; background: transparent; border-radius: 0; padding: 5px 0; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; text-align: center; border: none; }
        .split-controls-box { width: 120px; display: flex; flex-direction: column; gap: 5px; justify-content: center; border-left: 1px solid var(--divider-color); padding-left: 15px; }
        .chart-toggle-btn { background: transparent; border: 1px solid var(--divider-color); color: var(--secondary-text-color); padding: 6px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; }
        .chart-toggle-btn:hover { background: rgba(0,0,0,0.05); color: var(--primary-text-color); }
        .chart-toggle-btn.active { background: var(--btn-color); color: white; border-color: var(--btn-color); }

        .stat-value { font-size: 1.2em; font-weight: 700; color: var(--primary-text-color); }
        .stat-label { font-size: 0.8em; color: var(--secondary-text-color); text-transform: uppercase; }
        .stat-current { font-size: 1.1em; font-weight: bold; }
        .stat-unit { font-size: 0.7em; font-weight: normal; opacity: 0.8; }
        
        .loader { border: 3px solid rgba(0,0,0,0.1); border-top: 3px solid var(--accent-color); border-radius: 50%; width: 24px; height: 24px; animation: spin 0.8s linear infinite; margin: 10px auto; display: none; }
        .error-msg { color: #f44336; background: rgba(244, 67, 54, 0.1); padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 13px; display: none; border: 1px solid rgba(244, 67, 54, 0.3); }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>

      <div class="container">
        <div class="sidebar">
          <h2>📉 Detailed Charts</h2>
          
          <div class="control-group">
            <label>Sensor hinzufügen:</label>
            <input id="sensor-input" placeholder="Tippen zum Suchen..." autocomplete="off">
            <div id="suggestions" class="suggestions-list"></div>
          </div>
          
          <div class="control-group add-sensor-row">
             <input type="color" id="color-input" class="color-picker" value="#03a9f4" title="Farbe wählen">
             <button id="add-btn" class="btn-icon" title="Hinzufügen">+</button>
             <button id="clear-all-btn" class="btn-icon grey" title="Alles löschen">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
             </button>
             <button id="save-view-btn" class="btn-icon" style="margin-left:auto;" title="Ansicht speichern">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
                </svg>
             </button>
          </div>

          <div id="sensor-list-container" class="sensor-list">
             <div style="color: var(--secondary-text-color); font-size: 12px; text-align: center; padding: 10px;">Liste leer.</div>
          </div>
          
          <div style="margin-top: 20px; border-top: 1px solid var(--divider-color); padding-top: 15px;">
              <div class="toggle-row" id="toggle-fill-row">
                  <span class="toggle-label">Fläche füllen</span>
                  <input type="checkbox" class="toggle-switch" id="fill-switch">
              </div>
              
              <div class="control-group" style="margin-top:10px;">
                  <label>Ansicht (Layout)</label>
                  <select id="layout-select">
                      <option value="combined" selected>Kombiniert</option>
                      <option value="split">Getrennt (Grid)</option>
                      <option value="mixed">Mixed (Beides)</option>
                  </select>
              </div>

              <div class="toggle-row" id="toggle-stats-row" style="margin-top: 10px;">
                  <span class="toggle-label">Statistiken anzeigen</span>
                  <input type="checkbox" class="toggle-switch" id="stats-switch" checked>
              </div>

              <div class="slider-row" id="grid-slider-row">
                  <div class="slider-header">
                      <label>Spalten (Grid)</label>
                      <span id="grid-value-display" style="font-weight:bold;">1</span>
                  </div>
                  <input type="range" id="grid-slider" min="1" max="4" step="1" value="1">
              </div>
              
              <div class="toggle-row" id="toggle-stacked-row" style="margin-top: 10px; display:none;">
                  <span class="toggle-label">Stacked Bars</span>
                  <input type="checkbox" class="toggle-switch" id="stacked-switch">
              </div>
          </div>

          <div class="control-group" style="margin-top: 15px;">
            <label>Darstellung (Global):</label>
            <select id="chart-type">
                <option value="line" selected>Line (Kurve)</option>
                <option value="bar">Bar (Balken)</option>
                <option value="doughnut">Donut (Verteilung)</option>
                <option value="stepped">Stepped (Stufen)</option>
                <option value="scatter">Scatter (Punkte)</option>
            </select>
          </div>
          
          <label style="margin-top:15px;">Zeitraum Modus:</label>
          <div class="mode-switch">
              <div class="mode-btn active" id="btn-mode-relative">Relativ</div>
              <div class="mode-btn" id="btn-mode-fixed">Kalender</div>
          </div>

          <div id="container-relative" class="control-group">
            <select id="time-select">
                <option value="1">Letzte 1 Stunde</option>
                <option value="3">Letzte 3 Stunden</option>
                <option value="6">Letzte 6 Stunden</option>
                <option value="12">Letzte 12 Stunden</option>
                <option value="24" selected>Letzte 24 Stunden</option>
                <option value="48">Letzte 48 Stunden</option>
                <option value="168">Letzte 7 Tage</option>
                <option value="720">Letzte 30 Tage (Monat)</option>
                <option value="2160">Letzte 3 Monate</option>
                <option value="8760">Letztes Jahr</option>
            </select>
          </div>

          <div id="container-fixed" class="custom-date-container">
             <div><label>Von:</label><input type="datetime-local" id="date-start"></div>
             <div><label>Bis:</label><input type="datetime-local" id="date-end"></div>
          </div>

          <button id="load-btn">Daten laden</button>
          <button id="reset-zoom-btn">🔍 Zoom zurücksetzen</button>
          
          <div class="saved-views-section">
             <label>Gespeicherte Ansichten</label>
             <div id="saved-views-container">
                </div>
          </div>

          <div class="loader" id="loader"></div>
          <div class="error-msg" id="error-msg"></div>
        </div>

        <div class="main-content" id="main-content-area"></div>
      </div>
    `;

    this.content = root;
    this.chartLibReady = false;
    this.timeMode = 'relative'; 

    // Listeners
    this.content.querySelector('#add-btn').addEventListener('click', () => this.addSensor());
    this.content.querySelector('#clear-all-btn').addEventListener('click', () => this.clearAllSensors());
    this.content.querySelector('#save-view-btn').addEventListener('click', () => this.saveCurrentView());
    this.content.querySelector('#load-btn').addEventListener('click', () => this.loadHistory());
    this.content.querySelector('#reset-zoom-btn').addEventListener('click', () => this.resetZoomAll());
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

    const inputs = ['#chart-type', '#time-select', '#date-start', '#date-end', '#fill-switch', '#layout-select', '#stacked-switch', '#stats-switch'];
    inputs.forEach(id => {
        this.content.querySelector(id).addEventListener('change', (e) => {
            if (id === '#fill-switch') this.fillArea = e.target.checked;
            
            if (id === '#layout-select') {
                this.layoutMode = e.target.value;
                this.updateSliderVisibility();
            }

            if (id === '#stacked-switch') this.stackedBars = e.target.checked;
            if (id === '#stats-switch') {
                this.showStats = e.target.checked;
            }
            
            this.updateStackedVisibility();
            this.saveSettings(); 
            
            if (this._sensorDataCache.length > 0 && (id !== '#time-select' && id !== '#date-start' && id !== '#date-end')) {
                this.updateChartFromCache();
            }
        });
    });

    ['#time-select', '#date-start', '#date-end'].forEach(id => {
        this.content.querySelector(id).addEventListener('change', (e) => {
            this.saveSettings(); 
            this.loadHistory(); 
        });
    });

    const gridSlider = this.content.querySelector('#grid-slider');
    gridSlider.addEventListener('input', (e) => {
        this.gridColumns = parseInt(e.target.value);
        this.content.querySelector('#grid-value-display').textContent = this.gridColumns;
    });
    gridSlider.addEventListener('change', (e) => {
        this.saveSettings();
        if (this._sensorDataCache.length > 0 && this.layoutMode !== 'combined') this.updateChartFromCache();
    });

    const setMode = (mode) => { this.switchTimeMode(mode); this.saveSettings(); };
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

  // --- CUSTOM SEARCH ---
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

      if (matches.length === 0) {
          list.style.display = 'none';
          return;
      }

      list.innerHTML = '';
      matches.forEach(id => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          const name = this.cleanName(id);
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

  // --- HELPERS ---
  cleanName(name) {
      return name.replace(/^(sensor|binary_sensor)\./, '');
  }

  // --- SAVED VIEWS LOGIC ---
  saveCurrentView() {
      if (this.selectedSensors.length === 0) {
          alert("Bitte erst Sensoren hinzufügen.");
          return;
      }
      const name = prompt("Name für diese Ansicht:", "");
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
          showStats: this.showStats
      };

      this.savedViews.push(viewConfig);
      localStorage.setItem(this.STORAGE_KEY_VIEWS, JSON.stringify(this.savedViews));
      this.renderSavedViewsUI();
  }

  deleteSavedView(index, event) {
      if(event) event.stopPropagation();
      if (!confirm("Ansicht wirklich löschen?")) return;
      
      this.savedViews.splice(index, 1);
      localStorage.setItem(this.STORAGE_KEY_VIEWS, JSON.stringify(this.savedViews));
      this.renderSavedViewsUI();
  }

  loadSavedView(index) {
      const config = this.savedViews[index];
      if (!config) return;

      this.selectedSensors = config.sensors || [];
      this.fillArea = config.fillArea || false;
      this.layoutMode = config.layoutMode || 'combined';
      this.gridColumns = config.gridColumns || 1;
      this.timeMode = config.timeMode || 'relative';
      this.stackedBars = config.stackedBars || false;
      this.showStats = config.showStats !== undefined ? config.showStats : true;

      this.content.querySelector('#chart-type').value = config.chartType || 'line';
      this.content.querySelector('#time-select').value = config.timeSelect || '24';
      if(config.dateStart) this.content.querySelector('#date-start').value = config.dateStart;
      if(config.dateEnd) this.content.querySelector('#date-end').value = config.dateEnd;
      
      this.content.querySelector('#fill-switch').checked = this.fillArea;
      this.content.querySelector('#layout-select').value = this.layoutMode;
      this.content.querySelector('#stacked-switch').checked = this.stackedBars;
      this.content.querySelector('#stats-switch').checked = this.showStats;
      this.content.querySelector('#grid-slider').value = this.gridColumns;
      this.content.querySelector('#grid-value-display').textContent = this.gridColumns;

      this.updateSliderVisibility();
      this.updateStackedVisibility();
      this.switchTimeMode(this.timeMode);
      this.renderSensorListUI();

      this.saveSettings();
      this.loadHistory();
  }

  renderSavedViewsUI() {
      const container = this.content.querySelector('#saved-views-container');
      container.innerHTML = '';
      
      if (this.savedViews.length === 0) {
          container.innerHTML = '<div style="font-size:12px; color:var(--secondary-text-color); padding:5px;">Keine gespeichert.</div>';
          return;
      }

      this.savedViews.forEach((view, index) => {
          const item = document.createElement('div');
          item.className = 'saved-view-item';
          item.innerHTML = `
             <div class="saved-view-name">${view.name}</div>
             <div class="remove-sensor" title="Löschen">✕</div>
          `;
          item.addEventListener('click', () => this.loadSavedView(index));
          item.querySelector('.remove-sensor').addEventListener('click', (e) => this.deleteSavedView(index, e));
          container.appendChild(item);
      });
  }

  updateSliderVisibility() {
      const row = this.content.querySelector('#grid-slider-row');
      if (this.layoutMode !== 'combined') row.classList.add('visible');
      else row.classList.remove('visible');
      this.updateStackedVisibility();
      this.updateStatsToggleVisibility();
  }

  updateStackedVisibility() {
      const stackedRow = this.content.querySelector('#toggle-stacked-row');
      const chartType = this.content.querySelector('#chart-type').value;
      if (chartType === 'bar' && this.layoutMode !== 'split') {
          stackedRow.style.display = 'flex';
      } else {
          stackedRow.style.display = 'none';
      }
  }

  updateStatsToggleVisibility() {
      const statsRow = this.content.querySelector('#toggle-stats-row');
      if (this.layoutMode !== 'split') {
           statsRow.style.display = 'flex';
      } else {
           statsRow.style.display = 'none';
      }
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
            if(this.selectedSensors.length > 0) this.loadHistory();
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
              showStats: this.showStats
          };
          const singleContainer = this.content.querySelector('#chart-container-single');
          if (singleContainer) settings.containerHeight = singleContainer.style.height;
          localStorage.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(settings));
      } catch (e) { console.warn(e); }
  }

  loadSettings() {
      const views = localStorage.getItem(this.STORAGE_KEY_VIEWS);
      if (views) {
          try { this.savedViews = JSON.parse(views); this.renderSavedViewsUI(); } catch(e) {}
      }

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
          
          if (settings.fillArea !== undefined) { 
              this.fillArea = settings.fillArea; 
              this.content.querySelector('#fill-switch').checked = settings.fillArea; 
          }
          if (settings.layoutMode) { 
              this.layoutMode = settings.layoutMode;
              this.content.querySelector('#layout-select').value = settings.layoutMode;
          } else if (settings.splitCharts !== undefined) {
              this.layoutMode = settings.splitCharts ? 'split' : 'combined';
              this.content.querySelector('#layout-select').value = this.layoutMode;
          }

          if (settings.gridColumns) {
              this.gridColumns = settings.gridColumns;
              this.content.querySelector('#grid-slider').value = settings.gridColumns;
              this.content.querySelector('#grid-value-display').textContent = settings.gridColumns;
          }
          
          if (settings.stackedBars !== undefined) {
              this.stackedBars = settings.stackedBars;
              this.content.querySelector('#stacked-switch').checked = settings.stackedBars;
          }

          if (settings.showStats !== undefined) {
              this.showStats = settings.showStats;
              this.content.querySelector('#stats-switch').checked = settings.showStats;
          }
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
      if (mode === 'relative') { rel.style.display='block'; fix.classList.remove('visible'); bRel.classList.add('active'); bFix.classList.remove('active'); }
      else { rel.style.display='none'; fix.classList.add('visible'); bRel.classList.remove('active'); bFix.classList.add('active'); }
  }

  async addSensor() {
      const input = this.content.querySelector('#sensor-input');
      const entityId = input.value.trim();
      const color = this.content.querySelector('#color-input').value;
      
      if (!entityId) return;
      if (this.selectedSensors.some(s => s.entityId === entityId)) {
          alert("Sensor ist bereits in der Liste.");
          return;
      }

      this.selectedSensors.push({ entityId, color });
      input.value = '';
      this.content.querySelector('#color-input').value = this.getRandomColor();
      this.renderSensorListUI();
      this.saveSettings();

      if (this._globalStartTime && this._globalEndTime) {
          const loader = this.content.querySelector('#loader');
          loader.style.display = 'block';
          try {
              const newData = await this.fetchDataSmart(entityId, this._globalStartTime, this._globalEndTime);
              
              this._sensorDataCache.push({
                  data: newData,
                  startTime: this._globalStartTime,
                  endTime: this._globalEndTime
              });
              
              this.updateChartFromCache();
          } catch (e) { console.error(e); this.loadHistory(); } finally { loader.style.display = 'none'; }
      } else {
          this.loadHistory();
      }
  }

  clearAllSensors() {
      if (this.selectedSensors.length === 0) return;
      if (!confirm("Alle Sensoren aus der Liste löschen?")) return;
      
      this.selectedSensors = [];
      this._sensorDataCache = [];
      this.renderSensorListUI();
      this.saveSettings();
      this.destroyAllCharts();
      this.content.querySelector('#main-content-area').innerHTML = '';
  }

  removeSensor(index) {
      this.selectedSensors.splice(index, 1);
      if (this._sensorDataCache.length > index) { this._sensorDataCache.splice(index, 1); }
      this.renderSensorListUI();
      this.saveSettings();
      if (this._sensorDataCache.length > 0) { this.updateChartFromCache(); } else { this.destroyAllCharts(); this.content.querySelector('#main-content-area').innerHTML = ''; }
  }

  renderSensorListUI() {
      const container = this.content.querySelector('#sensor-list-container');
      if (this.selectedSensors.length === 0) { container.innerHTML = `<div style="color:var(--secondary-text-color);font-size:12px;text-align:center;padding:10px;">Liste leer.</div>`; return; }
      container.innerHTML = '';
      this.selectedSensors.forEach((sensor, index) => {
          const item = document.createElement('div');
          item.className = 'sensor-item';
          item.innerHTML = `<div class="sensor-color-dot" style="background-color:${sensor.color}"></div><div class="sensor-name" title="${sensor.entityId}">${this.cleanName(sensor.entityId)}</div><div class="remove-sensor">✕</div>`;
          item.querySelector('.remove-sensor').addEventListener('click', () => this.removeSensor(index));
          container.appendChild(item);
      });
  }

  populateSensorList() {
      // Replaced by custom search logic on input
  }

  getRandomColor() {
      const l = '0123456789ABCDEF'; let c='#'; for(let i=0;i<6;i++) c+=l[Math.floor(Math.random()*16)]; return c;
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
              // WEBSOCKET LTS CALL
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

  async loadSingleSensorHistory(index, startTime, endTime) {
      const sensor = this.selectedSensors[index];
      if (!sensor) return;
      
      const loader = this.content.querySelector('#loader');
      loader.style.display = 'block';
      
      try {
          const newData = await this.fetchDataSmart(sensor.entityId, startTime, endTime);
          this._sensorDataCache[index] = { data: newData, startTime: startTime, endTime: endTime };
          
          if(this.chartInstances[index]) {
             this.updateChartFromCache(); 
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
      if (this.timeMode === 'relative') {
          dh = parseInt(this.content.querySelector('#time-select').value);
          et = now; st = new Date(now.getTime() - (dh * 3600000));
      } else {
          st = new Date(this.content.querySelector('#date-start').value);
          et = new Date(this.content.querySelector('#date-end').value);
          dh = (et - st) / 3600000;
          if (st >= et) { this.showError("Enddatum muss nach Startdatum liegen."); return; }
      }

      if (chartType === 'scatter' && dh > 24.1) { this.showError("Scatter nur <= 24h."); return; }

      this._globalStartTime = st;
      this._globalEndTime = et;

      loader.style.display = 'block';
      this._sensorDataCache = []; 

      try {
          const promises = this.selectedSensors.map(s => this.fetchDataSmart(s.entityId, st, et));
          const results = await Promise.all(promises);
          
          results.forEach(res => {
              this._sensorDataCache.push({ data: res, startTime: st, endTime: et });
          });

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

      if (this.layoutMode === 'mixed') {
          const topWrap = document.createElement('div');
          topWrap.style.marginBottom = '30px';
          mainArea.appendChild(topWrap);
          this.renderCombinedView(cacheData, globalChartType, topWrap);

          const botWrap = document.createElement('div');
          mainArea.appendChild(botWrap);
          this.renderSplitView(cacheData, globalChartType, botWrap);
      } 
      else if (this.layoutMode === 'split') {
          this.renderSplitView(cacheData, globalChartType, mainArea);
      } 
      else {
          this.renderCombinedView(cacheData, globalChartType, mainArea);
      }
  }

  destroyAllCharts() {
      if (this.chartInstances) this.chartInstances.forEach(c => c.destroy());
      this.chartInstances = [];
  }

  resetZoomAll() {
      this.loadHistory();
      this.content.querySelector('#reset-zoom-btn').style.display = 'none';
  }

  calculateEnergySum(values, isAggregated) {
      if (isAggregated) {
          return values.reduce((a, b) => a + b, 0);
      }
      let sum = 0;
      for (let i = 1; i < values.length; i++) {
          const diff = values[i] - values[i-1];
          if (diff > 0) sum += diff;
      }
      return sum;
  }

  aggregateToDaily(historyData, isEnergy) {
      const groups = {};
      historyData.forEach(pt => {
          if (isNaN(parseFloat(pt.state))) return;
          const val = parseFloat(pt.state);
          const d = new Date(pt.last_changed);
          const key = d.toISOString().split('T')[0];
          
          if (!groups[key]) groups[key] = { sum: 0, count: 0, min: val, max: val, values: [] };
          
          groups[key].values.push(val);
          groups[key].sum += val;
          groups[key].count++;
          if(val < groups[key].min) groups[key].min = val;
          if(val > groups[key].max) groups[key].max = val;
      });

      return Object.keys(groups).sort().map(dateStr => {
          const g = groups[dateStr];
          let yVal;
          if (isEnergy) {
              let daySum = 0;
              for(let i=1; i<g.values.length; i++) {
                  let d = g.values[i] - g.values[i-1];
                  if(d > 0) daySum += d;
              }
              if(daySum === 0 && g.max > g.min) daySum = g.max - g.min;
              yVal = daySum;
          } else {
              yVal = g.sum / g.count;
          }
          
          return { x: new Date(dateStr).getTime(), y: yVal };
      });
  }

  processData(history, type, unit) {
      const isEnergy = unit && (unit.includes("Wh") || unit.includes("kWh"));
      
      if (history.length > 1) {
          const start = new Date(history[0].last_changed).getTime();
          const end = new Date(history[history.length-1].last_changed).getTime();
          const hours = (end - start) / 3600000;
          
          if (type === 'bar' && hours > 24) {
              return this.aggregateToDaily(history, isEnergy);
          }
      }

      if (type === 'bar') return this.aggregateToHourly(history);
      
      if (history.length > 2000) {
          const step = Math.ceil(history.length / 2000);
          return history.filter((_, i) => i % step === 0 && !isNaN(parseFloat(_.state)))
                        .map(pt => ({ x: new Date(pt.last_changed).getTime(), y: parseFloat(pt.state) }));
      }
      return history.filter(pt => !isNaN(parseFloat(pt.state))).map(pt => ({ x: new Date(pt.last_changed).getTime(), y: parseFloat(pt.state) }));
  }

  aggregateToHourly(historyData) {
      const buckets = {};
      historyData.forEach(pt => {
          if (isNaN(parseFloat(pt.state))) return;
          const date = new Date(pt.last_changed); date.setMinutes(0, 0, 0); const key = date.getTime();
          if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
          buckets[key].sum += parseFloat(pt.state); buckets[key].count++;
      });
      return Object.keys(buckets).sort().map(timestamp => { const t = parseInt(timestamp); return { x: t, y: buckets[timestamp].sum / buckets[timestamp].count }; });
  }

  // --- REDESIGNED COMPACT STATS CARD (FLEX & CLASSIC) ---
  createStatsCard(conf, min, avg, max, curr, unit, label) {
      return `
        <div class="stats-card" style="border-left-color: ${conf.color}">
            <div class="stats-header" title="${this.cleanName(conf.entityId)}">${this.cleanName(conf.entityId)}</div>
            <div class="stats-row">
                <span>${label}</span>
                <span class="stats-main-val" style="color:${conf.color}">${curr} ${unit}</span>
            </div>
            <div class="stats-row"><span>Min</span> <span>${min}</span></div>
            <div class="stats-row"><span>Avg</span> <span>${avg}</span></div>
            <div class="stats-row"><span>Max</span> <span>${max}</span></div>
        </div>
     `;
  }

  renderDoughnut(cacheData, ctx, statsWrapper) {
      const styles = getComputedStyle(this);
      const textColor = styles.getPropertyValue('--primary-text-color').trim();
      const labels=[], values=[], bgColors=[], units=[];
      cacheData.forEach((obj, i) => {
          const h = obj.data;
          const c = this.selectedSensors[i];
          if(!c||!h.length)return;
          const clean = h.map(p=>parseFloat(p.state)).filter(v=>!isNaN(v));
          if(!clean.length)return;
          const avg = clean.reduce((a,b)=>a+b,0)/clean.length;
          labels.push(this.cleanName(c.entityId)); values.push(avg.toFixed(2)); bgColors.push(c.color);
          units.push(this._hass.states[c.entityId]?.attributes?.unit_of_measurement||'');
      });
      const chart = new window.Chart(ctx, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 10 }] },
          options: {
              responsive: true, maintainAspectRatio: false, cutout: '60%', layout: { padding: 20 },
              plugins: {
                  legend: { display: true, position: 'right', labels: { color: textColor, usePointStyle: true } },
                  tooltip: { backgroundColor: 'rgba(20, 20, 20, 0.95)', callbacks: { label: (c) => ` Ø ${c.formattedValue} ${units[c.dataIndex]}` } }
              }
          }
      });
      this.chartInstances.push(chart);
      if(this.showStats) {
        statsWrapper.innerHTML = `<div style="text-align:center;width:100%;color:${textColor};padding:20px;">Durchschnittswerte (Ø)</div>`;
      }
  }

  renderCombinedView(cacheData, chartType, container) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
          <div id="resize-ghost"></div>
          <div class="chart-container-outer" id="chart-container-single">
             <div class="canvas-wrapper"><canvas id="canvas-combined"></canvas></div>
             <div id="resize-handle"><div class="grip-lines"></div></div>
          </div>
          <div id="stats-wrapper" class="stats-wrapper" style="display:${this.showStats ? 'flex' : 'none'}"></div>
      `;
      wrapper.style.width = '100%';
      container.appendChild(wrapper);
      
      const chartContainer = wrapper.querySelector('#chart-container-single');
      if (this.savedContainerHeight) chartContainer.style.height = this.savedContainerHeight;
      this.initResizeHandler(wrapper.querySelector('#resize-handle'), chartContainer, wrapper.querySelector('#resize-ghost'));

      const ctx = wrapper.querySelector('#canvas-combined').getContext('2d');
      const statsWrapper = wrapper.querySelector('#stats-wrapper');

      if (chartType === 'doughnut') { this.renderDoughnut(cacheData, ctx, statsWrapper); return; }

      const datasets = [];
      let allStatsHTML = '';
      
      const st = this._globalStartTime || cacheData[0]?.startTime || new Date();
      const et = this._globalEndTime || cacheData[0]?.endTime || new Date();

      cacheData.forEach((sensorDataObj, idx) => {
          const conf = this.selectedSensors[idx];
          if (!conf || !sensorDataObj.data.length) return;
          
          const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
          const effectiveType = this.stackedBars ? 'bar' : chartType;
          let points = this.processData(sensorDataObj.data, effectiveType, unit);
          if (!points.length) return;

          const values = points.map(p => p.y);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const avg = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2);
          const curr = values[values.length-1].toFixed(2);

          let displayVal = curr;
          let displayLabel = "AKTUELL";
          if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
              const hours = (et - st) / 3600000;
              const isAggregated = (effectiveType === 'bar' && hours > 24);
              
              displayVal = this.calculateEnergySum(values, isAggregated).toFixed(2);
              displayLabel = "SUMME";
          }

          allStatsHTML += this.createStatsCard(conf, min.toFixed(2), avg, max.toFixed(2), displayVal, unit, displayLabel);

          let bg = conf.color;
          if (this.fillArea && effectiveType === 'line') {
              const grad = ctx.createLinearGradient(0, 0, 0, 400);
              grad.addColorStop(0, this.hexToRgba(conf.color, 0.5));
              grad.addColorStop(1, this.hexToRgba(conf.color, 0.05));
              bg = grad;
          }

          const isHidden = conf.hidden === true;

          datasets.push({
              label: this.cleanName(conf.entityId), 
              hidden: isHidden, 
              data: points, borderColor: conf.color, backgroundColor: bg, fill: this.fillArea,
              borderWidth: (effectiveType === 'bar') ? 0 : 2.5, 
              categoryPercentage: 0.98, barPercentage: 0.98, 
              pointRadius: (effectiveType === 'scatter') ? 4 : 0, pointHoverRadius: 6, pointBackgroundColor: conf.color,
              tension: 0.4, cubicInterpolationMode: 'monotone', stepped: (effectiveType === 'stepped')
          });
      });

      statsWrapper.innerHTML = allStatsHTML;
      this.createChartInstance(ctx, this.stackedBars ? 'bar' : chartType, datasets, st, et, true, null);
  }

  renderSplitView(cacheData, globalChartType, container) {
      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'split-grid-wrapper';
      // FLEX GAP
      container.appendChild(gridWrapper);

      const st = this._globalStartTime || cacheData[0]?.startTime || new Date();
      const et = this._globalEndTime || cacheData[0]?.endTime || new Date();
      const hours = (et - st) / 3600000;

      cacheData.forEach((sensorDataObj, idx) => {
          const conf = this.selectedSensors[idx];
          if (!conf || !sensorDataObj.data.length) return;

          const card = document.createElement('div');
          card.className = 'split-chart-card';
          // DYNAMIC WIDTH VIA FLEX
          // width ~ 100% / columns - gap adjustment
          const pct = 99 / this.gridColumns;
          card.style.flex = `1 1 calc(${pct}% - 20px)`;
          card.style.minWidth = '250px'; // Prevent too small on resize

          const canvasId = `split-canvas-${idx}`;
          
          card.innerHTML = `
             <div class="split-chart-header" style="color:${conf.color}"><span>${this.cleanName(conf.entityId)}</span></div>
             <div class="split-canvas-container"><canvas id="${canvasId}"></canvas></div>
             <div class="split-footer" id="footer-${idx}"></div>
          `;
          gridWrapper.appendChild(card);

          let currentType = conf.typeOverride || globalChartType;
          const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
          
          let points = this.processData(sensorDataObj.data, currentType, unit);
          const values = points.map(p => p.y);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const avg = (values.reduce((a,b)=>a+b,0)/values.length).toFixed(2);
          const curr = values[values.length-1].toFixed(2);

          let displayVal = curr;
          let displayLabel = "Aktuell";
          if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
              const isAggregated = (currentType === 'bar' && hours > 24);
              displayVal = this.calculateEnergySum(values, isAggregated).toFixed(2);
              displayLabel = "Summe";
          }

          const footer = card.querySelector(`#footer-${idx}`);
          const statsBox = document.createElement('div');
          statsBox.className = 'split-stats-box';
          statsBox.innerHTML = `
             <div><div class="stat-label">${displayLabel}</div><div class="stat-current" style="color:${conf.color}">${displayVal} <span class="stat-unit">${unit}</span></div></div>
             <div><div class="stat-label">Min</div><div class="stat-value" style="font-size:1em">${min.toFixed(2)}</div></div>
             <div><div class="stat-label">Ø</div><div class="stat-value" style="font-size:1em">${avg}</div></div>
             <div><div class="stat-label">Max</div><div class="stat-value" style="font-size:1em">${max.toFixed(2)}</div></div>
          `;
          footer.appendChild(statsBox);

          const controlsBox = document.createElement('div');
          controlsBox.className = 'split-controls-box';
          const btnLine = document.createElement('button');
          btnLine.className = `chart-toggle-btn ${currentType === 'line' ? 'active' : ''}`; btnLine.innerText = 'Line';
          const btnBar = document.createElement('button');
          btnBar.className = `chart-toggle-btn ${currentType === 'bar' ? 'active' : ''}`; btnBar.innerText = 'Bar';
          controlsBox.appendChild(btnLine); controlsBox.appendChild(btnBar);
          footer.appendChild(controlsBox);

          const ctx = card.querySelector(`#${canvasId}`).getContext('2d');
          
          const updateThisChart = (newType) => {
              this.selectedSensors[idx].typeOverride = newType;
              this.saveSettings();

              btnLine.className = `chart-toggle-btn ${newType === 'line' ? 'active' : ''}`;
              btnBar.className = `chart-toggle-btn ${newType === 'bar' ? 'active' : ''}`;
              
              const chartIdx = this.chartInstances.findIndex(c => c.canvas === card.querySelector('canvas'));
              if (chartIdx > -1) { this.chartInstances[chartIdx].destroy(); this.chartInstances.splice(chartIdx, 1); }

              let newPoints = this.processData(sensorDataObj.data, newType, unit);
              let bg = conf.color;
              if (this.fillArea && newType === 'line') {
                  const grad = ctx.createLinearGradient(0, 0, 0, 300);
                  grad.addColorStop(0, this.hexToRgba(conf.color, 0.5));
                  grad.addColorStop(1, this.hexToRgba(conf.color, 0.05));
                  bg = grad;
              }

              const dataset = {
                  label: this.cleanName(conf.entityId), data: newPoints, borderColor: conf.color, backgroundColor: bg, fill: this.fillArea,
                  borderWidth: (newType === 'bar') ? 0 : 2.5, categoryPercentage: 0.98, barPercentage: 0.98,
                  pointRadius: 0, pointHoverRadius: 6, pointBackgroundColor: conf.color, tension: 0.4, cubicInterpolationMode: 'monotone'
              };
              this.createChartInstance(ctx, newType, [dataset], sensorDataObj.startTime, sensorDataObj.endTime, false, idx, true);
          };

          btnLine.onclick = () => updateThisChart('line');
          btnBar.onclick = () => updateThisChart('bar');
          updateThisChart(currentType);
      });
  }

  createChartInstance(ctx, type, datasets, startTime, endTime, showZoomBtn, sensorIndex, hideLegend) {
      const styles = getComputedStyle(this);
      const textColor = styles.getPropertyValue('--primary-text-color').trim();
      const gridColor = styles.getPropertyValue('--divider-color').trim();
      const secondaryText = styles.getPropertyValue('--secondary-text-color').trim();
      const resetBtn = this.content.querySelector('#reset-zoom-btn');

      const chart = new window.Chart(ctx, {
          type: type === 'stepped' ? 'line' : type,
          data: { datasets },
          options: {
              responsive: true, maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false }, 
              plugins: {
                  legend: { 
                      display: !hideLegend, 
                      position: 'top', align: 'end', labels: { color: textColor, usePointStyle: true, boxWidth: 8 } 
                  },
                  tooltip: {
                      backgroundColor: 'rgba(20, 20, 20, 0.95)', titleColor: '#fff', bodyColor: '#bbb', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12,
                      callbacks: {
                          title: (c) => new Date(c[0].parsed.x).toLocaleString('de-DE'), 
                          label: (c) => {
                              const lbl = c.dataset.label || '';
                              const unit = this._hass.states[this.selectedSensors.find(s=>this.cleanName(s.entityId)===lbl)?.entityId]?.attributes?.unit_of_measurement||'';
                              return `${lbl}: ${c.formattedValue} ${unit}`;
                          }
                      }
                  },
                  zoom: {
                      pan: { enabled: true, mode: 'x', 
                             onPan: () => { if(showZoomBtn) resetBtn.style.display = 'block'; },
                             onPanComplete: ({chart}) => { 
                                 const min = chart.scales.x.min;
                                 const max = chart.scales.x.max;
                                 if (this.layoutMode !== 'combined' && sensorIndex !== null) {
                                     this.loadSingleSensorHistory(sensorIndex, new Date(min), new Date(max));
                                 } else {
                                     // For Combined or Mixed Top
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
                      type: 'linear', 
                      position: 'bottom', min: startTime.getTime(), max: endTime.getTime(),
                      stacked: this.stackedBars, 
                      offset: false, 
                      ticks: {
                          color: secondaryText, maxTicksLimit: 8,
                          callback: function(value) {
                              const d = new Date(value);
                              const diffHours = (endTime - startTime) / (1000 * 60 * 60);
                              if (diffHours > 48) return d.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'});
                              return d.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});
                          }
                      },
                      grid: { color: gridColor, drawBorder: false, display: false } 
                  },
                  y: { 
                      stacked: this.stackedBars, 
                      grace: '5%', ticks: { color: secondaryText }, grid: { color: gridColor, borderDash: [5, 5] } 
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

  hexToRgba(hex, alpha) {
      let c;
      if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
          c= hex.substring(1).split('');
          if(c.length== 3){ c= [c[0], c[0], c[1], c[1], c[2], c[2]]; }
          c= '0x'+c.join('');
          return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
      }
      return hex;
  }
}

customElements.define('detailed-charts-panel', DetailedChartsPanel);
