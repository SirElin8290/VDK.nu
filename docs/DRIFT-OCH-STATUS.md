# VDK.nu – implementation och drift

## Byggt

- Publik svensk webbplats: startsida, Om VDK, medlemskap, För domare, sponsorer, nyheter, kontakt och integritetsinformation.
- Svart, gul och vit identitet med responsiv navigation. Referensbilden används tillfälligt som hero-bakgrund. Ingen ny bild har genererats. Logotypen är en provisorisk textversion tills separat originalfil finns.
- Medlemsansökan, Swish-referens, manuell betalningskontroll, adminbeslut, e-postaktivering och eget lösenord.
- Medlemskategorier: aktiv domare 100 kr/säsong, stödmedlem 100 kr/säsong, föreningsmedlem 1 500 kr/säsong och företagsstöd med valfritt stöd från 1 000 kr. Kategori, belopp och förening/företag sparas i medlemsregistret. Befintliga medlemsrader migreras till aktiv domare, 100 kr. Servern bestämmer de fasta avgifterna och validerar företagets minimibelopp. Föreningsmedlemskap omfattar två domarbesök à en timme samt uppföljning och stöd till föreningsdomare. Företagsupplägget presenteras som ett första förslag med valfri synlighet som stödjande företag.
- Bli medlem i huvudmenyn och startsidans hero öppnar en minimeny med länkar till fyra egna informationssidor: aktiv domare, stödmedlem, föreningsmedlem och företagsstöd. Rösträtt och förslagsrätt beskrivs enligt användarens beslut. Företagsstöd behandlas som en gåva utan medlemsaktivering eller medlemsbehörighet och räknas inte som aktiv domarmedlem i statistiken.
- Samma QR-plats finns på alla informationssidor och styrs via `membershipQrImage` i `config.js`. Ingen ny QR-bild har skapats. Stadgesidan och länkarna styrs av `statutesUrl`. Den valda filen "Stadgar för Värmlands Domarkollektiv.docx" har lagts i `assets/stadgar-vdk.docx`. På användarens uttryckliga instruktion ändrades enbart aktiv medlemsavgift från 200 till 100; samtliga andra dokumentdelar är identiska med originalet, även formuleringen kalenderår och dokumentets två medlemskategorier.
- Säsongsbundet medlemsregister, sessionsinloggning, utloggning och lösenordsåterställning.
- Personliga matcher och statistik med säsongs- och kollegafilter.
- Videocoachansökan, coachroll, seniormatchuppdrag, rättighetsnotering, tidsintervall, kategorier, textkommentar och valfri https-länk till ljudkommentar.
- Publicering av coachningar med medlemsnotiser. Endast tilldelad coach kan redigera sitt utkast, endast berörd medlem kan läsa sin publicerade coachning.
- Separat adminvy för medlemskap, Swish-kontroll, coachansökningar, coachroller, uppdrag och aggregerad statistik.
- SQLite med unikt externt match-id och händelse-id. VDK:s totalsammanställning räknar varje match en gång.
- Serverbaserad behörighetskontroll, lösenordshashning med scrypt, engångstoken, HttpOnly-sessioner, ursprungskontroll och begränsning av inloggningsförsök.
- Regelgenerator 2026 flyttad från DinPuls till `innebandyregler/`, med en tydlig ingång på startsidan och länk tillbaka till VDK. Regelbank och träningsfunktioner är bevarade. DinPuls samtyckes- och analyskod har inte flyttats med. Träningsstatistik sparas lokalt i webbläsaren; tidigare statistik på DinPuls-domänen flyttas inte automatiskt till det nya ursprunget.

## Inte aktiverat / kräver extern verifiering

- Automatisk insamling från innebandy.se och stats.innebandy.se. Ingen skrapning eller iBIS-inloggning har lagts till. Ett adminskyddat importgränssnitt tar endast verifierat underlag för VDK-medlemmar: `POST /api/admin/import-match`. Data måste ha en officiell källadress.
- Återbudssignaler. Tomläget säger uttryckligen att datakopplingen inte är aktiverad. Inga uppdrag presenteras som lediga.
- Innebandy Play/Solidsport: automatisk tidshoppning och matchhändelse-till-video-synkronisering är inte verifierade. Tidsmarkeringar och originalvideolänk fungerar; användaren söker själv till tiden. Matchtid och videons tidslinje kan ha olika startpunkter.
- Inspelning/uppladdning av ljud och egen lagring av videoklipp. Versionen stödjer en länk till befintlig ljudkommentar och länkar till originalvideo; rättigheterna måste dokumenteras av admin.
- Produktionens Swish-nummer, e-postavsändare, API-nyckel, domän, första admin och servervärd.
- Slutlig hero-bild och original-logotyp.
- Godkänd integritetstext med föreningsuppgifter, rättslig grund och lagringstider.

## Kör lokalt eller på server

Node.js 24 eller senare behövs. Inga externa Node-paket behöver installeras.

1. Kopiera `.env.example` till `.env` och fyll i riktiga värden. Lägg aldrig `.env` eller databasen i Git.
2. Skapa första admin: `node --env-file=.env server/create-admin.mjs`. Ta sedan bort `ADMIN_PASSWORD` ur miljön.
3. Starta: `node --env-file=.env server/index.mjs`.
4. Öppna `http://localhost:3000`. Anpassa `PUBLIC_ORIGIN` om porten eller domänen ändras.

Medlemsansökan öppnas endast när `SWISH_NUMBER`, `RESEND_API_KEY` och `EMAIL_FROM` är konfigurerade. Resend kräver en verifierad avsändare. Inga riktiga mejl skickas i testerna.

Driftsätt hela appen bakom HTTPS på samma domän, med beständig volym för `data/`, säkerhetskopiering och övervakning. Dockerfile finns. Docker-container kan köras med exempelvis `--env-file .env -p 3000:3000 -v vdk-data:/app/data` och ett HTTPS-proxy framför. Sätt `HOST=0.0.0.0` i servermiljön om den ska lyssna externt.

## GitHub Pages

Den publika sidan har publicerats och verifierats på https://sirelin8290.github.io/VDK.nu/. GitHub Pages är inställt på GitHub Actions (workflow). Domänen vdk.nu är ännu inte kopplad och medlemsservern är inte driftsatt.

GitHub Pages visar den publika frontenddelen. Det kan inte köra Node-servern, hålla säkra sessionskonton eller skriva i SQLite. Medlemsfunktionerna har ett tydligt tom-/felmeddelande tills API-servern är ansluten.

Workflow exporterar endast de publika filerna och publicerar dem efter kontrollerna. Pages-källan har ändrats från main/root till **GitHub Actions**, så att endast frontendfiler publiceras som statiska filer.

Rekommenderad slutlig drift: hela appen på `https://vdk.nu` och samma ursprung för API. Alternativ: frontend på `https://vdk.nu`, API på `https://api.vdk.nu`, `config.js` anger API-bas och serverns `ALLOWED_ORIGINS=https://vdk.nu`. De är samma webbplats i kakornas mening. GitHub Pages-standarddomänen och en orelaterad API-domän fungerar inte med SameSite=Lax-kakor. Undvik sådan cross-site drift.

Ingen domänkoppling eller produktionsserver beställs automatiskt och inga Swish-uppgifter eller hemligheter gissas.

## Exempel på verifierad matchimport

Admin anropar gränssnittet från en godkänd och inloggad VDK-session. Exemplet är en formatbeskrivning, inte riktig matchdata och läses inte in automatiskt:

```json
{
  "externalMatchId": "EXTERN-MATCHIDENTITET",
  "season": "2026/27",
  "startsAt": "2026-10-10T14:00:00Z",
  "home": "Verifierat hemmalag",
  "away": "Verifierat bortalag",
  "level": "senior",
  "sourceUrl": "https://stats.innebandy.se/VERIFIERAD-MATCHADRESS",
  "members": [{ "userId": 2, "colleague": "Verifierad kollega" }],
  "penalties": [{ "externalEventId": "EXTERN-HÄNDELSEIDENTITET", "category": "Slag", "seconds": 494 }]
}
```

## Avgränsningar

Ingen generell resultat-/tabellservice, inget tillsättningssystem, ingen domarranking, ingen statistikdatabas över Värmlands övriga domare och ingen ungdomsvideocoachning.

## Kontroll

`npm run check` kontrollerar syntax. `npm test` testar betalning före godkännande, engångsaktivering, inloggning, sessionsspärr efter återställning, säsongsåtkomst, ursprungskontroll, dataseparation, seniorbegränsning, coachpublicering och deduplicerad statistik. Testerna använder temporära databaser i minnet och en simulerad e-posttjänst.

Swish-koden finns som användarens oförändrade PDF på alla fyra informationssidor. Avkodad mottagare: 1231494988, förifyllt belopp 100 SEK, meddelande Medlemsavgift 2026/27. Föreningar och företagsstöd får tydliga instruktioner att ändra belopp och meddelande. Mottagarnamn och genomförd betalning är inte verifierade.

## Profilbild och statistik, 2026-10-04

Mina sidor har privat uppladdning och radering av profilbild (JPEG/PNG, högst 2 MB). Bilden lagras i kontodatabasen och kräver användarens egen aktiva session; inga profilbilder publiceras i GitHub eller som offentliga filer. Profiluppladdningen och filtrerad kollegastatistik har kontrollerats i webbläsare vid 1440 och 390 px. Samtliga 14 tester passerade, inklusive åtkomstskydd, återimport utan dubbelräkning och matcher med noll utvisningar.

Statistikvyn visar matchlista med officiell källänk, utvisningar per match, totalsumma, genomsnitt, kategorifördelning och klickbar kollegasammanställning. Matchdata är ännu inte hämtad för användaren. Rätt domaridentitet (Sören eller Johan Johansson) och officiellt match-/profilunderlag behöver bekräftas innan import för 2025/26. Underlaget avser utvisningar i domarparets matcher, inte attribution till enskild beslutsfattare. Full säsongstäckning är inte verifierad.

GitHub Pages har anpassad domän vdk.nu konfigurerad. Inloggningsservern är fortfarande inte driftsatt; dessa kontofunktioner kan därför inte användas på den publika webbplatsen ännu.

## Verklig statistikimport 2026-10-04

Hämtmotorn är byggd och provad mot officiell matchdata. Sören Johansson, RefereeID 8888: 63 unika seriematcher / 241 utvisningshändelser för 2025/26 och 1 match / 5 händelser för 2026/27. Avgränsning: Värmlands IBF inklusive korslistade serier samt Svenska IBF. Övriga distrikt är inte genomgångna; påstå inte full nationell täckning. Träning, cuper och kval ingår inte. Alla 64 importerade matcher kontrollästes mot ursprunglig serie och händelseantal. Ursprunglig genomgång: 148 serielistor och 6197 matchläsningar, inklusive några korslistade dubbelkontroller; matchdatabasen är deduplicerad. Ny motorkod läser varje match-ID högst en gång per körning. Efterföljande löpande körning: 321 matchläsningar och oförändrade säsongstotaler, inga källfel.

21 tester passerar, inklusive 100 syntetiska medlemsprofiler i gemensam hämtning, lag/serie/kollegafilter, uteblivna protokoll, inställda matcher, återimport, cacheåteranvändning och svensk schematid. Detta är inte ett produktionslasttest med 100 riktiga domare. Rapportfilter och Mina sidor är kontrollerade i mobil och dator. Personlig databas och rapporter publiceras inte i GitHub Pages. Driftanvisningar finns i STATISTIKMOTOR.md.

Inbyggt schema måndag kl 03 Europe/Stockholm är färdigt men inte aktiverat i produktion. Medlemsservern behöver fortfarande driftsättas. Inga produktionskörningar i natt kan utlovas med bara GitHub Pages.
