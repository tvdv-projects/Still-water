# Profielen, binaural beats en ademhaling

## Profielen

Elk profiel staat in `src/config/profiles.js` en bepaalt scène, muziekstijl, doel, binaural-bereik en ademhalingsoefeningen.

### Slaap
- **Scène:** het meer diep in de nacht. De maan zakt naar de horizon, de mist wordt dikker, de lantaarns doven één voor één en drijven weg. Het beeld wordt steeds donkerder.
- **Muziek (`deep`), Biosphere bij nacht:** brede, donkere pads die heel langzaam in elkaar overvloeien, een zacht luchtkoor, af en toe een glaskorrel, wat taperuis. Geen ritme. Water dat als trage golven aanzwelt. Sterft de laatste twee minuten weg, zonder slotakkoord.
- **Dieren:** krekels, een kikker, af en toe een uil.
- **Binaural:** start tussen 7 en 12 Hz, afhankelijk van je hartslag, en zakt naar 2,5 Hz (deltagebied, geassocieerd met diepe slaap).
- **Doel:** hartslag zo ver mogelijk omlaag.
- **Einde:** geen overzicht dat opspringt. Twee minuten voor het einde zakt het geluid naar een zacht niveau en verschijnt een melding. Na afloop vervaagt alles in een minuut naar volledig zwart (op een OLED-scherm vrijwel zonder stroomverbruik), en sterft het geluid in 15 minuten weg. Het scherm blijft aan, omdat iOS een webpagina pauzeert zodra je telefoon vergrendelt. Tik op het scherm om wakker te worden en het overzicht te zien.

### Ontspanning
- **Scène:** het nachtelijke meer. De mist trekt op, het water wordt stiller, de lantaarns gaan aan en er verschijnen vuurvliegjes.
- **Muziek (`glacial`), Loscil / Biosphere:** ondergedompelde pads in D dorisch, gedempte dub-akkoorden die in een ping-pong-echo oplossen, glaskorrels en een luchtkoor die langzaam om je heen draaien, vinylkraak en taperuis.
- **Dieren:** krekels, kikkers, een duiker die over het meer roept, af en toe een uil.
- **Binaural:** van 9–14 Hz naar 6 Hz (thetagebied).
- **Doel:** hartslag omlaag.

### Ochtend
- **Scène:** een echte foto (eigen opname, 4032 × 3024) van een mistig veld bij zonsopkomst, levend gemaakt met WebGL. Mist drijft over het veld, de zon gloeit mee met je adem en geeft lichtstralen door de mist, en de hoge wolken schuiven heel langzaam. Verre vogels, groepen ganzen in V-formatie, een paar kraaien en af en toe een buizerd die op een thermiekbel rondcirkelt en langzaam stijgt. Eens in de paar minuten springt er een ree door het veld rechts van het pad. Dat is een echte ree: één volledige sprong uitgeknipt uit een filmopname (16 beelden), als silhouet in tegenlicht en mist, met de poten in het gras en achter de struik langs (het masker daarvoor komt uit de foto zelf: alles wat donker afsteekt tegen de mist staat ervoor). Aan het eind verdwijnt hij in de mist; stofjes zweven in het zonlicht. Hoe rustiger je wordt, hoe warmer en lichter het beeld en hoe meer de mist oplost. Bij elke stap voortgang trekt er een vlucht ganzen over.
- **Muziek (`morning`):** warme, zwevende pads in D lydisch, een luchtkoor en glaskorrels, zonder ritme.
- **Natuur:** geen water; wind over het veld met trage vlagen (`core/wind.js`). Een roodborst (die zingt ook in de herfst), mezen, een specht in de verte. Ganzen, kraaien en de buizerd roepen alleen als ze in beeld vliegen, en van de kant waar ze vliegen.
- **Binaural:** van 11–16 Hz naar 8 Hz (overgang alfa/theta: ontspannen, wakker).
- **Doel:** hartslag licht omlaag. Gewoon even zitten.
- **Op een laptop** vult de foto het scherm volledig; op een telefoon rechtop zie je het midden met het pad en de zon.

### Ontspannen focus
- **Scène:** een bergmeer in het blauwe uur. Hoe rustiger je wordt, hoe meer de dageraad doorbreekt: de lucht kleurt warmer, de mist trekt op en de toppen vangen één voor één goudlicht, de hoogste eerst.
- **Muziek (`warm`), Carbon Based Lifeforms zonder beat:** warme pads in D lydisch, lange basnoten, een zachte, ronde synthsequence in achtsten die achter in de ruimte staat, door een filter dat met twee trage LFO's (ongeveer 17 en 70 seconden) open- en dichtgaat, met veel echo. 80 BPM, of je hartslag.
- **Dieren:** zangvogels, een koekoek in de verte, een specht die op een boom roffelt.
- **Binaural:** van 13–18 Hz naar 10 Hz (alfagebied, ontspannen alert).
- **Doel:** hartslag licht omlaag.

### Volle focus
- **Scène:** één kaarsvlam in het donker. Een onrustige hartslag laat de vlam flakkeren; een stabiele hartslag maakt hem stil. Met de voortgang wordt een ensō (zen-inktcirkel) rond de vlam gepenseeld.
- **Muziek (`minimal`), AES Dana minimaal:** één egale drone, een zacht pulserende bas in achtsten en kleine klikjes die in de echo verspringen. Geen melodie, zodat niets afleidt. 88 BPM, of je hartslag.
- **Dieren:** heel zacht, als door een raam: soms een krekel, zelden een uil.
- **Binaural:** van 16–20 Hz naar 14 Hz (laag bèta).
- **Doel:** hartslag **stabiel**, niet per se lager. Je scoort als je binnen ±1,5 slag van je beginwaarde blijft en de schommeling over 30 seconden klein is. Voor scherp nadenken wil je niet wegzakken.

### Energie
- **Scène:** een kampvuur in een bos. Het vuur is een deeltjessysteem: hoe meer je opwarmt, hoe hoger en feller het oplaait. Elke stap voortgang laat een nieuw houtblok vlam vatten, met een regen van vonken. De bomen rondom vangen het licht. Bij de vuurademhaling flakkert het vuur op met elke uitademing.
- **Muziek (`bright`), Carbon Based Lifeforms downtempo:** een zachte beat (kick, snare, hihat met swing), een baslijn, een sequence in zestienden die over 32 maten opengaat, pads die meeademen met de kick, en knisperend vuur. 94 BPM, of je hartslag plus 6, als een duwtje omhoog.
- **Dieren:** krekels, een snorrende nachtzwaluw, een uil en soms een wolf in de verte, af en toe beantwoord door een tweede.
- **Binaural:** start tussen 8 en 12 Hz (lager bij een lage hartslag) en gaat **omhoog** naar 18 Hz (bèta).
- **Doel:** hartslag **5 tot 12 slagen boven je beginwaarde**. Daaronder bouw je langzaam voortgang op. Tussen +12 en +15 neemt de beloning af, en boven +15 is er geen voortgang meer, schuift de binaural terug en verschijnt na 10 seconden een rustig berichtje. Het spel beloont opwekken, niet opjagen. Blijft je hartslag anderhalve minuut laag, dan stelt het een houding of de vuurademhaling voor.

**Tempo.** In het geluidspaneel kies je **Tempo: vast** (standaard) of **Tempo: volgt hartslag**. Bij volgen verschuift het tempo hooguit 1 BPM per maat, binnen een bereik per profiel, zodat het nooit schokt.

Alle dierengeluiden worden in code gemaakt (`src/audio/fauna.js`). Elk dier roept op een eigen willekeurig moment (behalve bij Ochtend de ganzen en kraaien, die horen bij wat je ziet), meestal een keer per halve minuut tot een paar minuten, op een willekeurige plek links of rechts en met galm, zodat het klinkt alsof het om je heen en op afstand is. Ze lopen via het schuifje **Natuur**.

## Hoe de binaural beat je hartslag volgt

1. **Tijdens de rustmeting** rekent `profile.start(hr)` live een startfrequentie uit: hoe hoger je hartslag, hoe hoger de zweving. Het idee is eerst aansluiten bij waar je bent, en dan langzaam meenemen.
2. **Na de rustmeting** ligt de start vast op basis van je beginwaarde.
3. **Tijdens de sessie** schuift de zweving naar het doel van het profiel. De snelheid (*lead*) hangt af van je lichaam:
   - daalt je hartslag, dan gaat het sneller;
   - blijft je hartslag gelijk, dan zakt de zweving rustig door;
   - stijgt je hartslag duidelijk, dan wacht de zweving of schuift hij terug.
4. Het doel wordt bij een gemiddeld verloop bereikt na 40–75% van de sessie (`reach`), daarna blijft hij daar.

Bij **Energie** werkt het in spiegelbeeld: de zweving begint laag en gaat omhoog. Een stijgende hartslag versnelt dat, maar boven de bovengrens schuift hij juist terug.

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

| **Lange inademing** | 6 in · 3 uit | Energie | een langere inademing dan uitademing activeert in plaats van te kalmeren |
| **Trappetjes** | 3 × 1 tel snuiven in · 2 krachtig uit | Energie | de korte, opbouwende inademing werkt wekkend |
| **Vuurademhaling** (lichte versie) | 20 korte stoten uit · 20 s rustig ademen, 3 rondes | Energie | actieve buikuitademingen (kapalabhati) geven een snelle oppepper |

Over de vuurademhaling: het is een lichte versie met korte rondes en rustpauzes, zonder adem inhouden. Bij de eerste keer verschijnt een waarschuwing: doe het zittend, nooit in water of tijdens het rijden, en stop als je duizelig wordt. Na drie rondes meldt het spel dat je klaar bent; je kunt daarna rustig verder ademen of nog een keer beginnen. Echte hyperventilatie-technieken zoals Wim Hof zitten er bewust niet in.

### Visuele gids

- **Ring:** groeit bij inademen, blijft bij vasthouden, krimpt bij uitademen. In het midden staat de countdown, erboven de fase.
- **Segmenten:** de buitenring is verdeeld in fases, in verhouding tot hun duur; de lopende fase vult zich.
- **Box:** een lichtpunt loopt langs een vierkant, één zijde per fase.
- **Wisselende neusgaten:** de linker of rechter halve ring licht op.
- **Vuurademhaling:** een krans van 20 stippen telt de stoten, het midden telt mee, eronder staat de ronde. Tijdens de rust telt het af.

Het ademgeluid (gefilterde ruis) zwelt aan bij inademen en zakt bij uitademen. Het heeft een eigen schuifje in het geluidspaneel.

## HRV en coherentie (borstband)

Een borstband zoals de Garmin HRM 200 stuurt behalve je hartslag ook de tijd tussen elke twee hartslagen (RR-intervallen). Een horloge dat zijn hartslag uitzendt doet dat meestal niet. Ontvangt Stil Water die gegevens, dan verschijnt onderin een extra regel.

- **HRV (RMSSD, in ms):** de variatie tussen opeenvolgende hartslagen over de laatste minuut. Een hogere waarde betekent doorgaans meer ontspanning. De beginwaarde komt uit de rustmeting; het overzicht toont begin → einde.
- **Coherentie (0–100%):** alleen tijdens een ademhalingsoefening. Bij rustig ademen versnelt je hart bij het inademen en vertraagt het bij het uitademen. Coherentie meet hoe goed je hartslag de ademgids volgt (correlatie over de laatste minuut, met maximaal 5 seconden vertraging). Bij resonantieademhaling is een hoge coherentie precies het doel. De ademring krijgt een sterkere gloed naarmate de coherentie stijgt, en het overzicht toont het gemiddelde.

Ruis filteren: onmogelijke intervallen (sneller dan 200 of trager dan 30 slagen per minuut) en sprongen van meer dan 20% ten opzichte van de vorige slag worden genegeerd. Die ontstaan door gemiste slagen of slecht contact. Maak de elektroden nat; in een rustige sessie zweet je niet, en een droge band geeft ruis.
