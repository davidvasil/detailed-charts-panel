/* detailed-charts-panel-function.js */

/* --- HELPER FUNCTIONS --- */

export function cleanName(name) {
    return name.replace(/^(sensor|binary_sensor)\./, '');
}

export function getRandomColor() {
    const l = '0123456789ABCDEF'; 
    let c = '#'; 
    for (let i = 0; i < 6; i++) c += l[Math.floor(Math.random() * 16)]; 
    return c;
}

export function hexToRgba(hex, alpha) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) { c = [c[0], c[0], c[1], c[1], c[2], c[2]]; }
        c = '0x' + c.join('');
        return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return hex;
}

export function calculateEnergySum(values, isAggregated) {
    if (isAggregated) {
        return values.reduce((a, b) => a + b, 0);
    }
    let sum = 0;
    for (let i = 1; i < values.length; i++) {
        const diff = values[i] - values[i - 1];
        if (diff > 0) sum += diff;
    }
    return sum;
}

/* --- DATA PROCESSING --- */

function aggregateToDaily(historyData, isEnergy) {
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
        if (val < groups[key].min) groups[key].min = val;
        if (val > groups[key].max) groups[key].max = val;
    });

    return Object.keys(groups).sort().map(dateStr => {
        const g = groups[dateStr];
        let yVal;
        if (isEnergy) {
            let daySum = 0;
            for (let i = 1; i < g.values.length; i++) {
                let d = g.values[i] - g.values[i - 1];
                if (d > 0) daySum += d;
            }
            if (daySum === 0 && g.max > g.min) daySum = g.max - g.min;
            yVal = daySum;
        } else {
            yVal = g.sum / g.count;
        }
        return { x: new Date(dateStr).getTime(), y: yVal };
    });
}

function aggregateToHourly(historyData) {
    const buckets = {};
    historyData.forEach(pt => {
        if (isNaN(parseFloat(pt.state))) return;
        const date = new Date(pt.last_changed); date.setMinutes(0, 0, 0); const key = date.getTime();
        if (!buckets[key]) buckets[key] = { sum: 0, count: 0 };
        buckets[key].sum += parseFloat(pt.state); buckets[key].count++;
    });
    return Object.keys(buckets).sort().map(timestamp => { const t = parseInt(timestamp); return { x: t, y: buckets[timestamp].sum / buckets[timestamp].count }; });
}

export function processData(history, type, unit) {
    const isEnergy = unit && (unit.includes("Wh") || unit.includes("kWh"));

    if (history.length > 1) {
        const start = new Date(history[0].last_changed).getTime();
        const end = new Date(history[history.length - 1].last_changed).getTime();
        const hours = (end - start) / 3600000;

        if (type === 'bar' && hours > 24) {
            return aggregateToDaily(history, isEnergy);
        }
    }

    if (type === 'bar') return aggregateToHourly(history);

    if (history.length > 2000) {
        const step = Math.ceil(history.length / 2000);
        return history.filter((_, i) => i % step === 0 && !isNaN(parseFloat(_.state)))
            .map(pt => ({ x: new Date(pt.last_changed).getTime(), y: parseFloat(pt.state) }));
    }
    return history.filter(pt => !isNaN(parseFloat(pt.state))).map(pt => ({ x: new Date(pt.last_changed).getTime(), y: parseFloat(pt.state) }));
}

/* --- HTML TEMPLATES (VIEWS) --- */

export function createStatsCard(conf, min, avg, max, curr, unit, label) {
    return `
      <div class="stats-card" style="border-left-color: ${conf.color}">
          <div class="stats-header" title="${cleanName(conf.entityId)}">${cleanName(conf.entityId)}</div>
          <div class="stats-row">
              <span>${label}:</span>
              <span class="stats-main-val" style="color:${conf.color}">${curr} ${unit}</span>
          </div>
          <div class="stats-row"><span>Min:</span> <span>${min}</span></div>
          <div class="stats-row"><span>Avg:</span> <span>${avg}</span></div>
          <div class="stats-row"><span>Max:</span> <span>${max}</span></div>
      </div>
   `;
}

export function getSplitCardHTML(index, color, name) {
    return `
       <div class="split-chart-header" style="color:${color}">
           <span>${name}</span>
           <div class="drag-handle" draggable="true" title="Verschieben">
               <svg style="width:20px;height:20px" viewBox="0 0 24 24">
                   <path fill="currentColor" d="M10,9h4V6h3l-5-5l-5,5h3V9z M9,10H6V6l-5,5l5,5v-3h3V10z M14,10v3h3l5-5l-5-5v3h-3z M10,15h4v3h-3l5,5l5-5h-3V15z M13,14h-2v2h2V14z"></path>
               </svg>
           </div>
       </div>
       <div class="split-canvas-container"><canvas id="split-canvas-${index}"></canvas></div>
       <div class="split-footer" id="footer-${index}">
           <div class="split-stats-box"></div>
       </div>
    `;
}

export function getSplitStatsHTML(displayLabel, color, displayVal, unit, min, avg, max) {
    return `
       <div><div class="stat-label">${displayLabel}</div><div class="stat-current" style="color:${color}">${displayVal} <span class="stat-unit">${unit}</span></div></div>
       <div><div class="stat-label">Min</div><div class="stat-value" style="font-size:1em">${min}</div></div>
       <div><div class="stat-label">Ø</div><div class="stat-value" style="font-size:1em">${avg}</div></div>
       <div><div class="stat-label">Max</div><div class="stat-value" style="font-size:1em">${max}</div></div>
    `;
}

export function getCombinedChartHTML(showStats) {
    return `
        <div id="resize-ghost"></div>
        <div class="chart-container-outer" id="chart-container-single">
           <div class="canvas-wrapper"><canvas id="canvas-combined"></canvas></div>
           <div id="resize-handle"><div class="grip-lines"></div></div>
        </div>
        <div id="stats-wrapper" class="stats-wrapper" style="display:${showStats ? 'flex' : 'none'}"></div>
    `;
}

export function getCombinedDoughnutHTML() {
    return `
        <div class="chart-container-outer" id="chart-container-single" style="height: 450px;">
           <div class="doughnut-container-flex" style="display: flex; height: 100%; width: 100%;">
               <div style="flex-grow: 1; position: relative; min-width: 60%;">
                  <canvas id="canvas-combined"></canvas>
               </div>
               <div class="doughnut-sidebar" style="width: 250px; display: flex; flex-direction: column; justify-content: center; padding-left: 20px;">
                  <div id="doughnut-legend-container" style="overflow-y: auto; max-height: 80%;"></div>
                  <div id="doughnut-total-container" style="margin-top: 20px; font-weight: bold; font-size: 1.4em;"></div>
               </div>
           </div>
        </div>
    `;
}

export function getSideBySideHTML(showStats) {
    return `
        <div class="flex-main-wrapper" style="display: flex; gap: 10px; width: 100%;">
            <div class="main-chart-wrapper" style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
                <div id="resize-ghost"></div>
                <div class="chart-container-outer" id="chart-container-single">
                   <div class="canvas-wrapper"><canvas id="canvas-combined"></canvas></div>
                   <div id="resize-handle"><div class="grip-lines"></div></div>
                </div>
            </div>
            <div class="side-donut-wrapper" style="width: 30%; min-width: 300px; max-width: 400px; background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column;">
                <div class="doughnut-container-flex" style="display: flex; flex-direction: column; height: 100%; width: 100%;">
                   <div style="flex-grow: 1; position: relative; min-height: 200px;">
                      <canvas id="canvas-side-donut"></canvas>
                   </div>
                   <div class="doughnut-sidebar" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--divider-color);">
                      <div id="doughnut-legend-container" style="overflow-y: auto; max-height: 150px;"></div>
                      <div id="doughnut-total-container" style="margin-top: 10px; font-weight: bold; font-size: 1.2em; text-align: center;"></div>
                   </div>
               </div>
            </div>
        </div>
        <div id="stats-wrapper" class="stats-wrapper" style="display:${showStats ? 'flex' : 'none'}"></div>
    `;
}

export function getPanelTemplate() {
    return `
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
        * { box-sizing: border-box; }
        .container { display: flex; height: 100%; overflow: hidden; }
        
        .sidebar { 
            width: var(--sidebar-width); min-width: var(--sidebar-width); 
            background-color: var(--card-background-color); 
            border-right: 1px solid var(--divider-color); 
            padding: 20px; display: flex; flex-direction: column; gap: 15px; 
            box-shadow: 2px 0 10px rgba(0,0,0,0.1); overflow-y: auto; 
            scrollbar-width: none; /* Firefox */
        }
        .sidebar::-webkit-scrollbar { display: none; /* Chrome/Safari */ }
        .sidebar > * { flex-shrink: 0; }
        
        /* HEADER STYLES (Title + Loader) */
        .sidebar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-shrink: 0; 
        }
        
        h2 { margin: 0; font-weight: 300; letter-spacing: 1px; font-size: 1.5em; }
        
        label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 4px; display: block; letter-spacing: 0.5px; }
        .control-group { margin-bottom: 5px; position: relative; }
        
        input, select { 
            padding: 12px 10px; border-radius: 4px; border: 1px solid var(--divider-color); 
            background: var(--primary-background-color); color: var(--primary-text-color); 
            font-family: inherit; font-size: 14px; width: 100%; outline: none; 
            transition: border-color 0.2s, box-shadow 0.2s; -webkit-appearance: none; appearance: none;
        }
        input:focus, select:focus { border-color: var(--accent-color); }
        
        .suggestions-list {
            position: absolute; top: 100%; left: 0; right: 0;
            background: var(--secondary-background-color, #2c2c2c); 
            border: 1px solid var(--divider-color);
            border-radius: 4px; max-height: 300px; overflow-y: auto; z-index: 100;
            display: none; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .suggestion-item { padding: 10px; border-bottom: 1px solid var(--divider-color); cursor: pointer; transition: background 0.2s; }
        .suggestion-item:hover { background: rgba(255, 255, 255, 0.1); }
        .s-name { font-weight: 500; font-size: 14px; color: var(--primary-text-color); }
        .s-id { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
        .add-sensor-row { display: flex; gap: 8px; align-items: center; }
        .color-picker { width: 44px; height: 44px; padding: 2px; border-radius: 4px; border: 1px solid var(--divider-color); background: var(--primary-background-color); cursor: pointer; }
        .btn-icon { width: 44px; height: 44px; background: var(--btn-color); color: white; border: none; border-radius: 4px; font-size: 20px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background-color 0.2s; }
        .btn-icon:hover { background-color: #757575; }
        .btn-icon.grey { background-color: #757575; }
        .btn-icon.grey:hover { background-color: #616161; }
        .sensor-list { 
            display: flex; flex-direction: column; gap: 8px; 
            max-height: 230px; 
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
        .saved-view-item { display: flex; align-items: center; gap: 10px; background: rgba(128, 128, 128, 0.1); padding: 10px; border-radius: 4px; font-size: 13px; margin-bottom: 8px; cursor: pointer; transition: background 0.2s; border: 1px solid transparent; }
        .saved-view-item:hover { background: rgba(128, 128, 128, 0.2); border-color: var(--divider-color); }
        .saved-view-name { flex-grow: 1; font-weight: 500; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; cursor: pointer; }
        .toggle-label { font-size: 14px; color: var(--primary-text-color); }
        .toggle-switch { appearance: none; -webkit-appearance: none; width: 40px; height: 24px; flex-shrink: 0; background: rgba(120, 120, 128, 0.3); border-radius: 12px; position: relative; cursor: pointer; outline: none; border: none; transition: background 0.25s; }
        .toggle-switch:checked { background: var(--accent-color); }
        .toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: white; border-radius: 50%; transition: transform 0.25s; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
        .toggle-switch:checked::after { transform: translateX(16px); }
        .slider-row { margin-top: 15px; border-top: 1px solid var(--divider-color); padding-top: 15px; display: none; }
        .slider-row.visible { display: block; }
        .slider-header { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; background: var(--divider-color); border-radius: 3px; outline: none; padding: 0; border: none; margin-top: 5px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-color); cursor: pointer; transition: transform 0.1s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
        
        .mode-switch { display: flex; gap: 0; margin-bottom: 10px; border: 1px solid var(--divider-color); border-radius: 4px; overflow: hidden; flex-shrink: 0; }
        
        .mode-btn { 
            flex: 1; padding: 10px; font-size: 13px; text-align: center; cursor: pointer; 
            background: var(--card-background-color); color: var(--secondary-text-color); 
            transition: all 0.2s; font-weight: 500;
            display: flex; align-items: center; justify-content: center;
            min-height: 40px;
        }
        
        .mode-btn:first-child { border-right: 1px solid var(--divider-color); }
        .mode-btn.active { background: var(--btn-color); color: white; }
        
        .custom-date-container { display: none; flex-direction: column; gap: 10px; }
        .custom-date-container.visible { display: flex; }
        #load-btn { background-color: var(--btn-color); color: white; cursor: pointer; font-weight: 500; border: none; margin-top: 20px; padding: 15px; font-size: 14px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1.25px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: background-color 0.2s; }
        #load-btn:hover { background-color: #757575; }
        #reset-zoom-btn { background-color: var(--card-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); margin-top: 10px; padding: 8px; font-size: 12px; width: 100%; border-radius: 4px; cursor: pointer; display: none; }
        
        .main-content { flex-grow: 1; padding: 20px; display: flex; flex-direction: column; background-color: var(--primary-background-color); overflow-y: auto; position: relative; }
        
        .stats-wrapper { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 15px; }
        .stats-card { padding: 10px 15px; background: var(--card-background-color); border-left: 5px solid transparent; border-radius: 4px; font-size: 0.9rem; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid var(--divider-color); border-left-width: 5px; display: flex; flex-direction: column; gap: 2px; flex: 1 1 calc(19% - 15px); min-width: 200px; }
        .stats-header { font-weight: bold; color: var(--primary-text-color); margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px solid var(--divider-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stats-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.1); }
        .stats-row:last-child { border-bottom: none; }
        .stats-row span:first-child { color: var(--secondary-text-color); text-transform: uppercase; font-size: 0.8em; font-weight: 500; }
        .stats-row span:last-child { font-weight: 700; color: var(--primary-text-color); }
        .stats-main-val { font-size: 1.0em; color: var(--primary-text-color); font-weight: bold; }
        .chart-container-outer { width: 100%; height: 450px; min-height: 200px; position: relative; background: var(--card-background-color); border-radius: 8px; padding: 15px; box-sizing: border-box; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid var(--divider-color); display: flex; flex-direction: column; }
        .canvas-wrapper { flex-grow: 1; position: relative; width: 100%; height: 100%; overflow: hidden; }
        #resize-handle { height: 14px; width: 100%; background: var(--card-background-color); cursor: ns-resize; display: flex; align-items: center; justify-content: center; border-top: 1px solid var(--divider-color); margin-top: 5px; }
        .grip-lines { width: 30px; height: 3px; border-top: 1px solid var(--secondary-text-color); border-bottom: 1px solid var(--secondary-text-color); opacity: 0.5; }
        #resize-ghost { position: absolute; left: 40px; right: 40px; height: 4px; background-color: var(--accent-color); opacity: 0.5; z-index: 100; display: none; pointer-events: none; cursor: ns-resize; }
        
        .split-grid-wrapper { display: flex; flex-wrap: wrap; gap: 10px; width: 100%; }
        
        @media (max-width: 700px) { 
            .split-grid-wrapper { grid-template-columns: 1fr; }
            .stats-wrapper { grid-template-columns: 1fr; } 
            .split-footer { flex-direction: column; }
            .split-controls-box { width: 100%; flex-direction: row; border-left: none; border-top: 1px solid var(--divider-color); padding-left: 0; padding-top: 10px; }
            .doughnut-container-flex { flex-direction: column; }
            .doughnut-sidebar { width: 100% !important; padding-left: 0 !important; margin-top: 20px; }
            .flex-main-wrapper { flex-direction: column; }
            .side-donut-wrapper { width: 100% !important; border-left: none !important; border-top: 1px solid var(--divider-color); padding-left: 0 !important; padding-top: 15px; }
        }
        
        .split-chart-card { background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px; padding: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 0; height: fit-content; flex-grow: 1; transition: opacity 0.2s, border-color 0.2s; }
        .split-chart-card.dragging { opacity: 0.4; }
        .split-chart-card.drag-over { border: 2px dashed var(--accent-color); }
        .split-chart-header { font-weight: bold; font-size: 1.1em; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
        .drag-handle { cursor: grab; padding: 5px; color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s; margin-left: 10px; }
        .drag-handle:hover { background: rgba(128,128,128,0.1); color: var(--primary-text-color); }
        .drag-handle:active { cursor: grabbing; }
        .split-canvas-container { height: 300px; position: relative; width: 100%; }
        .split-footer { display: flex; gap: 20px; margin-top: 10px; align-items: stretch; border-top: 1px solid var(--divider-color); padding-top: 15px; }
        .split-stats-box { flex-grow: 1; background: transparent; border-radius: 0; padding: 5px 0; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; text-align: center; border: none; }
        
        .split-controls-box { 
            width: auto; 
            display: flex; 
            flex-direction: row; 
            gap: 5px; 
            justify-content: flex-start; 
            border-left: 1px solid var(--divider-color); 
            padding-left: 15px; 
            align-items: center;
        }
        .chart-toggle-btn { 
            background: transparent; 
            border: 1px solid var(--divider-color); 
            color: var(--secondary-text-color); 
            width: 32px; 
            height: 32px; 
            padding: 0; 
            border-radius: 4px; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: all 0.2s; 
        }
        .chart-toggle-btn:hover { background: rgba(0,0,0,0.05); color: var(--primary-text-color); }
        .chart-toggle-btn.active { background: var(--btn-color); color: white; border-color: var(--btn-color); }
        
        .stat-value { font-size: 1.2em; font-weight: 700; color: var(--primary-text-color); }
        .stat-label { font-size: 0.8em; color: var(--secondary-text-color); text-transform: uppercase; }
        .stat-current { font-size: 1.1em; font-weight: bold; }
        .stat-unit { font-size: 0.7em; font-weight: normal; opacity: 0.8; }
        
        /* LOADER MOVED TO HEADER */
        .loader { border: 3px solid rgba(0,0,0,0.1); border-top: 3px solid var(--accent-color); border-radius: 50%; width: 24px; height: 24px; animation: spin 0.8s linear infinite; display: none; margin: 0; }
        
        .error-msg { color: #f44336; background: rgba(244, 67, 54, 0.1); padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 13px; display: none; border: 1px solid rgba(244, 67, 54, 0.3); }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .donut-legend-item { display: flex; align-items: center; margin-bottom: 8px; font-size: 13px; cursor: pointer; transition: opacity 0.2s; }
        .donut-legend-item:hover { opacity: 0.8; }
        .donut-legend-item.hidden { text-decoration: line-through; opacity: 0.5; }
        .donut-legend-color { width: 12px; height: 12px; margin-right: 10px; flex-shrink:0; }
      </style>

      <div class="container">
        <div class="sidebar">
          <div class="sidebar-header">
              <h2>📉 Detailed Charts</h2>
              <div class="loader" id="loader"></div>
          </div>
          
          <div class="control-group">
            <label>Sensor hinzufügen:</label>
            <input id="sensor-input" placeholder="Tippen zum Suchen..." autocomplete="off">
            <div id="suggestions" class="suggestions-list"></div>
          </div>
          <div class="control-group add-sensor-row">
             <input type="color" id="color-input" class="color-picker" value="#03a9f4" title="Farbe wählen">
             <button id="add-btn" class="btn-icon" title="Hinzufügen">+</button>
             <button id="clear-all-btn" class="btn-icon grey" title="Alles löschen"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg></button>
             <button id="save-view-btn" class="btn-icon" style="margin-left:auto;" title="Ansicht speichern"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/></svg></button>
          </div>
          <div id="sensor-list-container" class="sensor-list"><div style="color: var(--secondary-text-color); font-size: 12px; text-align: center; padding: 10px;">Liste leer.</div></div>
          <div style="margin-top: 20px; border-top: 1px solid var(--divider-color); padding-top: 15px;">
              <div class="toggle-row" id="toggle-fill-row"><span class="toggle-label">Fläche füllen</span><input type="checkbox" class="toggle-switch" id="fill-switch"></div>
              <div class="control-group" style="margin-top:10px;">
                  <label>Ansicht (Layout)</label>
                  <select id="layout-select">
                      <option value="combined" selected>Kombiniert</option>
                      <option value="split">Getrennt (Grid)</option>
                      <option value="mixed">Mixed (Beides)</option>
                  </select>
              </div>
              <div class="toggle-row" id="toggle-stats-row" style="margin-top: 10px;"><span class="toggle-label">Statistiken anzeigen</span><input type="checkbox" class="toggle-switch" id="stats-switch" checked></div>
              <div class="toggle-row" id="toggle-donut-row" style="margin-top: 10px;"><span class="toggle-label">Donut Sidebar</span><input type="checkbox" class="toggle-switch" id="donut-switch"></div>
              
              <div class="slider-row" id="zoom-slider-row" style="display:block;">
                  <div class="slider-header"><label>Zoom Stufe</label><span id="zoom-value-display" style="font-weight:bold;">100%</span></div>
                  <input type="range" id="zoom-slider" min="0.5" max="1.5" step="0.1" value="1">
              </div>

              <div class="slider-row" id="grid-slider-row">
                  <div class="slider-header"><label>Spalten (Grid)</label><span id="grid-value-display" style="font-weight:bold;">1</span></div>
                  <input type="range" id="grid-slider" min="1" max="4" step="1" value="1">
              </div>
              <div class="toggle-row" id="toggle-stacked-row" style="margin-top: 10px; display:none;"><span class="toggle-label">Stacked Bars</span><input type="checkbox" class="toggle-switch" id="stacked-switch"></div>
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
          <div class="saved-views-section"><label>Gespeicherte Ansichten</label><div id="saved-views-container"></div></div>
          
          <div class="error-msg" id="error-msg"></div>
        </div>
        <div class="main-content" id="main-content-area"></div>
      </div>
    `;
}
