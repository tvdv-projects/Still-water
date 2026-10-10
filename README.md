# Stil Water

Een rustgevende wereld die reageert op je hartslag. Kies een profiel (slaap, ontspanning, ontspannen focus, volle focus of energie) en kijk hoe het beeld en de muziek veranderen terwijl je lichaam volgt. Met binaural beats die bij je huidige hartslag beginnen, en ademhalingsoefeningen per profiel.

**Live:** https://tvdv-projects.github.io/Still-water/

## Wat het doet

- **Hartslag live via bluetooth.** Elke hartslagmeter met de standaard Heart Rate Service werkt, bijvoorbeeld een Garmin met *Hartslag uitzenden* aan, of een borstband.
- **Vijf profielen**, elk met een eigen scène, muziekstijl, binaural-bereik en doel:

  | Profiel | Scène | Doel | Binaural |
  |---|---|---|---|
  | Slaap | nachtelijk meer, lantaarns doven | hartslag omlaag | → 2,5 Hz |
  | Ontspanning | nachtelijk meer, lantaarns gaan aan | hartslag omlaag | → 6 Hz |
  | Ontspannen focus | bergmeer bij dageraad | hartslag licht omlaag | → 10 Hz |
  | Volle focus | kaarsvlam met inktcirkel | hartslag stabiel | → 14 Hz |
  | Energie | kampvuur dat oplaait | hartslag +5 tot +12 | ↑ 18 Hz |

- **Muziek die je hartslag volgt.** De drone wordt helderder als je hartslag stijgt en donkerder als hij daalt, zonder dat de toonhoogte gaat zweven.
- **Ademhalingsoefeningen**, drie per profiel, met een visuele gids en ademgeluid. Ze staan standaard uit en kunnen tijdens de sessie wisselen.
- **Live HRV en coherentie** met een borstband (bijvoorbeeld Garmin HRM 200): de tijd tussen hartslagen geeft je HRV, en tijdens de ademhalingsoefeningen zie je hoe sterk je hart je ademhaling volgt.
- **Slaapstand** na een Slaap-sessie: het scherm wordt zwart en het geluid sterft in 15 minuten weg. Tik om wakker te worden.
- **Testmodus** met een gesimuleerde hartslag (inclusief borstband-data), zodat je alles zonder horloge kunt proberen.

Alles draait in de browser. Er is geen server en er gaat geen data het apparaat uit; je sessiegeschiedenis staat alleen in de lokale opslag van je browser.

## Gebruiken

1. Doe je borstband om (maak de elektroden nat), of zet op je Garmin-horloge **Hartslag uitzenden** aan. Met de borstband krijg je er HRV en coherentie bij.
2. Open de site:
   - op de **iPhone in Bluefy** (Safari en Chrome op iOS ondersteunen geen Web Bluetooth),
   - op **Android of desktop in Chrome of Edge**.
3. Kies een profiel en een duur, tik op **Verbind hartslagmeter** en kies je horloge.
4. Gebruik oordopjes voor de binaural beats en zet Ruimtelijke audio uit.

## Ontwikkelen

Geen build-stap en geen dependencies: de browser laadt de ES-modules direct.

```sh
npm start        # lokale server op http://localhost:5173
npm test         # unit tests (Node's ingebouwde test runner)
npm run check    # tests + controle of alle imports kloppen
```

Elke push naar `main` wordt door GitHub Pages direct gepubliceerd, en de CI-workflow draait de tests.

## Documentatie

- [Architectuur](docs/ARCHITECTUUR.md): opbouw, datastroom en ontwerpkeuzes
- [Profielen, binaural beats en ademhaling](docs/PROFIELEN.md): wat elk profiel doet en waarom
- [Ontwikkelen](docs/ONTWIKKELEN.md): lokaal draaien, testen, publiceren, een profiel of oefening toevoegen

## Disclaimer

Stil Water is een persoonlijk ontspanningsproject, geen medisch hulpmiddel. Het wetenschappelijk bewijs voor binaural beats is wisselend; het spel laat je wel na elke sessie zien wat je hartslag deed, zodat je het zelf kunt beoordelen.
