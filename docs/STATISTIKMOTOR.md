# VDK:s statistikmotor

## Källa och avgränsning

Svensk Innebandys publika statistikklient hämtar startdata från `https://api.innebandy.se/StatsAppApi/api/startkit` och matchdata från `https://api.innebandy.se/v2/api/public`. Motorn använder samma publika starttoken i minnet. Ingen iBIS-inloggning används; token sparas aldrig eller skrivs till logg. Detta är den publika webbklientens datafunktion, inte ett av förbundet utlovat stabilt integrationsavtal.

Domaren upptäcks med exakt normaliserat namn och kopplas till ett stabilt RefereeID. Namnkollisioner/ändrade ID ska utredas, inte slås ihop automatiskt. Sören Johansson är verifierad med 8888 i tre säsonger. Medlemmen behöver inte lämna ID eller matchlänk. Aktiva godkända domarmedlemmar registreras automatiskt i nästa hämtning; Sören är särskilt auktoriserad som lokal pilot utan påhittad betalning eller administratörsroll.

Endast vanlig serie, CompetitionTypeID 1, hämtas. Träning, cup, kval, slutspel och sammandrag utesluts. Grundavgränsningen är förbund 11 (Värmland inklusive de korslistade serierna) och 1 (Svenska IBF). Detta är inte en garanti att en domares matcher i alla andra distrikt ingår. Lägg till relevanta distrikts-ID i STATS_FEDERATION_IDS för domare med uppdrag utanför detta område. Säsong 43 är 2025/26; 44 är 2026/27. Nya säsonger måste läggas till i miljöinställningen.

## Datamodell och personliga filter

Varje match lagras en gång med officiellt match-ID, säsong, tid, serie, båda lagens namn och lag-ID. Varje händelse lagras med officiellt händelse-ID, utvisningskod, källans benämning, minuter om angivna, period/tid och det bestraffade lagets ID. 2+2 är en händelse med fyra minuter, inte två separata händelser. Okänd längd är 0 i lagringen, utan antagande om matchstraffets längd. Lag vars ID förändrats mellan säsonger slås inte ihop efter namn automatiskt.

Mina sidor visar endast kontots egna matcher. Filter: säsong eller alla säsonger, domarkollega, lag, serie och alla matchutvisningar alternativt utvisningar mot valt lag. Lag med samma namn men olika ID hålls isär. Händelser med okänt lag ingår i matchens total men inte i filtret mot ett specifikt lag. Utvisningshändelsen innehåller ingen individuell beslutsdomare.

## Gemensam hämtning för upp till 100 medlemmar

En serielista och ett matchprotokoll läses gemensamt; antalet domare multiplicerar inte källanropen. Högst tre samtidiga matchanrop. Gamla matcher indexeras minimalt med domar-ID/namn. Detaljer och utvisningar sparas endast för valda VDK-domare. Nya medlemmar matchas mot det befintliga indexet och endast deras matchdetaljer behöver sedan läsas. Nya matcher, de senaste 21 dagarna och väntande medlemsprotokoll kontrolleras igen. En full hämtning kan göras för äldre efterhandsrättelser.

Import per match är atomisk och kan upprepas. Fel/saknade matchhändelser ersätter aldrig tidigare verifierat underlag med noll. Endast färdigrapporterade matcher importeras. Ett databaslås hindrar samtidiga körningar. Efter ett hårt processavbrott behöver serveransvarig kontrollera den avbrutna körningen och frigöra sync_lock; den tas inte bort på chans. Matcher som senare markeras inställda i serielistan utesluts från statistik och matchlistor; tidigare källunderlag behålls för spårbarhet.

Varje körning sparar avgränsning, antal kontroller, importer, väntande protokoll, okopplade namn och fel. `complete` betyder att de konfigurerade källorna genomgåtts, inte att alla distrikt eller varje namngiven domares hela karriär bevisats täckta. En slutlig medlemsserver ska även larma på `partial`/`failed` och säkerhetskopiera data.

## Start och schema

Node 24 krävs. Inga externa produktionspaket behövs.

- Första körningen: `node --env-file=.env server/sync-cli.mjs --full`
- Löpande manuell körning: `node --env-file=.env server/sync-cli.mjs`
- Automatisk uppdatering: sätt `STATS_SYNC_ENABLED=true` och kör medlemsservern kontinuerligt. Schemat använder Europe/Stockholm, måndag kl 03, inklusive sommar-/vintertid. Det kör en gång under 03-timmen; om servern är avstängd hela timmen måste en manuell upphämtning köras. Undvik en parallell extern cron om den inbyggda schemaläggaren används.

Publika GitHub Pages kör inte denna server, databas eller schemaläggare. Produktionsserver, driftövervakning och kvarvarande medlemsaktivering behöver fortfarande kopplas in. Den lokala pilotimporten innebär ingen automatisk körning på vdk.nu i natt.
