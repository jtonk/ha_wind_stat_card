# ha_wind_stat_card

A Home Assistant custom card that displays the last minutes of wind data (30 by default) as a small bar graph. Wind speed is drawn as a bar for each minute with gust height stacked on top. Bars fill the width of the card and animate when new data arrives. A rotated arrow indicates the wind direction. The card pulls history for the configured sensors, calculates per-minute averages and updates automatically.

See the repository README for installation and configuration details.
