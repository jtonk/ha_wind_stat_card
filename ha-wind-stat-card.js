import { LitElement, html, css } from 'https://unpkg.com/lit?module';

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
        return Object.keys(map).sort().map(k => ({ minute: k, avg: map[k].sum / map[k].count }));
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
        const gustRaw = minuteMap[key]?.gust;
        const gust = typeof gustRaw === 'number' ? gustRaw : wind;
      
        console.log(`minute: ${key}`, 'wind:', wind, 'raw gust:', gustRaw, 'used gust:', gust);
      
        const gustFinal = Math.min(60, Math.max(0, parseFloat(gust)));
        const windFinal = Math.min(60, Math.max(0, parseFloat(wind)));
      
        data.push({ wind: windFinal, gust: gustFinal });
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

  _getColor(speed) {
    const wsColors = [
      "#9700ff", "#6400ff", "#3200ff", "#0032ff", "#0064ff", "#0096ff", "#00c7ff",
      "#00e6f0", "#25c192", "#11d411", "#00e600", "#00fa00", "#b8ff61", "#fffe00",
      "#ffe100", "#ffc800", "#ffaf00", "#ff9600", "#e67d00", "#e66400", "#dc4a1d",
      "#c8321d", "#b4191d", "#aa001d", "#b40032", "#c80064", "#fe0096"
    ];
    const index = Math.min(wsColors.length - 1, Math.floor(speed / 2));
    return wsColors[index];
  }

  _renderBar({ wind, gust }) {
    const windHeight = Math.round(wind);
    const gustHeight = Math.max(0, Math.round(gust - wind));
    const colorWind = this._getColor(wind);
    const colorGust = this._getColor(gust);
    console.log('WIND:', wind, 'GUST:', gust, 'DIFF:', gust - wind);
    return html`
      <div class="wind-bar-segment">
        <div class="date-wind-bar-segment" style="background:${colorWind};height:${windHeight}px;width:100%;display:inline-block;"></div>
        ${gustHeight > 0
          ? html`<div class="date-gust-bar-segment" style="background:${colorGust};height:1px;margin-bottom:${gustHeight}px;width:100%;display:inline-block;"></div>`
          : null}
      </div>
    `;
  }

  render() {
    if (this._noData) {
      return html`<ha-card class="no-data">${this._error || 'No data available'}</ha-card>`;
    }
    return html`
      <ha-card>
        <div class="graph">
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
      display: flex;
      align-items: end;
      height: 100px;
      gap: 1px;
    }
    .wind-bar-segment {
      position: relative;
      height: 100%;
      width: 100%;
      display: flex;
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .date-wind-bar-segment,
    .date-gust-bar-segment {
      display: inline-block;
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
