import { LitElement, html, css } from 'https://unpkg.com/lit?module';

const Y_MAX = 60; // knots

class HaWindStatCard extends LitElement {
  static properties = {
    hass: {},
    _config: {},
    _data: { state: true },
    _maxGust: { state: true },
    _lastUpdated: { state: true },
    _noData: { state: true }
  };

  setConfig(config) {
    if (!config.wind_entity || !config.gust_entity) {
      this._noData = true;
      this._error = 'wind_entity and gust_entity must be set';
      return;
    }
    this._config = { minutes: 30, ...config };
  }

  connectedCallback() {
    super.connectedCallback();
    this._fetchData();
    this._interval = setInterval(() => this._fetchData(), 60000);
  }

  disconnectedCallback() {
    clearInterval(this._interval);
    super.disconnectedCallback();
  }

  async _fetchData() {
    if (!this.hass || !this._config) return;
    const minutes = this._config.minutes;
    const start = new Date(Date.now() - minutes * 60000).toISOString();
    const ids = `${this._config.wind_entity},${this._config.gust_entity}`;
    try {
      const hist = await this.hass.callApi(
        'GET',
        `history/period/${start}?filter_entity_id=${ids}&minimal_response`
      );
      const windHist = hist.find(h => h[0]?.entity_id === this._config.wind_entity) || [];
      const gustHist = hist.find(h => h[0]?.entity_id === this._config.gust_entity) || [];

      this._noData = !windHist.length && !gustHist.length;

      const avgPerMinute = entries => {
        const map = {};
        entries.forEach(e => {
          const t = new Date(e.last_changed || e.last_updated);
          const key = t.toISOString().slice(0, 16);
          const val = parseFloat(e.state);
          if (isNaN(val)) return;
          if (!map[key]) map[key] = { sum: 0, count: 0 };
          map[key].sum += val;
          map[key].count += 1;
        });
        const out = [];
        Object.keys(map).forEach(k => {
          out.push({ minute: k, avg: map[k].sum / map[k].count });
        });
        out.sort((a, b) => new Date(a.minute) - new Date(b.minute));
        return out;
      };

      const windAvg = avgPerMinute(windHist);
      const gustAvg = avgPerMinute(gustHist);

      const minuteMap = {};
      windAvg.forEach(({ minute, avg }) => {
        if (!minuteMap[minute]) minuteMap[minute] = {};
        minuteMap[minute].wind = avg;
      });
      gustAvg.forEach(({ minute, avg }) => {
        if (!minuteMap[minute]) minuteMap[minute] = {};
        minuteMap[minute].gust = avg;
      });

      const now = new Date();
      const data = [];
      let max = 0;
      for (let i = minutes - 1; i >= 0; i--) {
        const mTime = new Date(now.getTime() - i * 60000);
        const key = mTime.toISOString().slice(0, 16);
        const wind = minuteMap[key]?.wind ?? 0;
        const gust = minuteMap[key]?.gust ?? wind;
        max = Math.max(max, gust);
        data.push({ wind, gust });
      }
      this._data = data;
      this._maxGust = max;
      this._lastUpdated = new Date();
    } catch (err) {
      this._data = [];
      this._maxGust = 0;
      this._noData = true;
      console.error('Failed to fetch wind data', err);
    }
  }

  _getSpeedClass(speed) {
    const level = Math.min(60, Math.floor(speed / 5) * 5);
    return `ws${level}`;
  }

  _renderBar({ wind, gust }) {
    const base = Math.min(wind, Y_MAX);
    const peak = Math.min(gust, Y_MAX);
    const speedHeight = (base / Y_MAX) * 100;
    const gustHeight = ((peak - base) / Y_MAX) * 100;

    const windClass = this._getSpeedClass(base);
    const gustClass = this._getSpeedClass(peak);

    return html`
      <div class="bar-container">
        <div class="bar wind ${windClass}" style="height:${speedHeight}%"></div>
        <div class="bar gust ${gustClass}" style="height:${gustHeight}%; bottom:${speedHeight}%"></div>
      </div>
    `;
  }

  render() {
    if (this._noData) {
      return html`<ha-card class="no-data">${this._error || 'No data available'}</ha-card>`;
    }
    const lines = [];
    const gridLimit = Math.min(Y_MAX, Math.floor(this._maxGust / 5) * 5);
    for (let v = 5; v <= gridLimit; v += 5) {
      lines.push(html`<div class="grid-line" style="bottom:${(v / Y_MAX) * 100}%"></div>`);
    }
    return html`
      <ha-card>
        <div class="graph" style="grid-template-columns:repeat(${this._data.length},1fr)">
          <div class="grid">${lines}</div>
          ${this._data.map(d => this._renderBar(d))}
        </div>
        <div class="footer">Updated: ${this._lastUpdated?.toLocaleTimeString()}</div>
      </ha-card>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .graph {
      height: 100px;
      position: relative;
      display: grid;
      grid-auto-flow: column;
      align-items: end;
    }
    .grid {
      position: absolute;
      inset: 0 0 0 0;
      pointer-events: none;
    }
    .grid-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 1px solid var(--divider-color, #e0e0e0);
    }
    .bar-container {
      position: relative;
      height: 100%;
    }
    .bar {
      position: absolute;
      left: 0;
      width: 100%;
    }
    .wind {
      bottom: 0;
    }
    .gust {
      opacity: 0.6;
    }

    /* Windfinder-style color scale */
    .ws0  { background-color: #00bfff; }
    .ws5  { background-color: #1eb7e6; }
    .ws10 { background-color: #4ca6d1; }
    .ws15 { background-color: #7994bd; }
    .ws20 { background-color: #a681a8; }
    .ws25 { background-color: #d46f94; }
    .ws30 { background-color: #ff5c7f; }
    .ws35 { background-color: #ff6f61; }
    .ws40 { background-color: #ff944d; }
    .ws45 { background-color: #ffb833; }
    .ws50 { background-color: #ffdb19; }
    .ws55 { background-color: #ffff00; }
    .ws60 { background-color: #e6e600; }

    .footer {
      text-align: center;
      font-size: 0.8em;
      padding: 8px 0;
      color: var(--secondary-text-color);
    }

    ha-card.no-data {
      padding: 16px;
      text-align: center;
    }
  `;
}

customElements.define('ha-wind-stat-card', HaWindStatCard);
