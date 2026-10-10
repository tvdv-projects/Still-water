# Profielen, binaural beats en ademhaling

## Profielen

Elk profiel staat in `src/config/profiles.js` en bepaalt scène, muziekstijl, doel, binaural-bereik en ademhalingsoefeningen.

### Slaap
- **Scène:** het meer diep in de nacht. De maan zakt naar de horizon, de mist wordt dikker, de lantaarns doven één voor één en drijven weg. Het beeld wordt steeds donkerder.
- **Muziek (`deep`):** lage, donkere akkoorden, geen hoge tikjes, water dat als trage golven aanzwelt. Sterft de laatste twee minuten weg, zonder slotakkoord.
- **Binaural:** start tussen 7 en 12 Hz, afhankelijk van je hartslag, en zakt naar 2,5 Hz (deltagebied, geassocieerd met diepe slaap).
- **Doel:** hartslag zo ver mogelijk omlaag.

### Ontspanning
- **Scène:** het nachtelijke meer. De mist trekt op, het water wordt stiller, de lantaarns gaan aan en er verschijnen vuurvliegjes.
- **Muziek (`glacial`):** koude ambient in D dorisch, ijzige tikjes, verre aanzwellende tonen, af en toe een uil.
- **Binaural:** van 9–14 Hz naar 6 Hz (thetagebied).
- **Doel:** hartslag omlaag.

### Ontspannen focus
- **Scène:** een bergmeer in het blauwe uur. Hoe rustiger je wordt, hoe meer de dageraad doorbreekt: de lucht kleurt warmer, de mist trekt op en de toppen vangen één voor één goudlicht, de hoogste eerst.
- **Muziek (`warm`):** lichtere klank in D lydisch, een trage, regelmatige reeks akkoordtonen, af en toe een vogel.
- **Binaural:** van 13–18 Hz naar 10 Hz (alfagebied, ontspannen alert).
- **Doel:** hartslag licht omlaag.

### Volle focus
- **Scène:** één kaarsvlam in het donker. Een onrustige hartslag laat de vlam flakkeren; een stabiele hartslag maakt hem stil. Met de voortgang wordt een ensō (zen-inktcirkel) rond de vlam gepenseeld.
- **Muziek (`minimal`):** één egale drone, een laag ruisbed en een zachte tik op 60 per minuut. Geen melodie, zodat niets afleidt.
- **Binaural:** van 16–20 Hz naar 14 Hz (laag bèta).
- **Doel:** hartslag **stabiel**, niet per se lager. Je scoort als je binnen ±1,5 slag van je beginwaarde blijft en de schommeling over 30 seconden klein is. Voor scherp nadenken wil je niet wegzakken.

## Hoe de binaural beat je hartslag volgt

1. **Tijdens de rustmeting** rekent `profile.start(hr)` live een startfrequentie uit: hoe hoger je hartslag, hoe hoger de zweving. Het idee is eerst aansluiten bij waar je bent, en dan langzaam meenemen.
2. **Na de rustmeting** ligt de start vast op basis van je beginwaarde.
3. **Tijdens de sessie** schuift de zweving naar het doel van het profiel. De snelheid (*lead*) hangt af van je lichaam:
   - daalt je hartslag, dan gaat het sneller;
   - blijft je hartslag gelijk, dan zakt de zweving rustig door;
   - stijgt je hartslag duidelijk, dan wacht de zweving of schuift hij terug.
4. Het doel wordt bij een gemiddeld verloop bereikt na 40–75% van de sessie (`reach`), daarna blijft hij daar.

De zweving zit in de muziek: elke drone-stem klinkt in je rechteroor een paar hertz hoger dan in je linker. Daarvoor heb je oordopjes of een koptelefoon nodig, en moet Ruimtelijke audio uit staan.

**Over het bewijs:** onderzoek naar binaural beats laat wisselende resultaten zien, met hooguit kleine effecten op ervaren spanning en weinig bewijs voor een direct effect op de hartslag. Zie het als experiment. Het overzicht na elke sessie maakt het mogelijk om zelf te vergelijken, met en zonder.

## Ademhalingsoefeningen

Gedefinieerd in `src/config/breathing.js`. Ze staan standaard uit; zet ze aan met de schakelaar onderin. Wissel je van oefening, dan gaat de nieuwe in zodra de huidige ademhaling af is, zodat je ritme niet halverwege breekt.

| Oefening | Ritme | Gebruikt in | Waarom |
|---|---|---|---|
| **4-7-8** | 4 in · 7 vast · 8 uit | Slaap | lange uitademing en pauze vertragen het ritme; populaire inslaaptechniek |
| **Lange uitademing** | 4 in · 8 uit (Slaap) / 4 in · 6 uit (Ontspanning) | Slaap, Ontspanning | een langere uitademing versterkt de vertragende werking van de nervus vagus |
| **Buikademhaling** | 5 in · 7 uit | Slaap | zacht en zonder vasthouden, geschikt als je al half slaapt |
| **Resonantie** | 5,5 in · 5,5 uit (Ontspanning) / 5 in · 5 uit (Ontspannen focus) | Ontspanning, Ontspannen focus | rond 6 ademhalingen per minuut; de techniek met het beste bewijs voor een hogere HRV |
| **Fysiologische zucht** | 2,5 in · 1 extra in · 6 uit · 1,5 rust | Ontspanning | dubbele inademing door de neus en lange uitademing; snelle manier om spanning te laten zakken |
| **Box** | 4 in · 4 vast · 4 uit · 4 vast | Ontspannen focus, Volle focus | gelijkmatig en voorspelbaar; houdt je alert en kalm |
| **Wisselende neusgaten** | 4 in links · 4 uit rechts · 4 in rechts · 4 uit links | Ontspannen focus, Volle focus | vraagt aandacht zonder inspanning; goed als concentratie-oefening |
| **Gelijke ademhaling** | 4 in · 4 uit | Volle focus | rustig maar niet slaperig |

Activerende technieken (snel ademen, Wim Hof) zijn bewust weggelaten: die verhogen de hartslag en kunnen duizelig maken.

### Visuele gids

- **Ring:** groeit bij inademen, blijft bij vasthouden, krimpt bij uitademen. In het midden staat de countdown, erboven de fase.
- **Segmenten:** de buitenring is verdeeld in fases, in verhouding tot hun duur; de lopende fase vult zich.
- **Box:** een lichtpunt loopt langs een vierkant, één zijde per fase.
- **Wisselende neusgaten:** de linker of rechter halve ring licht op.

Het ademgeluid (gefilterde ruis) zwelt aan bij inademen en zakt bij uitademen. Het heeft een eigen schuifje in het geluidspaneel.
