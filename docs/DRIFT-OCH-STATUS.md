# VDK.nu – drift och verifierad status

Uppdaterad 2026-10-04. Denna fil ersätter tidigare statusnoteringar om att medlemsservern inte var driftsatt.

## Produktion

- Publik webb: GitHub Pages, vdk.nu. HTTPS kontrollerat med giltigt certifikat.
- Medlemsserver: Cloudflare Worker `vdk-members` i samma Cloudflare-konto som DinPuls.
- Privat databas: SQLite i Durable Object `VdkDatabase`, beständig instans `vdk-production`. VDK använder inte DinPuls databas eller medlemskonton.
- Tillfällig fungerande tjänsteadress: https://vdk-members.soren-johansson-7.workers.dev/#/mina-sidor
- Förberedd permanent API-adress: https://api.vdk.nu. `config.js` använder denna från vdk.nu och www.vdk.nu; lokal utveckling och Worker-adressen använder samma server.
- **API-domänen är ännu inte ansluten.** vdk.nu finns inte i Cloudflare-kontot enligt senaste kontroll. Domänen behöver läggas till och aktiveras innan Worker-domänen kan kopplas. De ordinarie webb- och mejlposterna ska bevaras när DNS flyttas.
- **Automatiska medlemsmejl är anslutna.** Resend godkände testutskick och återställningsmejl från `VDK <konto@vdk.nu>`. Kontaktadressen är separat. Resend-nyckeln har Sending access för vdk.nu; leveransstatus kan inte läsas med denna nyckel. Inkommande brevlådors funktion är inte verifierad.
- Medlemsansökningar är öppna på Worker-adressen efter anslutning av Swish och e-post. Aktiveringslänkar använder den fungerande Worker-adressen tills domänkopplingen är färdig. Ett befintligt administratörskonto kan logga in utan att en obekräftad medlemsbetalning registreras.

## Medlemsflöde

Aktiv domare 100 kr, stödmedlem 100 kr och föreningsmedlem 1 500 kr per säsong. Föreningsupplägget omfattar två domarbesök om en timme och uppföljning/stöd till föreningsdomare. Företagsstöd är en gåva om minst 1 000 kr och ger inte medlemsinloggning.

Ansökan får en betalningsreferens. Administratören kontrollerar Swish-betalningen, markerar betalt och godkänner. För medlemskategorier skickas sedan en engångslänk till eget lösenord. Betalningar bekräftas inte automatiskt av QR-koden. Återställning av lösenord upphäver tidigare sessioner.

Den gemensamma Swish-PDF:en är oförändrad: mottagare 1231494988, förifyllt 100 SEK och Medlemsavgift 2026/27. Föreningar och företagsstöd får instruktioner att ändra belopp/meddelande. Mottagarnamn och genomförda betalningar har inte verifierats.

Stadgarna i `assets/stadgar-vdk.docx` har enbart ändringen 200 till 100 kr enligt användarens instruktion. Övrig text, kalenderår och stadgarnas medlemskategorier har inte ändrats.

## Statistik i produktion

Databasen innehåller Värmlands ordinarie seniorserier, utan förbundsserier, träningsmatcher, cup, kval eller slutspel. Datakällan är Svenska Innebandyförbundets publika matchdata. Hämtning kräver ingen iBIS-inloggning.

Senast verifierat underlag: 773 matcher för 2025/26 och 17 för 2026/27. Fyra ytterligare äldre matcher saknar händelseprotokoll och ingår inte som nollmatcher. Underlaget kan ändras när källan kompletteras.

Sören Johansson, domaridentitet 8888: 48 Värmlandsmatcher och 187 utvisningshändelser för 2025/26; 1 match och 5 händelser för 2026/27. Tidigare rapporter om 63 matcher inkluderade även förbundsserier och gäller inte denna regionala avgränsning.

Mina sidor visar personliga matcher och kollegor samt separat Värmlandsstatistik. Filter finns för säsong, serie, lag, domare, domarkollega och utvisningskod. Statistik mot ett visst lag kan väljas. Matchlänkar går till officiella protokoll. Matchhändelser tillhör domarparet; källan anger inte vem som fattade ett enskilt beslut.

Sökningar läser bara den privata databasen. Inga externa källanrop görs i sökvägen. Uppmätta API-svar för Sörens statistik och regional statistik var under 100 ms i de genomförda anropen; det är inte en garanti för varje nätverk eller ett lasttest.

## Automatiska uppdateringar

Cloudflare Cron är driftsatt med UTC-tiderna 01 och 02 på måndagar. Funktionen väljer enbart den tid som motsvarar 03 i Europe/Stockholm, inklusive sommar/vintertid. Drift kräver inte att användarens dator är igång.

Planen lagras före nätverksarbetet. Durable Object-alarm återupptar avbruten planering och behandlar högst 15 matcher per omgång. Varje match hämtas högst en gång i en plan, oavsett hur många VDK-medlemmar som dömt den. Gamla verifierade matcher återanvänds; nya och de senaste 21 dagarnas matcher kontrolleras på nytt. Matcher med saknade protokoll försöks igen vid nästa uppdatering. Källfel raderar inte tidigare verifierade händelser.

Schemat är driftsatt. En manuell produktionskörning av samma motor är genomförd: 21 kontroller, 4 saknade äldre protokoll, totalsummor bevarade. Första verkliga tidsstyrda körningen har ännu inte observerats. Aktuella säsonger är 43/44 och behöver ändras vid nästa säsongsbyte.

## Säkerhet och privata filer

Lösenord lagras som scrypt-hash. Sessioner är Secure/HttpOnly/SameSite=Lax i produktion och begränsas till `/api`. Webbplats och API ska ha HTTPS under samma huvuddomän så att webbläsaren kan behålla sessionen. Ursprungs- och rollkontroll sker på servern. Betalda, aktiva medlemskap krävs för vanliga medlemskonton; administratörer har separat driftsåtkomst.

Profilbild: PNG/JPEG upp till 2 MB, med formatkontroll. Lagring och hämtning är privata och kräver kontots egen session. Radering stöds. Bilder och kontodatabaser publiceras inte i GitHub.

`/internal/import`, `/internal/sync` och `/internal/status` är endast driftverktyg och kräver den privata `IMPORT_SECRET`. Nycklar, `.dev.vars`, lokal Cloudflare-lagring och databaser är ignorerade av Git. Offentlig export innehåller endast webbplatsen och dess publika tillgångar.

## Driftsättning

1. Kör `npm run check` och `npm test`.
2. Kör `node server/export-public.mjs`.
3. Driftsätt Worker med Wrangler och `wrangler.jsonc`. Produktionens namn/databasinstans ska bevaras.
4. Sätt `RESEND_API_KEY` och `EMAIL_FROM` som Worker-secrets via standard input, aldrig som hårdkodad text i Git. Avsändare: VDK <konto@vdk.nu>. Sätt EMAIL_ENABLED=true först när ett testutskick har godkänts.
5. När vdk.nu är aktiv i Cloudflare: koppla `api.vdk.nu` som Custom Domain till `vdk-members`, lägg motsvarande `routes` med `custom_domain: true` i Wrangler-konfigurationen och verifiera certifikat/API.
6. Publicera frontend via befintligt GitHub Actions-flöde. Testa inloggning, omladdning, statistik och utloggning på den riktiga vdk.nu-domänen.
7. Verifiera faktisk leverans från kontakt@vdk.nu innan aktiverings- och återställningsmejl betraktas som klara.

Cloudflare-konton, Resend-konto och Inleed-mejl är separata behörighetsytor. Att ha GitHub-åtkomst ger inte åtkomst till DNS eller en hemlig Resend-nyckel.

## Kontroller genomförda

27 automatiska tester passerade: befintlig medlemsplattform och nya Cloudflare-flöden för medlemskategorier, betalning före aktivering, engångslänkar, inloggning, återställning, sessionsspärr, roll/ursprungskontroll, regional statistik, 100 testprofiler, kö/resumption och svensk schematid.

Riktigt befintligt konto: API-inloggning, statistik och utloggning i produktion. Webbläsare: inloggning, bibehållen session efter omladdning och utloggning på Worker-adressen utan JavaScript-fel. Statistikvyer testade vid 1440 och 390 px utan horisontellt överflöde.

Profilbildens uppladdning, byte-identiska återläsning, åtkomstskydd och radering har verifierats i en separat lokal Cloudflare Worker/Durable Object-miljö. Inget tillfälligt administratörskonto eller profilbildstest skapades i produktion.

## Övriga gränser

Videocoachning stödjer rättighetsnotering, matchuppdrag, tidsmarkeringar, text och länkar till video/ljud. Automatisk tidshoppning i externa videoplattformar och egen klipplagring är inte verifierade. Möjliga återbud är inte bekräftade lediga uppdrag. Slutlig hero-bild, original-logotyp och föreningens granskning av integritetstext återstår.

## Statistik på mobil, 2026-10-04

Sökknappen kör nu även med oförändrat urval. Den visar laddningsstatus och flyttar fokus direkt till resultatet. På mobil fälls filterpanelen ihop efter sökning. Säsong, lag, serie och domare väljs i tydligt märkta listor; kryssrutan begränsar händelserna till valt lag. Ett valt lag krävs för denna begränsning, och samma domare kan inte väljas som båda i ett domarpar.

Flikarna radbryts. Match-, kategori- och kollegatabeller visas som vertikala kort vid mobilbredd, med bevarade rubriker och källänkar. Regionala matchrader visar båda officiella domarnamnen, även när matchen inte är kopplad till en medlemsprofil.

Webbläsarkontroll med verkligt regionalt cacheunderlag i en lokal testdatabas, vid 320, 375, 390, 430, 768 och 1440 px: förnyad sökning med samma filter, synligt resultat, kombinerade filter, valideringsfel och tomma urval. Inga JavaScript-fel. Ingen sidledes scrollning i flikar eller statistiktabeller vid mobilbredd. Ingen ny bild eller skärmbild skapades. Produktionskontrollen omfattar driftsatt kod och offentliga API-inställningar; användarens nuvarande lösenord ändrades inte.
