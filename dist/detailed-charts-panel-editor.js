/* detailed-charts-panel-editor.js */
console.log("DetailedChartsPanelEditor: v_2.1");

const fireEvent = (node, type, detail, options) => {
    options = options || {};
    detail = detail === null || detail === undefined ? {} : detail;
    const event = new Event(type, {
        bubbles: options.bubbles === undefined ? true : options.bubbles,
        cancelable: Boolean(options.cancelable),
        composed: options.composed === undefined ? true : options.composed,
    });
    event.detail = detail;
    node.dispatchEvent(event);
    return event;
};

const loadJsYaml = async () => {
    if (window.jsyaml) return;
    try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
        document.head.appendChild(script);
        await new Promise(r => { script.onload = r; });
    } catch(e) {}
};

// --- SVG ICONS ---
const ICONS = {
    eyeOpen: `<svg viewBox="0 0 24 24" style="width:24px;height:24px"><path fill="currentColor" d="M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z" /></svg>`,
    eyeClosed: `<svg viewBox="0 0 24 24" style="width:24px;height:24px"><path fill="currentColor" d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3L2,4.27Z" /></svg>`,
    delete: `<svg viewBox="0 0 24 24" style="width:24px;height:24px"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>`
};

class DetailedChartsPanelEditor extends HTMLElement {
    constructor() {
        super();
        this._config = {};
        this._hass = null;
        this._mode = 'visual';
        this._rendered = false;
    }

    setConfig(config) {
        this._config = config;
        if (this.shadowRoot) this._updateVisuals();
    }

    set hass(hass) {
        this._hass = hass;
        // Update hass down the tree to all selectors
        if (this.shadowRoot) {
            this.shadowRoot.querySelectorAll('ha-selector').forEach(el => {
                el.hass = hass;
            });
        }
    }

    connectedCallback() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
            this.renderBaseStructure();
        }
        loadJsYaml();
    }

    _configChanged(newConfig) {
        fireEvent(this, 'config-changed', { config: newConfig });
        this._config = newConfig;
        this._updateVisuals();
    }

    // --- HELPER: Create Main Config Selector ---
    _createSelector(configKey, label, selectorSchema, value) {
        const el = document.createElement('ha-selector');
        el.selector = selectorSchema;
        el.label = label;
        el.value = value;
        el.configValue = configKey;
        el.hass = this._hass;
        el.addEventListener('value-changed', (ev) => {
            const newVal = ev.detail.value;
            const updatedConfig = { ...this._config, [configKey]: newVal };
            if (configKey === 'timeMode') {
                if (newVal === 'relative') { delete updatedConfig.dateStart; delete updatedConfig.dateEnd; }
                if (newVal === 'fixed') { delete updatedConfig.timeSelect; }
            }
            this._configChanged(updatedConfig);
        });
        return el;
    }

    renderBaseStructure() {
        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; background: transparent; width: 100%; --primary-text-color: #e1e1e1; }
                .wrapper { padding: 8px; box-sizing: border-box; }
                
                .tabs { display: flex; border-bottom: 1px solid var(--divider-color); margin-bottom: 15px; }
                .tab { padding: 10px 20px; cursor: pointer; opacity: 0.6; border-bottom: 2px solid transparent; font-weight: 500; text-transform: uppercase; font-size: 14px; color: var(--primary-text-color); }
                .tab.active { opacity: 1; border-bottom-color: var(--primary-color); color: var(--primary-color); }
                
                .content-area { display: flex; flex-direction: column; gap: 15px; }
                .section { border: 1px solid var(--divider-color); padding: 12px; border-radius: 4px; background: rgba(255,255,255,0.03); }
                .section-title { font-weight: 500; color: var(--primary-color); margin-bottom: 10px; text-transform: uppercase; font-size: 12px; }
                .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }

                /* SENSOR LIST STYLES */
                .sensor-list { display: flex; flex-direction: column; gap: 10px; }
                .sensor-row { 
                    display: grid; 
                    grid-template-columns: 40px 1fr 40px 40px; 
                    gap: 12px; 
                    align-items: center;
                    background: var(--card-background-color, #202020); 
                    padding: 8px; 
                    border-radius: 6px; 
                    border: 1px solid var(--divider-color);
                }
                
                .color-wrap { position: relative; width: 32px; height: 32px; border-radius: 50%; overflow: hidden; border: 1px solid var(--divider-color); cursor: pointer; }
                .color-inp { position: absolute; top: -10px; left: -10px; width: 60px; height: 60px; padding: 0; border: none; cursor: pointer; }
                
                /* Layout Fixes for HA-Selector inside Grid */
                .selector-container { width: 100%; min-width: 0; }
                ha-selector { width: 100%; display: block; margin: 0; }
                
                /* SVG BUTTONS */
                .icon-btn { 
                    background: transparent; border: 1px solid transparent; 
                    color: var(--secondary-text-color); cursor: pointer; 
                    padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn:hover { background: rgba(255,255,255,0.1); color: var(--primary-text-color); }
                .icon-btn.delete { color: var(--error-color, #f44336); }
                .icon-btn.delete:hover { background: rgba(244, 67, 54, 0.15); }
                
                .btn-add { 
                    margin-top: 10px; padding: 12px; width: 100%; 
                    background: transparent; border: 1px dashed var(--primary-color); 
                    color: var(--primary-color); text-transform: uppercase; font-weight: bold; cursor: pointer; border-radius: 4px;
                }
                .btn-add:hover { background: rgba(var(--rgb-primary-color), 0.1); }
            </style>
            <div class="wrapper">
                <div class="tabs">
                    <div class="tab active" id="tabVisual">Visuell</div>
                    <div class="tab" id="tabYaml">YAML</div>
                </div>
                <div id="visual-container" class="content-area"></div>
                <div id="yaml-container" class="content-area" style="display:none;"></div>
            </div>
        `;

        const tVis = this.shadowRoot.getElementById('tabVisual');
        const tYaml = this.shadowRoot.getElementById('tabYaml');
        const cVis = this.shadowRoot.getElementById('visual-container');
        const cYaml = this.shadowRoot.getElementById('yaml-container');

        tVis.onclick = () => {
            this._mode = 'visual';
            tVis.classList.add('active'); tYaml.classList.remove('active');
            cVis.style.display = 'flex'; cYaml.style.display = 'none';
            this._updateVisuals();
        };
        tYaml.onclick = () => {
            this._mode = 'yaml';
            tVis.classList.remove('active'); tYaml.classList.add('active');
            cVis.style.display = 'none'; cYaml.style.display = 'block';
            this._updateYaml();
        };

        this._rendered = true;
        this._updateVisuals();
    }

    _updateVisuals() {
        if (!this._rendered || this._mode !== 'visual') return;
        const container = this.shadowRoot.getElementById('visual-container');
        container.innerHTML = ''; 

        const c = this._config;

        // --- SECTION 1: Darstellung ---
        const secDisp = document.createElement('div'); secDisp.className = 'section';
        secDisp.innerHTML = `<div class="section-title">Darstellung</div>`;
        const row1 = document.createElement('div'); row1.className = 'row';
        row1.appendChild(this._createSelector('chartType', 'Chart Typ', { select: { mode: "dropdown", options: [ { label: 'Line (Kurve)', value: 'line' }, { label: 'Bar (Balken)', value: 'bar' }, { label: 'Scatter (Punkte)', value: 'scatter' }, { label: 'Doughnut (Donut)', value: 'doughnut' }, { label: 'Stepped (Stufen)', value: 'stepped' } ]}}, c.chartType || 'line'));
        row1.appendChild(this._createSelector('layoutMode', 'Layout', { select: { mode: "dropdown", options: [ { label: 'Kombiniert', value: 'combined' }, { label: 'Grid (Split)', value: 'split' }, { label: 'Mixed', value: 'mixed' } ]}}, c.layoutMode || 'combined'));
        secDisp.appendChild(row1);
        const row2 = document.createElement('div'); row2.className = 'row';
        row2.appendChild(this._createSelector('zoomLevel', 'Zoom', { number: { min: 0.5, max: 2.0, step: 0.1, mode: "box" } }, c.zoomLevel ?? 1.0));
        if(c.layoutMode !== 'combined') row2.appendChild(this._createSelector('gridColumns', 'Spalten', { number: { min: 1, max: 6, step: 1, mode: "box" } }, c.gridColumns ?? 1));
        secDisp.appendChild(row2);
        secDisp.appendChild(this._createSelector('threshold', 'Referenzlinie (Wert)', { text: {} }, c.threshold || ''));
        container.appendChild(secDisp);

        // --- SECTION 2: Zeitraum ---
        const secTime = document.createElement('div'); secTime.className = 'section';
        secTime.innerHTML = `<div class="section-title">Zeitraum</div>`;
        const rowTime = document.createElement('div'); rowTime.className = 'row';
        rowTime.appendChild(this._createSelector('timeMode', 'Modus', { select: { mode: "dropdown", options: [ { label: 'Relativ', value: 'relative' }, { label: 'Fix (Kalender)', value: 'fixed' } ]}}, c.timeMode || 'relative'));
        if(c.timeMode === 'relative') rowTime.appendChild(this._createSelector('timeSelect', 'Fenster', { select: { mode: "dropdown", options: [ { label: '1 Std', value: '1' }, { label: '3 Std', value: '3' }, { label: '6 Std', value: '6' }, { label: '12 Std', value: '12' }, { label: '24 Std', value: '24' }, { label: '48 Std', value: '48' }, { label: '7 Tage', value: '168' }, { label: '30 Tage', value: '720' }, { label: 'Jahr', value: '8760' } ]}}, c.timeSelect || '24'));
        secTime.appendChild(rowTime);
        if(c.timeMode === 'fixed') {
            const rowDates = document.createElement('div'); rowDates.className = 'row';
            rowDates.appendChild(this._createSelector('dateStart', 'Start', { datetime: {} }, c.dateStart));
            rowDates.appendChild(this._createSelector('dateEnd', 'Ende', { datetime: {} }, c.dateEnd));
            secTime.appendChild(rowDates);
        }
        container.appendChild(secTime);

        // --- SECTION 3: Optionen ---
        const secOpt = document.createElement('div'); secOpt.className = 'section';
        secOpt.innerHTML = `<div class="section-title">Optionen</div>`;
        const rowOpt1 = document.createElement('div'); rowOpt1.className = 'row';
        rowOpt1.appendChild(this._createSelector('fillArea', 'Fläche füllen', { boolean: {} }, c.fillArea === true));
        rowOpt1.appendChild(this._createSelector('showStats', 'Statistiken', { boolean: {} }, c.showStats !== false));
        secOpt.appendChild(rowOpt1);
        
        const rowOpt2 = document.createElement('div'); rowOpt2.className = 'row';
        rowOpt2.appendChild(this._createSelector('showDonutSidebar', 'Donut Sidebar', { boolean: {} }, c.showDonutSidebar === true));
        rowOpt2.appendChild(this._createSelector('autoScale', 'Auto-Scale', { boolean: {} }, c.autoScale === true));
        secOpt.appendChild(rowOpt2);

        // NEUE OPTIONEN
        const rowOpt3 = document.createElement('div'); rowOpt3.className = 'row';
        rowOpt3.appendChild(this._createSelector('hideAxislabels', 'Achsen-Text aus', { boolean: {} }, c.hideAxislabels === true));
        rowOpt3.appendChild(this._createSelector('hideGrid', 'Gitterlinien aus', { boolean: {} }, c.hideGrid === true));
        secOpt.appendChild(rowOpt3);

        if(c.chartType === 'bar' && c.layoutMode !== 'split') secOpt.appendChild(this._createSelector('stackedBars', 'Stacked', { boolean: {} }, c.stackedBars === true));
        container.appendChild(secOpt);

        // --- SECTION 4: Sensoren ---
        const secSens = document.createElement('div'); secSens.className = 'section';
        secSens.innerHTML = `<div class="section-title">Sensoren</div>`;
        const sensorList = document.createElement('div'); sensorList.className = 'sensor-list';
        
        (c.sensors || []).forEach((s, index) => {
            const row = document.createElement('div'); row.className = 'sensor-row';

            // 1. Color
            const colWrap = document.createElement('div'); colWrap.className = 'color-wrap';
            colWrap.style.backgroundColor = s.color;
            const colInp = document.createElement('input');
            colInp.type = 'color'; colInp.className = 'color-inp'; colInp.value = s.color;
            colInp.onchange = (e) => this._updateSensor(index, 'color', e.target.value);
            colWrap.appendChild(colInp);
            row.appendChild(colWrap);

            // 2. Entity Selector
            const selContainer = document.createElement('div'); 
            selContainer.className = 'selector-container';
            const entitySelector = document.createElement('ha-selector');
            entitySelector.selector = { entity: {} }; 
            entitySelector.value = s.entityId;
            entitySelector.label = "Sensor";
            entitySelector.hass = this._hass;
            entitySelector.addEventListener('value-changed', (e) => this._updateSensor(index, 'entityId', e.detail.value));
            selContainer.appendChild(entitySelector);
            row.appendChild(selContainer);

            // 3. Hide Button
            const btnHide = document.createElement('button');
            btnHide.className = 'icon-btn';
            btnHide.innerHTML = s.hidden ? ICONS.eyeClosed : ICONS.eyeOpen;
            btnHide.title = s.hidden ? "Einblenden" : "Ausblenden";
            btnHide.onclick = () => this._updateSensor(index, 'hidden', !s.hidden);
            row.appendChild(btnHide);

            // 4. Delete Button
            const btnDel = document.createElement('button');
            btnDel.className = 'icon-btn delete';
            btnDel.innerHTML = ICONS.delete;
            btnDel.title = "Entfernen";
            btnDel.onclick = () => this._removeSensor(index);
            row.appendChild(btnDel);

            sensorList.appendChild(row);
        });
        secSens.appendChild(sensorList);

        const btnAdd = document.createElement('button');
        btnAdd.className = 'btn-add';
        btnAdd.innerText = '+ SENSOR HINZUFÜGEN';
        btnAdd.onclick = () => this._addSensor();
        secSens.appendChild(btnAdd);

        container.appendChild(secSens);
    }

    _updateYaml() {
        if (!this._rendered || this._mode !== 'yaml') return;
        const container = this.shadowRoot.getElementById('yaml-container');
        container.innerHTML = '';
        
        let val = '';
        if (window.jsyaml && this._config) {
            const dump = { ...this._config };
            delete dump.type;
            val = window.jsyaml.dump(dump);
        }
        
        const editor = document.createElement('ha-code-editor');
        editor.mode = 'yaml';
        editor.autofocus = true;
        editor.value = val;
        editor.addEventListener('value-changed', (e) => {
            if(!window.jsyaml) return;
            try {
                const parsed = window.jsyaml.load(e.detail.value);
                if(parsed) {
                    this._config = { ...parsed, type: 'custom:detailed-charts-panel' };
                    fireEvent(this, 'config-changed', { config: this._config });
                }
            } catch(err){}
        });
        container.appendChild(editor);
    }

    _updateSensor(index, key, val) {
        const sensors = [...(this._config.sensors || [])];
        const s = { ...sensors[index], [key]: val };
        if(key==='hidden' && val===false) delete s.hidden;
        sensors[index] = s;
        this._configChanged({ ...this._config, sensors });
    }

    _addSensor() {
        const sensors = [...(this._config.sensors || [])];
        sensors.push({ entityId: '', color: '#' + Math.floor(Math.random()*16777215).toString(16) });
        this._configChanged({ ...this._config, sensors });
    }

    _removeSensor(index) {
        const sensors = [...(this._config.sensors || [])];
        sensors.splice(index, 1);
        this._configChanged({ ...this._config, sensors });
    }
}

customElements.define('detailed-charts-panel-editor', DetailedChartsPanelEditor);
