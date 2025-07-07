function averageAnglesDeg(angles) {
  const radians = angles.map(a => a * Math.PI / 180);
  const sumX = radians.reduce((acc, a) => acc + Math.cos(a), 0);
  const sumY = radians.reduce((acc, a) => acc + Math.sin(a), 0);
  const avgAngleRad = Math.atan2(sumY / angles.length, sumX / angles.length);
  const avgAngleDeg = (avgAngleRad * 180 / Math.PI + 360) % 360;
  return avgAngleDeg;
}

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
          display: grid;
          align-items: flex-end;
          height: 100px;
          width: 100%;
          position: relative;
        }
        .minute {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          position: relative;
        }
        .bars {
          position: relative;
          width: 100%;
          height: 80px;
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
          width: 100%;
          height: 12px;
          margin: 0 auto 2px;
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
    this._prevDirs = this._prevDirs || {};
    const start = new Date(Date.now() - minutesToShow * 60000).toISOString();
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

    const avgAnglesPerMinute = (entries) => {
      const map = {};
      entries.forEach(e => {
        const t = new Date(e.last_changed || e.last_updated);
        const key = t.toISOString().slice(0, 16);
        const val = parseFloat(e.state);
        if (isNaN(val)) return;
        if (!map[key]) map[key] = [];
        map[key].push(val);
      });
      const out = [];
      Object.keys(map).forEach(k => {
        out.push({ minute: k, avg: averageAnglesDeg(map[k]) });
      });
      out.sort((a, b) => new Date(a.minute) - new Date(b.minute));
      return out;
    };

    const speedAvg = avgPerMinute(speedHist);
    const gustAvg = avgPerMinute(gustHist);
    const dirAvg = avgAnglesPerMinute(dirHist);

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

    const now = new Date();
    const data = [];
    let max = 0;
    for (let i = minutesToShow - 1; i >= 0; i--) {
      const mTime = new Date(now.getTime() - i * 60000);
      const key = mTime.toISOString().slice(0, 16);
      const d = minuteMap[key] || {};
      const speed = d.speed || 0;
      const gust = d.gust !== undefined ? d.gust : speed;
      const dir = d.dir !== undefined ? d.dir : undefined;
      max = Math.max(max, gust);
      data.push({ key, speed, gust, dir });
    }
    this._max = max || 1;
    this._data = data;
  this._renderGraph();
  }

  _renderGraph() {
    if (!this._data) return;
    const minutesToShow = this._config.minutes;
    const graph = this._graph || document.createElement('div');
    graph.className = 'graph';
    graph.style.gridTemplateColumns = `repeat(${minutesToShow}, 1fr)`;

    // create grid lines
    const grid = this._grid || document.createElement('div');
    grid.className = 'grid';
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    const gridStep = 5;
    const gridMax = Math.floor(this._max / gridStep) * gridStep;
    for (let v = gridStep; v <= gridMax; v += gridStep) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      line.style.bottom = `${(v / this._max) * 100}%`;
      grid.appendChild(line);
    }
    if (!this._grid) {
      graph.appendChild(grid);
      this._grid = grid;
    }

    this._bars = this._bars || [];
    this._prevDirs = this._prevDirs || {};

    for (let i = 0; i < this._data.length; i++) {
      const { key, speed, gust, dir } = this._data[i];
      const spdHeight = (speed / this._max) * 100;
      const gstHeight = (Math.max(gust - speed, 0) / this._max) * 100;

      let wrap = this._bars[i];
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'minute';

        const arrow = document.createElement('ha-icon');
        arrow.className = 'arrow';
        arrow.setAttribute('icon', 'mdi:navigation');
        wrap.appendChild(arrow);

        const bars = document.createElement('div');
        bars.className = 'bars';

        const speedBar = document.createElement('div');
        speedBar.className = 'bar speed';
        bars.appendChild(speedBar);

        const gustBar = document.createElement('div');
        gustBar.className = 'bar gust';
        bars.appendChild(gustBar);

        wrap.appendChild(bars);
        this._bars[i] = wrap;
        if (graph.children.length <= i + 1) {
          graph.appendChild(wrap);
        } else {
          graph.insertBefore(wrap, graph.children[i + 1]);
        }
      }

      const arrow = wrap.querySelector('.arrow');
      const speedBar = wrap.querySelector('.speed');
      const gustBar = wrap.querySelector('.gust');

      const prevDir = this._prevDirs[key];
      const startDir = prevDir !== undefined ? prevDir : (dir !== undefined ? dir : 0);
      const endDir = dir !== undefined ? startDir + (((dir - startDir + 540) % 360) - 180) : startDir;
      arrow.style.transform = `rotate(${startDir + 180}deg)`;
      requestAnimationFrame(() => {
        arrow.animate(
          [
            { transform: `rotate(${startDir + 180}deg)` },
            { transform: `rotate(${endDir + 180}deg)` }
          ],
          { duration: 500, fill: 'forwards' }
        );
      });
      this._prevDirs[key] = ((endDir % 360) + 360) % 360;

      const animateHeight = (el, value) => {
        const from = el.style.height || '0%';
        el.animate([
          { height: from },
          { height: `${value}%` }
        ], { duration: 500, fill: 'forwards' });
        el.style.height = `${value}%`;
      };

      animateHeight(speedBar, spdHeight);
      animateHeight(gustBar, spdHeight + gstHeight);
    }

    // remove extra bars if minutes decreased
    while (this._bars.length > this._data.length) {
      const old = this._bars.pop();
      old.remove();
    }

    if (!this._graph) {
      this.content.innerHTML = '';
      this.content.appendChild(graph);
      this._graph = graph;
    }
  }

  getCardSize() {
    return 2;
  }
}

customElements.define('ha-wind-stat-card', HaWindStatCard);
