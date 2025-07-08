# ha_wind_stat_card

`ha-wind-stat-card` is a lightweight Home Assistant custom card that renders recent wind data as a stacked bar chart. Each bar represents a one‑minute average of wind speed with the gust height stacked on top.

The card loads data through the Home Assistant history API and refreshes itself every minute. It is fully themeable using built‑in Home Assistant theme variables.

## Features

- Fetches last N minutes of history (default: 30)
- Stacked bars showing wind speed with gusts on top
- Y‑axis from 0–60 kn with grid lines every 5 kn (only up to current max gust)
- Auto refreshes once per minute and shows the last updated time
- Direction arrows for each minute showing averaged wind direction
- Works with three sensors configured in YAML:
  - `wind_entity`
  - `gust_entity`
  - `direction_entity`
- Fallback message when no data is available

## Usage

1. Copy `ha-wind-stat-card.js` to your `www` folder.
2. Add it as a resource in Lovelace:

```yaml
resources:
  - url: /local/ha-wind-stat-card.js
    type: module
```

3. Add the card to your dashboard:

```yaml
type: 'custom:ha-wind-stat-card'
wind_entity: sensor.wind_speed
gust_entity: sensor.wind_gust
direction_entity: sensor.wind_direction
# Optional number of minutes (defaults to 30)
minutes: 45
```

The card will automatically load history and update every minute.
