# ha_wind_stat_card

This repository contains **ha-wind-stat-card**, a Home Assistant custom card that displays the last 10 wind measurements in a simple table. It uses three entities:

- `wind_speed` – wind speed sensor
- `wind_gust` – gust sensor
- `wind_dir` – wind direction sensor

The card fetches history for these entities and shows the most recent 10 entries. The first table row contains `speed/gust` pairs and the second row lists the corresponding wind direction values.

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
