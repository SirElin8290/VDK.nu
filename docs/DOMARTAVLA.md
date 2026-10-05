# VDK Domartavla

Mina sidor → Domartavlan kräver aktivt medlemskap enligt befintlig modell, med oförändrat adminundantag. Öppnandet verifieras även genom /api/board/access. Den fristående tavlan sparas inte när sidan lämnas.

## Användning

Välj Domare för D1 och D2, Lag A eller Lag B för spelare och Boll för en boll. Flytta är ett separat verktyg; välj det för att dra markörer. Pil och Rita fungerar även när draget börjar på en markör. Ångra och Gör om omfattar placering, flytt, ritning och rensning. Rensa kräver bekräftelse när tavlan innehåller något. Helskärm använder ett tillgängligt dialogfönster och fungerar även utan webbläsarens Fullscreen API. Piltangenter kan flytta en fokuserad markör. Pointer Events hanterar mus, finger och stylus; touch-action:none används endast på själva SVG-ritområdet.

Planen är schematisk och bygger på IFF:s regler 2026, avsnitt 101–102: 40 × 20 m, mittlinje och mittpunkt, målområden, målvaktsområden, mål och sex tekningsmarkeringar. Linjerna är förstärkta för läsbarhet. Källa: https://www.floorball.sport/wp-content/uploads/2026/02/Rules-of-the-Game-2026-with-all-changes-260209.pdf

## Coachning

I en situation kan coachen välja Illustrera situation. Period, tid och kommentar sparas före öppnandet när situationen är ny. Spara i situationen lagrar tavlan på det befintliga clips-objektet. Previews är lätta skrivskyddade SVG-renderingar från samma data. Redigera tavla återöppnar utkastet; Ta bort tavla tar endast bort illustrationen. Helhetsbild och Two Stars and a Wish är oförändrade. Publicering låser även tavlan. Endast tilldelad VIDEO_COACH får spara och ta bort illustrationer i ett eget utkast; admin får ingen extra redigeringsrätt. Medlemmen får endast läsa sina egna publicerade protokoll och kan öppna illustrationer i stort format.

## Data och gränser

board-data.js används av både klient och server. Version 1 lagrar normaliserade koordinater 0–1 för domare, spelare, boll, pilar och frihandslinjer. domartavla.js är en gemensam komponent med edit- och view-läge. clips.board_data är en nullable JSON-textkolumn som migreras utan att befintliga situationer tas bort. Ingen bild, skärmdump, video eller extern whiteboardtjänst lagras.

Max: 2 domare, 24 spelare (12 per lag), en boll, 30 pilar, 30 frihandslinjer, 200 punkter per linje, 1 000 punkter totalt och 24 KiB normaliserad tavledata. API:ts befintliga 32 KiB requestgräns gäller också. Okända fält, text, ogiltiga id:n, dubbla markörer och positioner utanför planen avvisas. Sparning kräver rätt utkastrevision; en gammal flik kan inte skriva över en nyare tavla. Redigering sker lokalt utan anrop per drag.

## Verifiering

Testsuiten omfattar modeller, serialisering/återställning, gränsvärden, medlemsåtkomst, coachägarskap, privata utkast, bevarande vid kommentarredigering, radering och publiceringslås. Browserflöden verifieras utan screenshots på simulerade mobiler och dator; simulerade touchdrag testar ritning, flytt, scroll, ångra/gör om, rensa och helskärm. Coach-/medlemsflödet verifieras mot lokal testdatabas, inte med påhittade produktionscoachningar. Detta är inte verifiering på en fysisk mobil eller surfplatta.
