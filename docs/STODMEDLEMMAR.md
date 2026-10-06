# Stödmedlemmarnas Mina sidor

Aktuell kategori support, utan ADMIN, visar en samlad startsida med medlemsstatus, meddelanden, medlemslista och Domartavlan. Äldre länkar till domarverktyg öppnar samma startsida. Profilbild kan fortfarande ändras. Obetalda eller ej godkända stödmedlemmar ser bara medlemsstatus. ADMIN behåller administrationsverktygen.

Personliga och regionala statistik-, match-, återbuds- och coachnings-API:er nekas stödmedlemmar. Övriga medlemskategorier behåller nuvarande verktyg.

Lämna förslag finns som mottagarval i Meddelanden för alla godkända medlemmar. Förslag sparas i member_suggestions och kan endast läsas via ett ADMIN-skyddat API. Det skapas inget personkonto eller någon vanlig konversation för förslagsinkorgen. Författaren får ett kvitto efter inskickning. Inkorgen visar 50 förslag åt gången med länk till äldre.

Admin kan välja Alla medlemmar och bekräfta utskicket. Det skickas som separata privata meddelanden till godkända betalande medlemmar med aktiverat konto, inklusive stödmedlemmar, exklusive avsändaren och företagsgåvor. Svar är privata mellan medlem och avsändare. Befintliga mejlpreferenser och aviseringskö används. Idempotens förhindrar dubbla utskick vid samma formulärförsök.

Verifiering: tests/support-portal.test.mjs omfattar kategoriåtkomst, förslagssekretess, validering, utskicksbehörighet och idempotens. Webbläsarkontroll i lokal testdatabas omfattar 320, 390 och 1440 px, båda teman, stödmedlemmars samlade sida, inskickning, admininkorg och bekräftat utskick. Inga testmeddelanden eller testförslag skickas i produktion.

Adminutskick kan riktas till all, active, club eller support. Kategorigrupper kräver betalt och aktivt medlemskap för aktuell säsong. Tom grupp ger ett tydligt fel och skapar inget utskick. Mottagargruppen sparas med utskicket och ingår i kontrollen av upprepade formulärförsök.
