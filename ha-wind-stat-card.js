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
      throw new Error('wind_entity and gust_entity must be set');
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
      // eslint-disable-next-line no-console
      console.error('Failed to fetch wind data', err);
    }
  }

  render() {
    if (this._noData) {
      return html`<ha-card class="no-data">No data available</ha-card>`;
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

  _renderBar({ wind, gust }) {
    const speedHeight = Math.min(wind, Y_MAX) / Y_MAX * 100;
    const gustDiff = Math.max(0, Math.min(gust, Y_MAX) - Math.min(wind, Y_MAX));
    const gustHeight = gustDiff / Y_MAX * 100;
    return html`
      <div class="bar-container">
        <div class="bar speed" style="height:${speedHeight}%"></div>
        <div class="bar gust" style="height:${gustHeight}%; bottom:${speedHeight}%"></div>
      </div>
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
      bottom: 0;
    }
    .speed {
      background-color: var(--primary-color);
    }
    .gust {
      background-color: var(--accent-color);
    }
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
