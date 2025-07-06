# ha_wind_stat_card

This repository contains **ha-wind-stat-card**, a simple Home Assistant custom card showing wind statistics as a stacked bar chart. It uses three entities:

- `wind_speed` – wind speed sensor
- `wind_gust` – gust sensor
- `wind_dir` – wind direction sensor

The card fetches history for the configured timeframe (default: 1 hour) and displays up to 60 stacked bars over the full width. You can change the number of bars with the optional `samples` option. An arrow below the chart indicates the current wind direction. Colors and bar rendering follow the style of `ha_wf_card` if present.

## Usage

1. Copy `ha-wind-stat-card.js` to your `www` folder in Home Assistant.
2. Add the card to your Lovelace resources:

```yaml
resources:
  - url: /local/ha-wind-stat-card.js
    type: module
```

3. Use YAML to configure the card in your dashboard:

```yaml
type: 'custom:ha-wind-stat-card'
wind_speed: sensor.wind_speed
wind_gust: sensor.wind_gust
wind_dir: sensor.wind_direction
hours: 1  # optional timeframe
samples: 60  # optional number of bars
```

The card updates whenever all three sensors provide new values.
