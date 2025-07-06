class HaWindStatCard extends HTMLElement {
  setConfig(config) {
    if (!config.wind_speed || !config.wind_gust || !config.wind_dir) {
      throw new Error('wind_speed, wind_gust and wind_dir must be set');
    }
    this._config = Object.assign({ hours: 1, samples: 60 }, config);
    this._lastSpeed = this._lastGust = this._lastDir = null;
    if (!this.content) {
      this.content = document.createElement('div');
      this.content.className = 'container';
      const style = document.createElement('style');
      style.textContent = `
        :host {
          display: block;
          padding: 16px;
        }
        .bar-container {
          display: flex;
          width: 100%;
          height: 100px;
          align-items: flex-end;
        }
        .bar {
          flex-grow: 1;
          margin: 0 1px;
          position: relative;
        }
        .speed {
          background-color: var(--ha-wind-speed-color, #4b9dea);
        }
        .gust {
          background-color: var(--ha-wind-gust-color, #b4dff9);
          position: absolute;
          bottom: 0;
          width: 100%;
        }
        .arrow {
          text-align: center;
          margin-top: 4px;
          font-size: 24px;
          transition: transform 0.3s ease;
        }
      `;
      this.appendChild(style);
      this.appendChild(this.content);
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const speed = hass.states[this._config.wind_speed];
    const gust = hass.states[this._config.wind_gust];
    const dir = hass.states[this._config.wind_dir];
    if (!speed || !gust || !dir) return;

    const s = speed.last_changed;
    const g = gust.last_changed;
    const d = dir.last_changed;
    if (this._lastSpeed === s && this._lastGust === g && this._lastDir === d) return;
    this._lastSpeed = s;
    this._lastGust = g;
    this._lastDir = d;
    this._updateChart();
  }

  async _updateChart() {
    const start = new Date(Date.now() - this._config.hours * 3600000).toISOString();
    const ids = [this._config.wind_speed, this._config.wind_gust];
    const hist = await this._hass.callApi('GET', `history/period/${start}?filter_entity_id=${ids.join(',')}&minimal_response`);
    const speedHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_speed) || [];
    const gustHist = hist.find(h => h[0] && h[0].entity_id === this._config.wind_gust) || [];

    const points = Math.min(speedHist.length, gustHist.length);
    if (!points) return;
    const sampleCount = Math.min(this._config.samples, points);
    const step = points / sampleCount;
    const container = document.createElement('div');
    container.className = 'bar-container';

    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.floor(i * step);
      const spd = parseFloat(speedHist[idx].state);
      const gst = parseFloat(gustHist[idx].state);
      const max = Math.max(spd + gst, 1);
      const bar = document.createElement('div');
      bar.className = 'bar';
      const speedDiv = document.createElement('div');
      speedDiv.className = 'speed';
      speedDiv.style.height = (spd / max * 100) + '%';
      const gustDiv = document.createElement('div');
      gustDiv.className = 'gust';
      gustDiv.style.height = (gst / max * 100) + '%';
      bar.appendChild(speedDiv);
      bar.appendChild(gustDiv);
      container.appendChild(bar);
    }

    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    arrow.textContent = '↑';
    const dirState = this._hass.states[this._config.wind_dir];
    const angle = parseFloat(dirState.state || '0');
    arrow.style.transform = `rotate(${angle}deg)`;

    this.content.innerHTML = '';
    this.content.appendChild(container);
    this.content.appendChild(arrow);
  }

  getCardSize() {
    return 3;
  }
}
customElements.define('ha-wind-stat-card', HaWindStatCard);
