![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fosu-idle%2Fosu-idle%2Fmain%2Fpackage.json&query=%24.version&label=version&color=red&prefix=alpha%20)
[![AGPLv3 License](https://img.shields.io/badge/License-AGPL%20v3-yellow.svg)](https://opensource.org/licenses/)
[![CodeFactor](https://www.codefactor.io/repository/github/osu-idle/osu-idle/badge)](https://www.codefactor.io/repository/github/osu-idle/osu-idle)
[![Crowdin](https://badges.crowdin.net/osu-idle/localized.svg)](https://crowdin.com/project/osu-idle)
![GitHub contributors](https://img.shields.io/github/contributors/osu-idle/osu-idle)
![GitHub last commit](https://img.shields.io/github/last-commit/osu-idle/osu-idle)
[![osu!idle discord](https://discordapp.com/api/guilds/1511463564135759954/widget.png?style=shield)](https://discord.gg/ppy)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="packages/web/public/idle-white.png" />
    <img src="packages/web/public/idle-black.png" alt="osu!idle" width="400" />
  </picture>
</p>

# osu!idle

An osu!mania idle game where you train your own character on actual maps.

## Translations

```sh
# upload new english strings
npm run i18n:upload
# pull updated translations
npm run i18n:download

# seed Crowdin repo (don't use)
npm run i18n:upload:translations
```