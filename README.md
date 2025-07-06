# ha_wind_stat_card

This repository contains **ha-wind-stat-card**, a Home Assistant custom card that shows the last 10 minutes of wind statistics as a small bar graph. Each minute is represented as a column where the wind speed is drawn as a bar and the gust height is stacked on top. A small arrow rotated in the direction of the wind replaces the numeric direction. The card uses three entities:

- `wind_speed` – wind speed sensor
- `wind_gust` – gust sensor
- `wind_dir` – wind direction sensor

The card fetches history for these entities, calculates the average value for each minute, and shows the most recent 10 minutes. Each list item contains the `speed/gust` pair followed by the corresponding wind direction.

## Usage

1. Copy `ha-wind-stat-card.js` to your `www` folder in Home Assistant.
2. Add the card to your Lovelace resources:

```yaml
resources:
  - url: /local/ha-wind-stat-card.js
    type: module
```

3. Configure the card in your dashboard:

```yaml
type: 'custom:ha-wind-stat-card'
wind_speed: sensor.wind_speed
wind_gust: sensor.wind_gust
wind_dir: sensor.wind_direction
```

The card automatically updates when new history data is available.
