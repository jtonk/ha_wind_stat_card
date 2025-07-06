class HaWindStatCard extends HTMLElement {
  setConfig(config) {
    if (!config.wind_speed || !config.wind_gust || !config.wind_dir) {
      throw new Error('wind_speed, wind_gust and wind_dir must be set');
    }
    this._config = { ...config };
    if (this._config.minutes === undefined) {
      this._config.minutes = 30;
    }
    if (!this.content) {
      this.content = document.createElement('div');
      this.content.className = 'container';
      const style = document.createElement('style');
      style.textContent = `
        :host {
          display: block;
          padding: 16px 0;
        }
        .graph {
          display: flex;
          align-items: flex-end;
          height: 100px;
          width: 100%;
          position: relative;
        }
        .minute {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          position: relative;
        }
        .bars {
          position: relative;
          width: calc(100% - 2px);
          height: 80px;
          margin: 0 1px;
        }
        .bar {
          position: absolute;
          bottom: 0;
          width: 100%;
          left: 0;
        }
        .speed {
          background: #2196f3;
        }
        .gust {
          background: rgba(255, 152, 0, 0.7);
        }
        .arrow {
          width: calc(100% - 2px);
          height: 12px;
          margin: 0 1px 2px;
          transform-origin: center;
          display: block;
        }
        .grid {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 14px;
          height: 80px;
          pointer-events: none;
        }
        .grid-line {
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px solid rgba(0, 0, 0, 0.2);
        }
      `;
      this.appendChild(style);
      this.appendChild(this.content);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._updateTable();
  }

  async _updateTable() {
    const ids = [this._config.wind_speed, this._config.wind_gust, this._config.wind_dir];
    const minutesToShow = this._config.minutes;
    // Fetch a generous history window to ensure we get enough data
    const start = new Date(Date.now() - minutesToShow * 6 * 60000).toISOString();
    const hist = await this._hass.callApi(
      'GET',
      `history/period/${start}?filter_entity_id=${ids.join(',')}&minimal_response`
    );
    const speedHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_speed) || [];
    const gustHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_gust) || [];
    const dirHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_dir) || [];

    const avgPerMinute = (entries) => {
      const map = {};
      entries.forEach(e => {
        const t = new Date(e.last_changed || e.last_updated);
        const key = t.toISOString().slice(0, 16); // up to minute
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

    const speedAvg = avgPerMinute(speedHist);
    const gustAvg = avgPerMinute(gustHist);
    const dirAvg = avgPerMinute(dirHist);

    // Combine values by minute without requiring matching timestamps
    const minuteMap = {};
    const addValues = (arr, prop) => {
      arr.forEach(({ minute, avg }) => {
        if (!minuteMap[minute]) minuteMap[minute] = {};
        minuteMap[minute][prop] = avg;
      });
    };
    addValues(speedAvg, 'speed');
    addValues(gustAvg, 'gust');
    addValues(dirAvg, 'dir');

    const minutes = Object.keys(minuteMap).sort((a, b) => new Date(a) - new Date(b));
    if (!minutes.length) {
      this.content.innerHTML = '';
      return;
    }
    const startIndex = Math.max(minutes.length - minutesToShow, 0);

    let max = 0;
    for (let i = startIndex; i < minutes.length; i++) {
      const d = minuteMap[minutes[i]];
      const s = d.speed || 0;
      const g = d.gust || s;
      max = Math.max(max, g);
    }

    const graph = document.createElement('div');
    graph.className = 'graph';

    // Add horizontal grid lines every 5kn up to the highest bar
    const grid = document.createElement('div');
    grid.className = 'grid';
    const gridStep = 5;
    const gridMax = Math.floor(max / gridStep) * gridStep;
    for (let v = gridStep; v <= gridMax; v += gridStep) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      line.style.bottom = `${(v / max) * 100}%`;
      grid.appendChild(line);
    }
    graph.appendChild(grid);

    for (let i = startIndex; i < minutes.length; i++) {
      const m = minutes[i];
      const data = minuteMap[m];
      const speed = data.speed || 0;
      const gust = data.gust || speed;
      const dir = data.dir !== undefined ? data.dir : 0;
      const spdHeight = (speed / max) * 100;
      const gstHeight = (Math.max(gust - speed, 0) / max) * 100;

      const minute = document.createElement('div');
      minute.className = 'minute';

      const arrow = document.createElement('ha-icon');
      arrow.className = 'arrow';
      arrow.setAttribute('icon', 'mdi:navigation');
      arrow.style.transform = `rotate(${dir + 180}deg)`;
      minute.appendChild(arrow);

      const bars = document.createElement('div');
      bars.className = 'bars';

      const speedBar = document.createElement('div');
      speedBar.className = 'bar speed';
      speedBar.style.height = `${spdHeight}%`;
      bars.appendChild(speedBar);

      const gustBar = document.createElement('div');
      gustBar.className = 'bar gust';
      gustBar.style.height = `${spdHeight + gstHeight}%`;
      bars.appendChild(gustBar);

      minute.appendChild(bars);
      graph.appendChild(minute);
    }
    this.content.innerHTML = '';
    this.content.appendChild(graph);
  }

  getCardSize() {
    return 2;
  }
}

customElements.define('ha-wind-stat-card', HaWindStatCard);
