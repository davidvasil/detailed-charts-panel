/* detailed-charts-panel-logic.js */
console.log("DetailedChartsPanelLogic: v_2.3");

import { 
    cleanName, 
    hexToRgba, 
    calculateEnergySum, 
    processData, 
    createStatsCard,
    getSplitCardHTML,
    getSplitStatsHTML,
    getCombinedChartHTML,
    getCombinedDoughnutHTML,
    getSideBySideHTML
} from './detailed-charts-panel-function.js';

import { sharedViews } from './detailed-charts-views.js';

export class DetailedChartsLogic extends HTMLElement {
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
        
        this.chartInstances = []; 
        this.helpers = null; 
        
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
        
        this.hideAxislabels = false;
        this.hideGrid = false;
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
        const p3 = window.jsyaml ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js');

        const p4 = (async () => {
            if (window.loadCardHelpers) {
                this.helpers = await window.loadCardHelpers();
            }
        })();

        Promise.all([p1, p2, p3, p4])
          .then(() => loadScript('/local/community/detailed-charts-panel/chartjs-plugin-zoom.min.js'))
          .then(() => { 
              console.log("DetailedChartsPanel-Libs ready!"); 
              this.libsLoaded = true; 
              if(this._config) {
                   this.loadHistory();
              } else if(this.selectedSensors.length > 0) {
                   this.loadHistory();
              }
          })
          .catch(err => { console.error(err); this.showError("Fehler beim Laden der Libs."); });
    }

    showError(text) {
        const e = this.content.querySelector('#error-msg');
        if(e) { e.innerHTML = text; e.style.display = 'block'; }
        const l = this.content.querySelector('#loader');
        if(l) l.style.display = 'none';
    }

    /* --- DATA LOADING --- */

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
        if(loader) loader.style.display = 'block';
        try {
            const realSensors = this.selectedSensors.filter(s => !s.isCard);
            const promises = realSensors.map(s => this.fetchDataSmart(s.entityId, newStart, newEnd));
            const results = await Promise.all(promises);
            
            this._sensorDataCache = results.map(res => ({ data: res, startTime: newStart, endTime: newEnd }));
            this._globalStartTime = newStart; 
            this._globalEndTime = newEnd;
            if (this.chartInstances.length > 0) {
                this.updateAllChartsWithNewData(results, newStart, newEnd);
            } else {
                setTimeout(() => this.updateChartFromCache(), 50);
            }

        } catch (e) { console.error(e); } finally { if(loader) loader.style.display = 'none'; }
    }

    updateAllChartsWithNewData(newResults, startTime, endTime) {
        const realSensors = this.selectedSensors.filter(s => !s.isCard);
        
        // 1. Update Chart Instances (Data + X-Axis)
        this.chartInstances.forEach(chart => {
            if(chart.config.type === 'doughnut') return; 
            
            // X-Achse setzen
            if (chart.options.scales.x) {
                chart.options.scales.x.min = startTime.getTime();
                chart.options.scales.x.max = endTime.getTime();
            }

            // Datasets aktualisieren
            chart.data.datasets.forEach(ds => {
                if (ds._entityId) {
                    const sensorIdx = realSensors.findIndex(s => s.entityId === ds._entityId);
                    if (sensorIdx >= 0 && newResults[sensorIdx]) {
                        const conf = realSensors[sensorIdx];
                        const unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
                        
                        let type = ds.type || chart.config.type;
                        if(type === 'stepped') type = 'line';

                        let points = processData(newResults[sensorIdx], type, unit, startTime);
                        
                        if (this.autoScale) {
                           if (unit === 'W' || unit === 'kW') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                           if (unit === 'Wh' || unit === 'kWh') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                        }
                        ds.data = points;
                    }
                }
            });
            chart.update('none'); // 'none' Mode verhindert Animation = weniger Flackern
        });

        // 2. Statistiken neu berechnen (Footer & Top)
        const calcStats = (points, unit, type) => {
             const values = points.map(p => p.y);
             const min = values.length ? Math.min(...values) : 0;
             const max = values.length ? Math.max(...values) : 0;
             const sum = values.reduce((a,b)=>a+b,0);
             const avg = values.length ? (sum/values.length) : 0;
             const curr = values.length ? values[values.length-1] : 0;
             
             let displayVal = curr.toFixed(2); 
             let displayLabel = "AKTUELL";
             if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
                 const hours = (endTime - startTime) / 3600000;
                 const isAggregated = (type === 'bar' && hours > 24);
                 displayVal = calculateEnergySum(values, isAggregated).toFixed(2);
                 displayLabel = "SUMME";
             }
             return { min: min.toFixed(2), max: max.toFixed(2), avg: avg.toFixed(2), curr: displayVal, label: displayLabel };
        };

        // Update Split Cards (Footer)
        this.selectedSensors.forEach((s, idx) => {
            if(s.isCard) return;
            // Suche Footer im ShadowRoot (funktioniert für Mixed & Split Layout)
            // Hinweis: Im Mixed Mode sind die Split-Indizes oft verschoben oder separat, 
            // aber renderSplitView nutzt dataset-index.
            const card = this.shadowRoot.querySelector(`.split-chart-card[data-index="${idx}"]`);
            if(card) {
                const footer = card.querySelector('.split-stats-box');
                if(footer) {
                    const sensorIdx = realSensors.findIndex(rs => rs.entityId === s.entityId);
                    if(sensorIdx >= 0 && newResults[sensorIdx]) {
                         const unit = this._hass.states[s.entityId]?.attributes?.unit_of_measurement || '';
                         let type = s.typeOverride || this.content.querySelector('#chart-type').value;
                         if (this.stackedBars) type = 'bar';
                         
                         let points = processData(newResults[sensorIdx], type, unit, startTime);
                         if (this.autoScale) {
                            if (unit === 'W' || unit === 'kW') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                            if (unit === 'Wh' || unit === 'kWh') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                         }
                         const stats = calcStats(points, unit, type);
                         footer.innerHTML = getSplitStatsHTML(stats.label, s.color, stats.curr, unit, stats.min, stats.avg, stats.max);
                    }
                }
            }
        });
        
        // Update Combined Stats (Top Wrapper)
        const statsWrapper = this.shadowRoot.querySelector('#stats-wrapper') || this.shadowRoot.querySelector('#stats-wrapper-top');
        if(statsWrapper && statsWrapper.style.display !== 'none') {
            let html = '';
            realSensors.forEach((s, idx) => {
                if (s.hidden) return;
                const unit = this._hass.states[s.entityId]?.attributes?.unit_of_measurement || '';
                let type = this.content.querySelector('#chart-type').value;
                if (this.stackedBars) type = 'bar';
                
                let points = processData(newResults[idx], type, unit, startTime);
                if (this.autoScale) {
                   if (unit === 'W' || unit === 'kW') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                   if (unit === 'Wh' || unit === 'kWh') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                }
                const stats = calcStats(points, unit, type);
                html += createStatsCard(s, stats.min, stats.avg, stats.max, stats.curr, unit, stats.label);
            });
            statsWrapper.innerHTML = html;
        }
    }

    async loadSingleSensorHistory(index, startTime, endTime) {
        // --- INDEPENDENT SCROLL LOGIC ---
        // Lädt Daten nur für EINEN Chart und aktualisiert nur diesen,
        // ohne die anderen oder das Hauptdiagramm zu beeinflussen.
        
        const loader = this.content.querySelector('#loader');
        if(loader) loader.style.display = 'block';
        
        try {
            const sensorConfig = this.selectedSensors[index];
            if(!sensorConfig || sensorConfig.isCard) return;

            // 1. Fetch new data for this specific sensor
            const newData = await this.fetchDataSmart(sensorConfig.entityId, startTime, endTime);

            // 2. Update Cache for this sensor only
            let cacheIndex = 0;
            for(let i=0; i<index; i++) {
                if(!this.selectedSensors[i].isCard) cacheIndex++;
            }
            
            if(this._sensorDataCache[cacheIndex]) {
                this._sensorDataCache[cacheIndex] = { 
                    data: newData, 
                    startTime: startTime, 
                    endTime: endTime 
                };
            }

            // 3. Update the specific Chart Instance directly
            const canvasId = `split-canvas-${index}`;
            const chart = this.chartInstances.find(c => c.canvas.id === canvasId);

            if(chart) {
                const unit = this._hass.states[sensorConfig.entityId]?.attributes?.unit_of_measurement || '';
                let currentType = sensorConfig.typeOverride || this.content.querySelector('#chart-type').value;
                if (this.stackedBars) currentType = 'bar'; 
                
                let points = processData(newData, currentType, unit, startTime);
                
                // AutoScale logic locally applied
                if (this.autoScale) {
                   if (unit === 'W' || unit === 'kW') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                   if (unit === 'Wh' || unit === 'kWh') points = points.map(p => ({x: p.x, y: p.y / 1000}));
                }

                // Update Chart Data & Scales
                chart.data.datasets[0].data = points;
                chart.options.scales.x.min = startTime.getTime();
                chart.options.scales.x.max = endTime.getTime();
                chart.update('none'); // Prevent flicker
                
                // 4. Update Stats Footer locally
                const values = points.map(p => p.y);
                const min = values.length ? Math.min(...values) : 0;
                const max = values.length ? Math.max(...values) : 0;
                const sum = values.reduce((a,b)=>a+b,0);
                const avg = values.length ? (sum/values.length) : 0;
                const curr = values.length ? values[values.length-1] : 0;

                const card = this.shadowRoot.querySelector(`.split-chart-card[data-index="${index}"]`);
                if(card) {
                    const footer = card.querySelector(`#footer-${index} .split-stats-box`);
                    if(footer) {
                        let displayVal = curr.toFixed(2); 
                        let displayLabel = "Aktuell";
                        if (unit && (unit.includes("Wh") || unit.includes("kWh"))) {
                             const hours = (endTime - startTime) / 3600000;
                             const isAggregated = (currentType === 'bar' && hours > 24);
                             displayVal = calculateEnergySum(values, isAggregated).toFixed(2);
                             displayLabel = "Summe";
                        }
                        
                        footer.innerHTML = getSplitStatsHTML(
                            displayLabel, 
                            sensorConfig.color, 
                            displayVal, 
                            unit, 
                            min.toFixed(2), 
                            avg.toFixed(2), 
                            max.toFixed(2)
                        );
                    }
                }
            }

        } catch (e) {
            console.error("Single chart update failed", e);
        } finally {
            if(loader) loader.style.display = 'none';
        }
    }

    async loadHistory() {
        const chartType = this.content.querySelector('#chart-type').value;
        const loader = this.content.querySelector('#loader');
        const errDiv = this.content.querySelector('#error-msg');
        if(errDiv) errDiv.style.display = 'none';
        if (!this.libsLoaded || this.selectedSensors.length === 0) return;
        let st, et, dh;
        const now = new Date();
        if (this.timeMode === 'relative') { dh = parseInt(this.content.querySelector('#time-select').value); et = now; st = new Date(now.getTime() - (dh * 3600000)); } 
        else { st = new Date(this.content.querySelector('#date-start').value); et = new Date(this.content.querySelector('#date-end').value); dh = (et - st) / 3600000; if (st >= et) { this.showError("Enddatum muss nach Startdatum liegen."); return; } }
        if (chartType === 'scatter' && dh > 24.1) { this.showError("Scatter nur <= 24h."); return; }
        this._globalStartTime = st;
        this._globalEndTime = et;
        if(loader) loader.style.display = 'block';
        this._sensorDataCache = []; 
        try {
            const realSensors = this.selectedSensors.filter(s => !s.isCard);
            const promises = realSensors.map(s => this.fetchDataSmart(s.entityId, st, et));
            const results = await Promise.all(promises);
            results.forEach(res => { this._sensorDataCache.push({ data: res, startTime: st, endTime: et }); });
            this.updateChartFromCache();
        } catch (e) { console.error(e); this.showError(`Fehler: ${e.message}`); } finally { if(loader) loader.style.display = 'none'; }
    }

    updateChartFromCache() {
        const chartType = this.content.querySelector('#chart-type').value;
        let st, et;
        if (this._sensorDataCache.length > 0) {
            st = this._sensorDataCache[0].startTime;
            et = this._sensorDataCache[0].endTime;
        } else {
            et = new Date();
            st = new Date(et.getTime() - 24*3600*1000);
            this._globalStartTime = st;
            this._globalEndTime = et;
        }
        this.renderDispatcher(this._sensorDataCache, chartType, st, et);
    }

    /* --- CHART RENDERING LOGIC --- */

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

    renderDoughnut(cacheData, ctx, statsWrapper) {
        const legendContainer = statsWrapper ? null : (this.shadowRoot.getElementById('doughnut-legend-container') || this.content.querySelector('#doughnut-legend-container'));
        const totalContainer = statsWrapper ? null : (this.shadowRoot.getElementById('doughnut-total-container') || this.content.querySelector('#doughnut-total-container'));

        const styles = getComputedStyle(this);
        const labels=[], values=[], bgColors=[], units=[];
        let totalSum = 0;
        const st = this._globalStartTime;
        const et = this._globalEndTime;
        const hours = (et - st) / 3600000;
        const isDailyAgg = (hours > 24);

        let cacheIdx = 0;
        this.selectedSensors.forEach((conf) => {
            if (conf.isCard) return;
            const obj = cacheData[cacheIdx];
            cacheIdx++;
            
            if(!conf || !obj || !obj.data.length) return;
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
                // --- UPDATED: Use alias ---
                labels.push(conf.alias || cleanName(conf.entityId));
                values.push(sensorSum);
                bgColors.push(conf.color);
                units.push(unit);
                totalSum += sensorSum;
            }
        });

        if (legendContainer) {
            legendContainer.innerHTML = '';
            labels.forEach((label, i) => {
                const val = values[i];
                const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : 0;
                const item = document.createElement('div');
                item.className = 'donut-legend-item';
                item.innerHTML = `
                    <div class="donut-legend-left">
                        <div class="donut-legend-color" style="background-color:${bgColors[i]}"></div>
                        <div title="${label}" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</div>
                    </div>
                    <div class="donut-legend-right">${pct}%</div>
                `;
                item.onclick = () => {
                    const meta = chart.getDatasetMeta(0);
                    const currentHidden = meta.data[i].hidden;
                    meta.data[i].hidden = !currentHidden;
                    item.classList.toggle('hidden', !currentHidden);
                    chart.update();
                };
                legendContainer.appendChild(item);
            });
        }

        if (totalContainer && units.length > 0) {
            totalContainer.textContent = `${totalSum.toFixed(2)} ${units[0]}`;
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
        let cacheIdx = 0;

        this.selectedSensors.forEach((conf) => {
            if (conf.isCard) return; 
            const sensorDataObj = cacheData[cacheIdx];
            cacheIdx++;
            
            if (!conf || !sensorDataObj || !sensorDataObj.data.length) return;
            let unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
            
            const useRightAxis = (unit === '%' || cleanName(conf.entityId).toLowerCase().includes('soc'));
            if (useRightAxis) hasSecondaryAxis = true;

            let effectiveType = this.stackedBars ? 'bar' : chartType;
            if (useRightAxis) effectiveType = 'line'; 
            
            let isStepped = false;
            if (effectiveType === 'stepped') { effectiveType = 'line'; isStepped = true; }

            let points = processData(sensorDataObj.data, effectiveType, unit, st);
            if (!points.length) return;
            
            if (this.autoScale) {
               if (unit === 'W') { points = points.map(p => ({x: p.x, y: p.y / 1000})); unit = 'kW'; } 
               else if (unit === 'Wh') { points = points.map(p => ({x: p.x, y: p.y / 1000})); unit = 'kWh'; }
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
            
            let dsBgColor = conf.color; 
            if (this.fillArea && effectiveType === 'line') {
                const grad = ctx.createLinearGradient(0, 0, 0, 400);
                grad.addColorStop(0, hexToRgba(conf.color, 0.5));
                grad.addColorStop(1, hexToRgba(conf.color, 0.05));
                dsBgColor = grad;
            }

            const isHidden = conf.hidden === true;
            // --- UPDATED: Use alias and store entityId ---
            datasets.push({ 
                label: conf.alias || cleanName(conf.entityId), 
                _entityId: conf.entityId, // Store original ID for lookups
                hidden: isHidden, 
                data: points, 
                borderColor: conf.color, 
                backgroundColor: dsBgColor, 
                fill: this.fillArea && !this.monochromeMode, 
                borderWidth: (effectiveType === 'bar') ? 0 : 2.5, 
                categoryPercentage: 0.98, 
                barPercentage: 0.98, 
                pointRadius: (effectiveType === 'scatter') ? 4 : 0, 
                pointHoverRadius: 6, 
                pointBackgroundColor: conf.color, 
                pointBorderColor: conf.color,
                tension: this.chartTension / 10,
                stepped: isStepped, 
                yAxisID: useRightAxis ? 'y1' : 'y', 
                type: effectiveType 
            });
        });
        
        if (this.thresholdValue !== null && this.thresholdValue !== '') {
            const val = parseFloat(this.thresholdValue);
            if(!isNaN(val)) {
                datasets.push({
                    label: 'Limit',
                    data: [{x: st.getTime(), y: val}, {x: et.getTime(), y: val}],
                    borderColor: '#f44336', borderWidth: 1.5, borderDash: [10, 5],
                    pointRadius: 0, fill: false, type: 'line', yAxisID: 'y', order: -1
                });
            }
        }

        if(statsWrapper) statsWrapper.innerHTML = allStatsHTML;
        const finalChartType = (this.stackedBars ? 'bar' : (chartType === 'stepped' ? 'line' : chartType));
        this.createChartInstance(ctx, finalChartType, datasets, st, et, true, null, false, hasSecondaryAxis);

        if (this.showDonutSidebar && chartType !== 'doughnut') {
            const donutCanvas = wrapper.querySelector('#canvas-side-donut');
            if (donutCanvas) {
                const ctxDonut = donutCanvas.getContext('2d');
                this.renderDoughnut(cacheData, ctxDonut, null);
            }
        }
    }

    renderSplitView(cacheData, globalChartType, container) {
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'split-grid-wrapper';
        
        gridWrapper.style.setProperty('--grid-cols', this.gridColumns);
        
        container.appendChild(gridWrapper);
        const st = this._globalStartTime || cacheData[0]?.startTime || new Date();
        const et = this._globalEndTime || cacheData[0]?.endTime || new Date();

        let cacheIdx = 0;

        this.selectedSensors.forEach((conf, idx) => {
            const card = document.createElement('div');
            card.className = 'split-chart-card';
            card.dataset.index = idx; 
            
            if (conf.isCard) {
                // --- UPDATED: Use alias ---
                const name = conf.alias || conf.entityId || "Custom Card";
                card.innerHTML = getSplitCardHTML(idx, '#ffffff', name, true);
                gridWrapper.appendChild(card);
                
                const contentContainer = card.querySelector(`#custom-card-container-${idx}`);
                if (this.helpers && conf.cardConfig) {
                    const el = this.helpers.createCardElement(conf.cardConfig);
                    if (el) { 
                        if (this._hass) el.hass = this._hass; 
                        
                        el.style.width = "100%";
                        el.style.height = "100%";
                        el.style.display = "block";
                        
                        contentContainer.appendChild(el); 
                        
                        setTimeout(() => {
                            if(el.requestUpdate) el.requestUpdate();
                            if(el.resized) el.resized();
                        }, 50);
                    } 
                    else { contentContainer.innerHTML = "Fehler beim Laden der Karte."; }
                } else { contentContainer.innerHTML = "Helpers nicht geladen."; }
                
                const handle = card.querySelector('.drag-handle');
                handle.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(card, 0, 0); card.classList.add('dragging'); });
                handle.addEventListener('dragend', () => { card.classList.remove('dragging'); this.shadowRoot.querySelectorAll('.split-chart-card').forEach(c => c.classList.remove('drag-over')); });
                card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; card.classList.add('drag-over'); });
                card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
                card.addEventListener('drop', (e) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData('text/plain')); if (fromIndex !== idx) { this.reorderSensors(fromIndex, idx); } });
                return; 
            }
            
            const sensorDataObj = cacheData[cacheIdx];
            cacheIdx++;
            if (!sensorDataObj || !sensorDataObj.data.length) return;
            
            // --- FIX: Use independent chart time if available in cache ---
            const chartSt = sensorDataObj.startTime || st;
            const chartEt = sensorDataObj.endTime || et;
            const hours = (chartEt - chartSt) / 3600000;

            // --- UPDATED: Use alias ---
            card.innerHTML = getSplitCardHTML(idx, conf.color, conf.alias || cleanName(conf.entityId), false);
            gridWrapper.appendChild(card);
            
            const handle = card.querySelector('.drag-handle');
            handle.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setDragImage(card, 0, 0); card.classList.add('dragging'); });
            handle.addEventListener('dragend', () => { card.classList.remove('dragging'); this.shadowRoot.querySelectorAll('.split-chart-card').forEach(c => c.classList.remove('drag-over')); });
            card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
            card.addEventListener('drop', (e) => { e.preventDefault(); const fromIndex = parseInt(e.dataTransfer.getData('text/plain')); if (fromIndex !== idx) { this.reorderSensors(fromIndex, idx); } });

            let currentType = conf.typeOverride || globalChartType;
            let unit = this._hass.states[conf.entityId]?.attributes?.unit_of_measurement || '';
            let isStepped = false;
            if (currentType === 'stepped') { currentType = 'line'; isStepped = true; }

            let points = processData(sensorDataObj.data, currentType, unit, chartSt);
            if (this.autoScale) {
               if (unit === 'W') { points = points.map(p => ({x: p.x, y: p.y / 1000})); unit = 'kW'; } 
               else if (unit === 'Wh') { points = points.map(p => ({x: p.x, y: p.y / 1000})); unit = 'kWh'; }
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
            btnLine.className = `chart-toggle-btn ${currentType === 'line' ? 'active' : ''}`; btnLine.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z"></path></svg>`;
            const btnBar = document.createElement('button');
            btnBar.className = `chart-toggle-btn ${currentType === 'bar' ? 'active' : ''}`; btnBar.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M22,21H2V3H4V19H6V10H10V19H12V6H16V19H18V14H22V21Z"></path></svg>`;
            const btnScatter = document.createElement('button');
            btnScatter.className = `chart-toggle-btn ${currentType === 'scatter' ? 'active' : ''}`; btnScatter.innerHTML = `<svg style="width:20px;height:20px" viewBox="0 0 24 24"><path fill="currentColor" d="M11 6C11 4.9 10.1 4 9 4S7 4.9 7 6 7.9 8 9 8 11 7.1 11 6M5 13C3.9 13 3 13.9 3 15S3.9 17 5 17 7 16.1 7 15 6.1 13 5 13M13 11C11.9 11 11 10.1 11 9S11.9 7 13 7 15 7.9 15 9 14.1 11 13 11M16 15C14.9 15 14 15.9 14 17S14.9 19 16 19 18 18.1 18 17 17.1 15 16 15M20 20H4V4H2V22H22V20Z"></path></svg>`;

            controlsBox.appendChild(btnLine); controlsBox.appendChild(btnBar); controlsBox.appendChild(btnScatter);
            footer.appendChild(controlsBox);

            const canvasId = `split-canvas-${idx}`;
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
                // --- UPDATED: Use alias ---
                const dataset = { 
                    label: conf.alias || cleanName(conf.entityId), 
                    _entityId: conf.entityId,
                    data: newPoints, borderColor: conf.color, backgroundColor: bg, 
                    fill: this.fillArea, borderWidth: (newType === 'bar') ? 0 : 2.5, categoryPercentage: 0.98, barPercentage: 0.98, 
                    pointRadius: pRadius, pointHoverRadius: 6, pointBackgroundColor: conf.color, tension: this.chartTension / 10, stepped: isStepped 
                };
                this.createChartInstance(ctx, newType, [dataset], sensorDataObj.startTime, sensorDataObj.endTime, false, idx, true);
            };
            btnLine.onclick = () => updateThisChart('line');
            btnBar.onclick = () => updateThisChart('bar');
            btnScatter.onclick = () => updateThisChart('scatter');
            
            let bg = conf.color;
            if (this.fillArea && currentType === 'line') {
                const grad = ctx.createLinearGradient(0, 0, 0, 300);
                grad.addColorStop(0, hexToRgba(conf.color, 0.5));
                grad.addColorStop(1, hexToRgba(conf.color, 0.05));
                bg = grad;
            }
            
            // --- UPDATED: Use alias ---
            const dataset = { 
                label: conf.alias || cleanName(conf.entityId), 
                _entityId: conf.entityId,
                data: points, borderColor: conf.color, backgroundColor: bg, 
                fill: this.fillArea, borderWidth: (currentType === 'bar') ? 0 : 2.5, pointRadius: (currentType === 'scatter' ? 4 : 0),
                tension: this.chartTension / 10, stepped: isStepped 
            };
            this.createChartInstance(ctx, currentType, [dataset], chartSt, chartEt, false, idx, true);
        });
    }

    createChartInstance(ctx, type, datasets, startTime, endTime, showZoomBtn, sensorIndex, hideLegend, hasSecondaryAxis) {
        const styles = getComputedStyle(this);
        const textColor = styles.getPropertyValue('--primary-text-color').trim();
        const gridColor = styles.getPropertyValue('--divider-color').trim();
        const secondaryText = styles.getPropertyValue('--secondary-text-color').trim();
        const resetBtn = this.content.querySelector('#reset-zoom-btn');

        if (window.Chart && !window.Chart.Tooltip.positioners.fixedTopRight) {
            window.Chart.Tooltip.positioners.fixedTopRight = function(elements, eventPosition) {
                const chart = this.chart;
                return { x: chart.chartArea.right, y: chart.chartArea.top };
            };
        }

        const verticalHoverLine = {
            id: 'verticalHoverLine',
            afterDraw: (chart) => {
                if (chart.tooltip?._active?.length) {
                    const activePoint = chart.tooltip._active[0];
                    const ctx = chart.ctx;
                    const x = activePoint.element.x;
                    const topY = chart.chartArea.top;
                    const bottomY = chart.chartArea.bottom;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(x, topY);
                    ctx.lineTo(x, bottomY);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = styles.getPropertyValue('--accent-color').trim() || '#03a9f4';
                    ctx.setLineDash([5, 5]); ctx.globalAlpha = 0.6;
                    ctx.stroke(); ctx.restore();
                }
            }
        };

        const chart = new window.Chart(ctx, {
            type: type === 'stepped' ? 'line' : type,
            data: { datasets },
            plugins: [verticalHoverLine], 
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 0 }, hover: { animationDuration: 0 }, 
                interaction: { mode: 'x', intersect: false }, 
                plugins: {
                    legend: { 
                        display: !hideLegend, position: 'top', align: 'end', 
                        labels: { color: textColor, usePointStyle: true, boxWidth: 8, boxPadding: 6, padding: 15, generateLabels: (chart) => { const original = Chart.defaults.plugins.legend.labels.generateLabels(chart); original.forEach(label => { label.text = '\u00A0\u00A0' + label.text; }); return original; } } 
                    },
                    tooltip: {
                        position: 'fixedTopRight', xAlign: 'right', yAlign: 'top',
                        backgroundColor: 'rgba(20, 20, 20, 0.95)', titleColor: '#fff', bodyColor: '#bbb', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12,
                        callbacks: {
                            title: (c) => new Date(c[0].parsed.x).toLocaleString('de-DE'), 
                            label: (c) => {
                                const ds = c.dataset;
                                const lbl = ds.label || '';
                                
                                // --- UPDATED: Retrieve Unit correctly even if renamed ---
                                let unit = '';
                                if(ds._entityId) {
                                     // Direct lookup from stored entityId
                                     unit = this._hass.states[ds._entityId]?.attributes?.unit_of_measurement || '';
                                } else {
                                     // Fallback search (match label or entity name)
                                     const s = this.selectedSensors.find(s => (s.alias || cleanName(s.entityId)) === lbl);
                                     if(s) unit = this._hass.states[s.entityId]?.attributes?.unit_of_measurement || '';
                                }

                                const val = c.parsed.y;
                                if(lbl === 'Limit') return `\u00A0\u00A0Limit: ${val}`;
                                if (this.autoScale) { if (unit === 'W') unit = 'kW'; if (unit === 'Wh') unit = 'kWh'; }
                                return `\u00A0\u00A0${lbl}: ${c.formattedValue} ${unit}`;
                            }
                        }
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x', 
                               onPan: () => { if(showZoomBtn) resetBtn.style.display = 'block'; },
                               onPanComplete: ({chart}) => { 
                                   const min = chart.scales.x.min; const max = chart.scales.x.max; chart.stop();
                                   if (this.layoutMode !== 'combined' && sensorIndex !== null) { this.loadSingleSensorHistory(sensorIndex, new Date(min), new Date(max)); } 
                                   else { if (min < startTime.getTime() || max > endTime.getTime()) { this.loadSpecificRange(new Date(min), new Date(max)); } }
                               } 
                        },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x', onZoom: () => { if(showZoomBtn) resetBtn.style.display = 'block'; } }
                    }
                },
                scales: {
                    x: {
                        type: 'linear', position: 'bottom', min: startTime.getTime(), max: endTime.getTime(), stacked: this.stackedBars, offset: false, 
                        ticks: { display: !this.hideAxislabels, color: secondaryText, maxTicksLimit: 8, callback: function(value) { const d = new Date(value); const diffHours = (endTime - startTime) / (1000 * 60 * 60); if (diffHours > 48) return d.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}); return d.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}); } },
                        grid: { color: gridColor, drawBorder: false, display: !this.hideGrid } 
                    },
                    y: { 
                        type: 'linear', position: 'left', stacked: this.stackedBars, grace: '5%', 
                        ticks: { display: !this.hideAxislabels, color: secondaryText }, 
                        grid: { color: gridColor, borderDash: [5, 5], display: !this.hideGrid } 
                    },
                    y1: {
                        type: 'linear', display: !!hasSecondaryAxis, position: 'right', grid: { drawOnChartArea: false }, 
                        ticks: { display: !this.hideAxislabels, color: secondaryText, callback: function(value) { return value + '%'; } } 
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
