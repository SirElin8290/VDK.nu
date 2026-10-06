# Medlemsdokument

Dokument länkas högst upp på Mina sidor för aktiva, förenings- och stödmedlemmar. Admin laddar upp via Administration → Dokument. Tre sektioner: Svenska Innebandyförbundet, Värmlands Innebandyförbund, Värmlands Domarkollektiv.

Flöde: välj PDF, DOCX eller UTF-8 TXT, Läs in dokument, granska hela texten, ange rubrik och sektion, bekräfta innehåll, Publicera. Texten visas som escaped HTML med radbrytningar. Original-PDF behålls; DOCX/TXT konverteras i administratörens webbläsare till en textbaserad PDF med inbäddad Noto Sans (SIL OFL). Word-layout bevaras inte. Word med bilder avvisas med instruktion att exportera PDF i Word först. Skannade PDF:er kräver manuellt kompletterad lästext; OCR ingår inte. Granskningen är viktig för tabeller, symboler, ordning och PDF-textutvinning.

Gränser: 5 MB fil/PDF, 80 000 tecken lästext, 200 sidor inläst PDF. Gamla DOC, Excel och PowerPoint stöds inte; exportera dem som PDF först. Originalfil i Word sparas inte efter konvertering.

PDF lagras i 64 KiB-bitar i Durable Object SQLite, text och metadata i member_documents. Uppladdaren och tid sparas. Alla list-, text- och PDF-API:er kräver godkänt betalt medlemskap eller ADMIN. API returnerar private/no-store; filen exponeras aldrig som publik statisk tillgång. Adminbehörighet verifieras separat för uppladdning. PDF läses och valideras även på servern med pdf-lib, lösenordsskyddade filer avvisas.

npm ci och server/build-documents.mjs bygger webbläsarpaket och kopierar PDF.js-worker. Bygget körs automatiskt vid export och Worker-publicering. Genererade JS-filer ignoreras i Git. Mammoths webbläsarversion används; dess transitive CLI-beroenden argparse/sprintf-js används inte av uppladdningen. Fontlicens finns i assets/documents/OFL.txt.

Tester: medlemskategorier, anonym/obetalad/adminkontroll, alla sektioner, textinnehåll, PDF-roundtrip, validering och chunklagring. Lokal webbläsarkontroll med TXT/DOCX/PDF och flersidig svensk PDF, på 390 och 1440 px. Testuppladdningar hålls i lokal databas, aldrig i produktion.
