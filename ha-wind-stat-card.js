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
    // Fetch a day's history to ensure we get at least 10 entries
    const start = new Date(Date.now() - 24 * 3600000).toISOString();
    const hist = await this._hass.callApi('GET', `history/period/${start}?filter_entity_id=${ids.join(',')}&minimal_response`);
    const speedHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_speed) || [];
    const gustHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_gust) || [];
    const dirHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_dir) || [];
    const sortByTime = (a, b) => new Date(a.last_changed || a.last_updated) - new Date(b.last_changed || b.last_updated);
    speedHist.sort(sortByTime);
    gustHist.sort(sortByTime);
    dirHist.sort(sortByTime);
    const points = Math.min(speedHist.length, gustHist.length, dirHist.length);
    if (!points) {
      this.content.innerHTML = '';
      return;
    }
    const startIndex = Math.max(points - 10, 0);
    const list = document.createElement('div');
    list.className = 'list';
    for (let i = startIndex; i < points; i++) {
      const spd = speedHist[i].state;
      const gst = gustHist[i].state;
      const dir = dirHist[i].state;
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
