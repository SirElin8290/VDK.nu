# Digital mötesplats för VDK

## Användning

Logga in på Mina sidor och välj den gula knappen **Mötesplats – gå med eller skapa möte**.
Alla medlemskategorier kan skapa och delta, inklusive aktiverade konton med tillfällig stödmedlemsåtkomst.
Ett medlemskap som har avslutats ger inte tillgång. Utloggade kan inte läsa möten, chatt eller talarlista.

Skaparen är mötesledare. Admin kan också leda. Mötesledningen kan lämnas över till en deltagare.
Datum och tid avser Sverige och konverteras oberoende av enhetens tidszon.

Gå med för att ansluta till textchatten och ljudet. Mikrofonen är alltid av från början.
Slå på den med mikrofonknappen och ge webbläsaren mikrofonbehörighet när det efterfrågas.
Om mobilens automatiska uppspelning stoppar ljudet, välj **Spela upp ljud**.
Det finns en reservknapp för att ansluta ljudet igen när anslutningen bryts.

Handknappen lägger deltagaren sist i talarlistan. En andra begäran flyttar inte personen.
Ta ner handen för att lämna kön. Mötesledaren kan välja nästa eller bocka av någon som inte längre vill prata.
Talarlistan visar ordning och nuvarande talare; den stänger inte automatiskt av mikrofoner.
Ljudet går mellan medlemmarna via LiveKit. Ingen kamera används eller kan publiceras med dessa token.
Ljud spelas inte in av VDK. Ingen AI-agent, transkribering eller observability-inspelning används.

Chatten sparas i VDK:s befintliga databas, är synlig för medlemmar och har en tydlig upplysning före anslutning.
De senaste 100 meddelandena hämtas vid öppning; nya meddelanden läses med en indexerad markör.
Avslutade möten visas i listan under den senaste veckan. Äldre möten raderas inte automatiskt.
Funktion för export och automatisk gallring ingår inte i första versionen.

När man lämnar sidan kopplas ljudet från. En utebliven heartbeat tar bort deltagaren från den aktiva listan efter två minuter.
Att avsluta mötet för alla stänger LiveKit-rummet och låser nya anslutningar och chattmeddelanden.
Texten finns kvar att läsa. Gränsen är 40 samtidiga deltagare per möte.
En aktiv mötessida avslutar ett möte som har gått fyra timmar efter start (tidig anslutning förbrukar inte kvällens tidsfönster).
Det är ingen schemalagd hård avstängning när ingen mötessida längre kontaktar VDK; LiveKits egna kvoter gäller alltid.

## Drift och behörigheter

Backend ligger i cloudflare/meetings.mjs och anropas efter samma sessions-, medlems- och ursprungskontroll som övriga medlemsfunktioner.
API-nyckel och hemlighet lagras endast som Cloudflare-hemligheter, med lokal kopia i ignorerad .dev.vars.
De levereras inte till frontend. Medlemmen får en fem minuter giltig JWT med endast sitt eget namn/ID,
ett specifikt mötesrum, mikrofonpublicering och ljudprenumeration. Inga administrativa LiveKit-grants finns i klienttoken.
Det externa rummet har ett slumpmässigt internt VDK-ID; mötesrubrik och chatt skickas inte till LiveKit.
LiveKit ser namn, media, anslutningsmetadata och nätverksinformation som krävs för ljudsamtalet.
EU Frankfurt valdes för projektdata; detta är inte ett löfte att varje mediapaket enbart går genom EU.

Servervariabler:

- LIVEKIT_URL
- LIVEKIT_API_KEY
- LIVEKIT_API_SECRET

Installera beroenden med npm ci och bygg med node server/export-public.mjs --worker.
Bygget skapar assets/meetings/audio.js från meeting-audio.js; genererad bundle ska inte checkas in.
Publicera Worker och publicera den vanliga GitHub Pages-versionen från samma commit.
Ingen DNS-förändring eller ny databas behövs. Befintliga medlemsuppgifter och statistik påverkas inte.

## Kostnadsanalys kontrollerad 23 november 2026

LiveKit Build kostar 0 USD per månad med 5 000 WebRTC-deltagarminuter och 50 GB utgående data.
Gratisnivån har hårda gränser: nya anrop nekas vid slut på kvoten, utan automatisk överdebitering.
Kvoterna delas mellan användarens gratisprojekt och nollställs varje kalendermånad.
Projektet VDK mötesrum är kontrollerat i Billing: Build, nästa faktura 0 USD.
Ingen betald LiveKit-plan eller betalkort lades till.

| Möten | Deltagarminuter |
| --- | ---: |
| 20 deltagare i 60 minuter | 1 200 |
| 20 deltagare i 90 minuter | 1 800 |
| Fyra möten med 20 deltagare i 60 minuter | 4 800 |
| 40 deltagare i två timmar | 4 800 |

En deltagarminut är en persons tid i ljudrummet, även när mikrofonen är av.
Testanslutningar förbrukar också en liten del av kvoten. Lämna därför mötet när det är slut.
Om ljudkvoten tar slut finns textchatten och talarlistan kvar hos VDK.
Det krävs ett uttryckligt beslut om ny betalplan eller annan leverantör för högre ljudvolym.

Chatt och talarlista använder VDK:s redan betalda Cloudflare Workers Paid.
Ingen ny fast avgift läggs till. Planens befintliga grundavgift är minst 5 USD per månad.
20 deltagare i en timme med fyra sekunders uppdateringsintervall ger cirka 18 000 periodiska API-anrop,
plus knapptryckningar, inloggningar och läsning av listor.
Det motsvarar cirka 1,8 procent av Durable Objects inkluderade en miljon anrop per månad.
Det finns även inkluderade CPU- och databaskvoter; dessa delas med webbplatsens övriga användning.
Beräknad extra driftskostnad vid den här mötesvolymen är 0 kronor så länge kontots inkluderade kvoter räcker.
Cloudflare har användningsbaserad debitering utöver de inkluderade kvoterna, så total extrakostnad kan inte garanteras till noll.

Källor:

- [LiveKit kvoter och gratisgränser](https://docs.livekit.io/deploy/admin/quotas-and-limits/)
- [Cloudflare Workers prislista](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Durable Objects prislista](https://developers.cloudflare.com/durable-objects/platform/pricing/)

## Verifiering

API-tester täcker medlemsbehörighet, korsursprung, talarordning, dubbla handuppräckningar,
avbockning, behörighet för mötesledare, lämnande, inaktuella deltagare, chattens idempotens,
avslut, begränsad ljudtoken och svensk tid inklusive sommartidsövergång.
Browserkontroll med tre testmedlemmar täcker den gula ingången för samtliga kategorier, skapande,
anslutning, chatt, turordning, avbockning, avslut och mobil utan horisontell rullning.
Riktigt tvåvägsljud har provats via LiveKit med två syntetiska testmikrofoner och mottagna spelande ljudspår.
Test på fysiska iPhone- och Android-enheter med olika hemnät är separat användarprovning.


## Valfria mejlinbjudningar

Skicka mejlinbjudan är avstängt som standard. Om det aktiveras väljer skaparen mottagare bland medlemmar
med aktiverat konto och aktuell åtkomst. Flera namn kan markeras; det finns även Välj alla och Avmarkera alla.
Ingen medlems e-postadress lämnas ut till klienten. Listan visar bara namn och användar-ID.

Mötesledaren eller admin kan även bjuda in från ett redan skapat möte. En mejlinbjudan gör inte mötet privat:
alla inloggade medlemmar kan fortfarande se och öppna det.
Datum, svensk tid, avsändande mötesledare och VDK-länk ingår i HTML- och textversionen av mejlet.
Mejlet skickas genom den befintliga Resend-anslutningen från konto@vdk.nu.

Mottagarna köas atomärt med mötets skapande. En mottagare köas bara en gång per möte.
Durable Object-alarmet skickar ett mejl åt gången med en stabil idempotensnyckel och återförsök vid tillfälliga fel.
Efter sex misslyckade försök markeras mejlet som misslyckat. Köade mejl till ett avslutat/borttaget möte
eller en mottagare som har förlorat åtkomst skickas inte. Status sent betyder att mejltjänsten har accepterat mejlet,
inte att leverans till mottagarens inkorg har bekräftats. Status visas för mötesledaren.

Deltagarlistan placerar alltid mötesledaren först. LiveKits aktiva talare visas därefter med större symbol,
tydlig ram och etiketten Pratar nu. Talarmarkeringen förutsätter att medlemmen har anslutit ljudet.
Knappen vid talarlistans väntande namn heter Ta bort.
