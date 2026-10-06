# Personlig förbundsstatistik

Min statistik omfattar personligt kopplade distrikts- och förbundsmatcher. Matchnivå kan väljas som Alla, Distriktsserier eller Förbundsserier. Mina sidor → Meny → Förbundsmatcher öppnar en egen vy begränsad till förbundsmatcher, med samma säsongs-, lag-, kollege- och utvisningsfilter.

Importen inventerar distrikt 11 (Värmland) samt förbund 1 (SIBF) från den officiella publika statistikkällan för säsongs-ID 40–44, alltså 2022/23–2026/27. Endast avslutat seriespel importeras; träningsmatcher, cuper, kval och slutspel ingår inte. Förbundsmatcher som VDK-domare dömt hämtas oberoende av spelplats. Match-ID används för deduplicering; namn kopplar matchens domare till VDK:s aktiva domarmedlemmar och administratörer.

Förbundets matchlistor saknar domarnamn. Första hämtningen läser därför matchprotokollen och sparar ett minimalt index med match-ID, domar-ID/namn och kontrolltid. Efterföljande hämtningar återanvänder äldre index, läser om nya/recenta matcher och hittar även tidigare matcher när en ny medlem ansluter. En gemensam skanning används för alla medlemmar. Matchjobben sparas i separata små databasrader, så att historiska stora importköer kan återupptas utan att överskrida gränsen för en SQL-rad.

matches.competition_scope anger district/federal. matches.regional_eligible anger om matchen får användas i Värmlands gemensamma statistik. En förbundsmatch utanför området kan finnas i en medlems statistik utan att ingå i Värmlands statistik eller den regionala matchsökningen. JAS18-matcher spelade inom området kan däremot ingå regionalt, som tidigare. Matchen räknas bara en gång i det totala personliga underlaget.

Saknade händelseprotokoll räknas inte som noll utvisningar. Föregående verifierade data behålls vid källfel och importen redovisas som partial när något underlag inte kan läsas. Medlemmen ser att import pågår tills den avslutats. Ordinarie uppdatering sker med det befintliga måndagsschemat klockan 03 svensk tid.
