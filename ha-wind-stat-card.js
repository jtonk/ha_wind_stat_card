class HaWindStatCard extends HTMLElement {
  setConfig(config) {
    if (!config.wind_speed || !config.wind_gust || !config.wind_dir) {
      throw new Error('wind_speed, wind_gust and wind_dir must be set');
    }
    this._config = config;
    if (!this.content) {
      this.content = document.createElement('div');
      this.content.className = 'container';
      const style = document.createElement('style');
      style.textContent = `
        :host {
          display: block;
          padding: 16px;
        }
        .list {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .entry {
          padding: 4px 0;
          text-align: center;
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
    // Fetch a day's history to ensure we get enough data
    const start = new Date(Date.now() - 24 * 3600000).toISOString();
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
    const startIndex = Math.max(minutes.length - 10, 0);
    const list = document.createElement('div');
    list.className = 'list';
    for (let i = startIndex; i < minutes.length; i++) {
      const m = minutes[i];
      const data = minuteMap[m];
      const spd = data.speed !== undefined ? data.speed.toFixed(1) : '-';
      const gst = data.gust !== undefined ? data.gust.toFixed(1) : '-';
      const dir = data.dir !== undefined ? Math.round(data.dir) : '-';
      const item = document.createElement('div');
      item.className = 'entry';
      item.textContent = `${spd}/${gst} - ${dir}`;
      list.appendChild(item);
    }
    this.content.innerHTML = '';
    this.content.appendChild(list);
  }

  getCardSize() {
    return 2;
  }
}

customElements.define('ha-wind-stat-card', HaWindStatCard);
