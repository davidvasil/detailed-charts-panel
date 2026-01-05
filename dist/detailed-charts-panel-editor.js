/* detailed-charts-panel-editor.js */
console.log("DetailedChartsPanelEditor: V1.2 - Fix Type Missing Error");

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

// Hilfsfunktion zum Laden von js-yaml
const loadJsYaml = async () => {
    if (window.jsyaml) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Could not load js-yaml'));
        document.head.appendChild(script);
    });
};

class DetailedChartsPanelEditor extends HTMLElement {
    constructor() {
        super();
        this._config = {};
        this._yamlLoaded = false;
        this._showEditor = false; 
    }

    setConfig(config) {
        // Prüfung: Wenn die Config identisch ist, nichts tun (verhindert Cursor-Springen)
        if (JSON.stringify(config) === JSON.stringify(this._config)) return;

        this._config = config;
        
        if (config.sensors && config.sensors.length > 0) {
            this._showEditor = true;
        }
        
        // Nur rendern, wenn wir nicht gerade mitten im Tippen sind oder es der erste Load ist
        const editor = this.shadowRoot ? this.shadowRoot.querySelector('ha-code-editor') : null;
        if (!editor) {
            this.render();
        }
    }

    async connectedCallback() {
        try {
            await loadJsYaml();
            this._yamlLoaded = true;
            // Nach dem Laden der Lib einmal rendern, falls noch nicht geschehen
            if(!this.shadowRoot || !this.shadowRoot.querySelector('ha-code-editor')) {
                this.render();
            }
        } catch (e) {
            console.error("YAML Lib load failed", e);
        }
    }

    render() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }

        const styles = `
            <style>
                .editor-container {
                    padding: 0; 
                    color: var(--primary-text-color, #fff);
                    font-family: 'Roboto', sans-serif;
                }
                .intro-box {
                    text-align: center;
                    padding: 30px;
                    border: 1px dashed var(--divider-color, #444);
                    border-radius: 8px;
                    margin: 20px;
                }
                .btn-add {
                    background-color: var(--primary-color, #03a9f4);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    font-size: 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 0.2s;
                }
                .btn-add:hover {
                    background-color: var(--primary-color-light, #35baf6);
                }
                .code-editor-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .label-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--secondary-text-color);
                    margin-bottom: 5px;
                }
                
                ha-code-editor {
                    --code-editor-background-color: var(--secondary-background-color);
                }
                
                .status-msg {
                    font-size: 12px;
                    margin-top: 5px;
                }
                .status-ok { color: var(--success-color, #4caf50); }
                .status-err { color: var(--error-color, #f44336); }
                .info-hint {
                    background: rgba(3, 169, 244, 0.1);
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 13px;
                    margin-bottom: 10px;
                    border-left: 3px solid var(--primary-color, #03a9f4);
                }
            </style>
        `;

        if (!this._showEditor) {
            this.shadowRoot.innerHTML = `
                ${styles}
                <div class="editor-container">
                    <div class="intro-box">
                        <div style="margin-bottom:15px; font-size:1.1em;">Noch keine Konfiguration vorhanden.</div>
                        <button class="btn-add" id="btn-open-editor">
                            <svg style="width:24px;height:24px" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
                            </svg>
                            Card Konfiguration einfügen
                        </button>
                    </div>
                </div>
            `;
            this.shadowRoot.querySelector('#btn-open-editor').addEventListener('click', () => {
                this._showEditor = true;
                this.render();
            });
            return;
        }

        let textValue = "";
        if (this._yamlLoaded && window.jsyaml && this._config) {
            const exportConfig = { ...this._config };
            // Type entfernen für die Anzeige, damit es sauberer aussieht
            delete exportConfig.type; 
            try {
                textValue = window.jsyaml.dump(exportConfig);
            } catch (e) {
                textValue = JSON.stringify(exportConfig, null, 2);
            }
        } else {
            textValue = "# Lade YAML Lib...";
        }

        this.shadowRoot.innerHTML = `
            ${styles}
            <div class="editor-container">
                <div class="info-hint">
                    <b>Anleitung:</b> Kopiere den YAML-Code aus dem "Detailed Charts Panel" (Export-Button) und füge ihn hier ein.
                </div>
                <div class="code-editor-wrapper">
                    <div class="label-row">
                        <span>Card Konfiguration (YAML) *</span>
                        <svg id="clear-btn" style="width:20px;height:20px;cursor:pointer;opacity:0.7;" viewBox="0 0 24 24" title="Alles löschen">
                            <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" />
                        </svg>
                    </div>
                    
                    <ha-code-editor 
                        mode="yaml"
                        autofocus
                        autocomplete-entities
                        autocomplete-icons
                    ></ha-code-editor>

                    <div id="status-display" class="status-msg"></div>
                </div>
            </div>
        `;

        const editor = this.shadowRoot.querySelector('ha-code-editor');
        const status = this.shadowRoot.querySelector('#status-display');
        const clearBtn = this.shadowRoot.querySelector('#clear-btn');
        
        editor.value = textValue;

        clearBtn.addEventListener('click', () => {
             editor.value = '';
             this._handleInput('');
        });

        editor.addEventListener('value-changed', (e) => {
            this._handleInput(e.detail.value);
        });
    }

    _handleInput(value) {
        const status = this.shadowRoot.querySelector('#status-display');
        if (!value.trim()) {
            status.textContent = "";
            return;
        }

        try {
            let parsed;
            if (this._yamlLoaded && window.jsyaml) {
                parsed = window.jsyaml.load(value);
            } else {
                parsed = JSON.parse(value);
            }

            if (!parsed || typeof parsed !== 'object') throw new Error("Ungültiges Format");

            // WICHTIG: Type wieder hinzufügen, sonst meckert HA!
            // Wir überschreiben es sicherheitshalber immer, damit es passt.
            parsed.type = 'custom:detailed-charts-panel';

            this._config = parsed;
            
            status.textContent = "Konfiguration gültig ✓";
            status.className = "status-msg status-ok";

            fireEvent(this, 'config-changed', { config: this._config });

        } catch (e) {
            status.textContent = "Fehler: " + e.message;
            status.className = "status-msg status-err";
        }
    }
}

customElements.define('detailed-charts-panel-editor', DetailedChartsPanelEditor);
