# VDK:s videocoachning

## Roller och uppdrag

Admin → Medlemmar kan lägga till och ta bort VIDEO_COACH, även på adminens eget konto. MEMBER och ADMIN påverkas aldrig. Behöriga coacher får fliken Coachuppdrag och behåller sina medlemsfunktioner. Aktiva medlemmar krävs för tilldelning; admin med VIDEO_COACH kan vara coach enligt befintligt adminundantag.

Admin → Videouppdrag väljer verifierad spelad match, en aktiv domare som kopplats till matchen och videocoach. Framtida och exkluderade matcher avvisas på servern. En videolänk är frivillig och kräver HTTPS samt dokumenterat tillstånd om den används. Ingen matchvideo lagras, laddas upp eller bäddas in.

## Arbetsflöde

Coachuppdrag grupperas i Att göra, Påbörjade och Publicerade. Öppna ett uppdrag, lägg till situationer med period + matchtid + kommentar. Period 4 och 5 kan användas för förlängning och straffläggning. Situationer sorteras kronologiskt som standard och kan redigeras, tas bort eller flyttas med upp/ner. Spara en situation med Spara situation; formulärets helhetsbild och avslutning sparas samtidigt. Spara utkast sparar helhetsbild, Star 1, Star 2, Wish och ett frivilligt utvecklingsområde. Inga betyg krävs.

Publicera videocoachning sparar utkastet och ber om bekräftelse. Servern kräver minst en situation med period och tid, helhetsbild, två styrkor och Wish. Publicerade protokoll är låsta, även för admin. Bara den tilldelade coachen får ändra utkastet. Revisioner upptäcker ändringar i andra flikar och förhindrar att ett gammalt formulär skriver över en nyare version.

## Medlemmens historik

Mina videocoachningar grupperas per säsong. Medlemmen ser endast egna publicerade historiska protokoll; utkast och andra medlemmars protokoll ger 404. Ny/Läst avser varje enskilt protokoll. Att öppna historiklistan markerar ingenting som läst. Kontrollrummet visar nya publiceringar, två styrkor och utvecklingsfokus. Ett Wish-område länkar till rätt befintligt steg i development.js. Senaste publicerade coachning med ett kopplat område ger en personlig väg in från kontrollrummet; ingen officiell ranking skapas.

## Datamodell och verifiering

Befintliga coachings och clips återanvänds och migreras i initializeCoaching. Coachings får overview, star1, star2, wish, wish_step, revision och updated_at. Clips får period och sort_order; start_seconds är tid inom perioden, end_seconds behålls för befintligt schemavillkor. Äldre klipp utan period visas som äldre videotid och måste få period innan ett äldre utkast kan publiceras. Befintliga publicerade äldre protokoll förblir läsbara med saknade sammanfattningsfält tydligt angivna. coaching_views och notifications återanvänds. Inget parallellt protokollsystem eller notificationsystem skapas.

Wish_step är index till befintliga developmentSteps; innehållet kopieras inte. Gränser: helhetsbild 10 000 tecken, övriga texter 5 000, matchtid 00:00–59:59. All återkoppling visas som escapad text. Tester täcker roller, privata utkast, ägarkontroll, fullständighetskrav, historik, publiceringslås, revisionskonflikter och lässtatus per protokoll. Browserkontroller sker utan bilder och använder simulerade mobilbredder.
