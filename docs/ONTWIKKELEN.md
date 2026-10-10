# Ontwikkelen

## Vereisten

- Node.js 20 of nieuwer. Alleen nodig voor de lokale server en de tests; de app zelf heeft geen dependencies.
- Een browser met Web Bluetooth voor de echte hartslag: Chrome of Edge op desktop of Android, of Bluefy op iOS. Zonder bluetooth werkt de testmodus overal.

## Lokaal draaien

```sh
npm start
```

Open daarna http://localhost:5173. Web Bluetooth werkt alleen via https of `localhost`, dus niet via een IP-adres. Wil je op je telefoon testen tegen je laptop, gebruik dan de online versie of een https-tunnel.

## Testen

```sh
npm test         # unit tests in tests/
npm run check    # tests + importcontrole + controle dat de cache-versies kloppen
```

De tests dekken de pure logica: scoring, ademhalingsritme, profielconfiguratie en het uitlezen van het bluetooth-hartslagbericht. Beeld en geluid controleer je met de testmodus in de browser.

Handig in de browserconsole: `stilWater.app` en `stilWater.breath` laten de actuele state zien.

## Publiceren

GitHub Pages publiceert de `main`-branch vanuit de root. Elke push staat binnen een paar minuten live op https://tvdv-projects.github.io/Still-water/. De CI-workflow (`.github/workflows/ci.yml`) draait bij elke push en pull request `npm run check`.

**Draai vóór elke commit `npm run stamp`.** Browsers, en Bluefy in het bijzonder, houden JavaScript-modules in de cache, ook als de pagina zelf ververst is. `scripts/stamp.js` zet daarom in `index.html` een import map waarin elke module en de stylesheet een inhoudshash krijgt (`?v=…`). Verandert een bestand, dan verandert zijn adres en haalt de browser het opnieuw op; ongewijzigde bestanden blijven in de cache. Vergeet je het, dan faalt de CI.

De pagina zelf (`index.html`) cachet GitHub Pages ongeveer 10 minuten. Wil je direct de nieuwste versie, zet dan `?v=<iets nieuws>` achter het adres.

## Een profiel toevoegen

1. Voeg in `src/config/profiles.js` een profiel toe met `scene`, `style`, `goal`, `start`, `target`, `reach`, `breaths` en de teksten.
2. Voeg in `index.html` een knop toe aan `#profs`, met `data-p` gelijk aan de nieuwe key.
3. Nieuwe scène nodig? Maak `src/render/scenes/<naam>.js` met `draw`, `reset`, `progress` en `anchor`, en registreer hem in `src/render/frame.js`.
4. Nieuwe muziekstijl nodig? Voeg hem toe aan `src/audio/styles.js`.
5. Draai `npm test`: de profieltests controleren onder meer dat er 3 oefeningen en 7 teksten zijn, en dat de zweving boven het doel begint.

## Een ademhalingsoefening toevoegen

1. Voeg in `src/config/breathing.js` een techniek toe: `name`, `steps` als `[fase, seconden]` en `hint`. Gebruik `shape: 'box'` of `'nadi'` voor een andere visuele gids.
2. Nieuwe fasenaam? Voeg een label toe aan `STEP_LABEL` en, als de fase moet vullen of legen, een doel aan `STEP_TO`.
3. Zet de key in `breaths` van een of meer profielen.

## Codestijl

- ES-modules, 2 spaties inspringen, enkele quotes (zie `.editorconfig`).
- Pure logica in `src/core` en `src/config`, zonder DOM of audio, zodat het testbaar blijft.
- Teksten voor de gebruiker in het Nederlands; code en commentaar in het Engels.
