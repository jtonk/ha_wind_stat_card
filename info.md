# ha_wind_stat_card

A minimal Lovelace card that shows recent wind data as stacked bars. Wind speed forms the base of each bar with gusts stacked above. Data is loaded via the Home Assistant history API, averaged per minute and refreshed automatically every 60 seconds.

Configure the card with `wind_entity`, `gust_entity` and `direction_entity` sensors. See the README for installation and usage instructions.
Set `autoscale: false` to make bar heights map directly to wind speed (1 kn = 1px).
Use `multiplier` to scale the raw bar heights when autoscale is disabled.
