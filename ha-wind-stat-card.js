import { LitElement, html, css } from 'https://unpkg.com/lit?module';
import { repeat } from 'https://unpkg.com/lit/directives/repeat.js?module';

class HaWindStatCard extends LitElement {
  static properties = {
    hass: {},
    _config: {},
    _data: { state: true },
    _maxGust: { state: true },
    _lastUpdated: { state: true },
    _noData: { state: true }
  };

  constructor() {
    super();
    this._initialLoad = true;
  }

  setConfig(config) {
    if (!config.wind_entity || !config.gust_entity || !config.direction_entity) {
      this._noData = true;
      this._error = 'wind_entity, gust_entity and direction_entity must be set';
      return;
    }
    this._config = {
      minutes: 30,
      graph_height: 100,
      ...config
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this._scheduleNextFetch();
  }

  disconnectedCallback() {
    clearTimeout(this._timeout);
    super.disconnectedCallback();
  }

  _scheduleNextFetch() {
    this._fetchData();
    const now = new Date();
    const msUntilNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    this._timeout = setTimeout(() => this._scheduleNextFetch(), msUntilNextMinute);
  }

  async _fetchData() {
    if (!this.hass || !this._config) return;

    const minutes = this._config.minutes;
    const now = new Date();
    now.setSeconds(0, 0);
    const end = now.toISOString();
    const start = new Date(now.getTime() - minutes * 60000).toISOString();
    const ids = `${this._config.wind_entity},${this._config.gust_entity},${this._config.direction_entity}`;

    try {
      const hist = await this.hass.callApi(
        'GET',
        `history/period/${start}?end_time=${end}&filter_entity_id=${ids}&minimal_response`
      );

      const windHistGroup = hist.find(h => Array.isArray(h) && h[0]?.entity_id === this._config.wind_entity);
      const gustHistGroup = hist.find(h => Array.isArray(h) && h[0]?.entity_id === this._config.gust_entity);
      const dirHistGroup = hist.find(h => Array.isArray(h) && h[0]?.entity_id === this._config.direction_entity);

      const windHist = Array.isArray(windHistGroup) ? windHistGroup : [];
      const gustHist = Array.isArray(gustHistGroup) ? gustHistGroup : [];
      const dirHist = Array.isArray(dirHistGroup) ? dirHistGroup : [];

      this._noData = !windHist.length && !gustHist.length && !dirHist.length;

      const avgPerMinute = entries => {
        const map = {};
        entries.forEach(e => {
          const t = new Date(e.last_changed || e.last_updated);
          const key = t.toISOString().slice(0, 16);
          const val = parseFloat(e.state);
          if (!isFinite(val) || val < 0 || val > 100) return;
          if (!map[key]) map[key] = { sum: 0, count: 0 };
          map[key].sum += val;
          map[key].count += 1;
        });
        return Object.keys(map).sort().map(k => ({ minute: k, avg: map[k].sum / map[k].count }));
      };

      const avgVectorPerMinute = entries => {
        const map = {};
        entries.forEach(e => {
          const t = new Date(e.last_changed || e.last_updated);
          const key = t.toISOString().slice(0, 16);
          const val = parseFloat(e.state);
          if (!isFinite(val)) return;
          const rad = (val * Math.PI) / 180;
          if (!map[key]) map[key] = { x: 0, y: 0, count: 0 };
          map[key].x += Math.cos(rad);
          map[key].y += Math.sin(rad);
          map[key].count += 1;
        });
        return Object.keys(map).sort().map(k => {
          const d = map[k];
          const avgRad = Math.atan2(d.y / d.count, d.x / d.count);
          const deg = (avgRad * 180) / Math.PI;
          return { minute: k, avg: (deg + 360) % 360 };
        });
      };

      const windAvg = avgPerMinute(windHist);
      const gustAvg = avgPerMinute(gustHist);
      const dirAvg = avgVectorPerMinute(dirHist);

      const minuteMap = {};
      windAvg.forEach(({ minute, avg }) => {
        if (!minuteMap[minute]) minuteMap[minute] = {};
        minuteMap[minute].wind = avg;
      });
      gustAvg.forEach(({ minute, avg }) => {
        if (!minuteMap[minute]) minuteMap[minute] = {};
        minuteMap[minute].gust = avg;
      });
      dirAvg.forEach(({ minute, avg }) => {
        if (!minuteMap[minute]) minuteMap[minute] = {};
        minuteMap[minute].direction = avg;
      });

      const data = [];
      let max = 0;
      // Skip the first minute as it often has no data yet
      for (let i = minutes - 2; i >= 0; i--) {
        const mTime = new Date(now.getTime() - i * 60000);
        const key = mTime.toISOString().slice(0, 16);

        const wind = minuteMap[key]?.wind ?? 0;
        const gustRaw = minuteMap[key]?.gust;
        const gust = typeof gustRaw === 'number' ? gustRaw : wind;
        const direction = minuteMap[key]?.direction ?? 0;

        const gustFinal = Math.min(60, Math.max(0, parseFloat(gust)));
        const windFinal = Math.min(60, Math.max(0, parseFloat(wind)));

        max = Math.max(max, gustFinal);

        data.push({ wind: windFinal, gust: gustFinal, direction });
      }

      if (this._initialLoad) {
        this._data = data.map(() => ({ wind: 0, gust: 0, direction: 0 }));
        this._maxGust = max;
        this._lastUpdated = new Date();
        await this.updateComplete;
        this._initialLoad = false;
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

  _renderBar({ wind, gust, direction }, index) {
    const scale = this._maxGust || 1;
    const height = this._config.graph_height;

    const windHeight = Math.round((wind / scale) * height);
    const gustHeight = Math.max(0, Math.round(((gust - wind) / scale) * height));

    const colorWind = this._getColor(wind);
    const colorGust = this._getColor(gust);

    return html`
      <div class="wind-bar-segment">
        <ha-icon
          class="dir-icon"
          icon="mdi:navigation"
          style="transform: rotate(${direction + 180}deg);"
        ></ha-icon>
        <div
          class="date-wind-bar-segment"
          style="background:${colorWind};height:${windHeight}px;width:100%;"
        ></div>
        ${gustHeight > 0
          ? html`<div
              class="date-gust-bar-segment"
              style="background:${colorGust};height:1px;margin-bottom:${gustHeight}px;width:100%;"
            ></div>`
          : null}
      </div>
    `;
  }

  render() {
    if (this._noData || !Array.isArray(this._data)) {
      return html`<ha-card class="no-data">${this._error || 'No data available'}</ha-card>`;
    }

    return html`
      <ha-card>
        <div
          class="graph"
          style="height:${this._config.graph_height}px"
        >
          ${(() => {
            const scale = this._maxGust || 1;
            const lines = [];
            for (let v = 5; v <= scale; v += 5) {
              lines.push(html`<div class="h-line" style="bottom:${(v / scale) * 100}%"></div>`);
            }
            return lines;
          })()}
          ${repeat(
            this._data,
            (_d, index) => index,
            (d, index) => this._renderBar(d, index)
          )}
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
      gap: 1px;
      position: relative;
    }
    .wind-bar-segment {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column-reverse;
      align-items: stretch;
      transition: height 0.6s ease;
    }
    .dir-icon {
      --mdc-icon-size: 100%;
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 1em;
      display: block;
      text-align: center;
      pointer-events: none;
      transform-origin: center center;
    }
    .h-line {
      position: absolute;
      left: 0;
      width: 100%;
      height: 1px;
      background: var(--divider-color);
    }
    .date-wind-bar-segment,
    .date-gust-bar-segment {
      display: inline-block;
      transition: height 0.6s ease,
        margin-bottom 0.6s ease,
        background-color 0.6s ease;
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
