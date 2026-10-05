# Möjliga återbud

Medlemmarnas verktyg läser en sparad SQLite-snapshot genom `/api/availability`. Filtren för exakt serie, lag, datum, publicerad domarkollega och noll/en domare arbetar på snapshoten utan externa anrop.

Cloudflare anropar dagligen UTC 01 och 02. En kontroll av Europe/Stockholm accepterar bara klockan 03, både sommar och vinter. Dagens datum spärrar en extra körning. Perioden är dagens svenska kalenderdatum och följande 29 kalenderdatum. Säsong väljs efter juli-gränsen.

Källan är den publika innebandystatistiken. Listor från Värmlands distrikt kontrolleras mot varje series metadata och matchens egen serie. Endast röd serie för pojkar/flickor, H5–H2, D3–D1 och HJ17/DJ17 ingår. Förbundsserier, grön/blå serie och andra nivåer undantas. Samma avgränsning tillämpas direkt på tidigare sparade matcher och seriefiltret. Varje match hämtas en gång. Spelplats verifieras geografiskt för Värmland, Karlskoga, Degerfors, Billingsfors och Åmål. Okända spelplatser visas inte.

Matcher med två namngivna domare, inställda eller färdigspelade matcher visas inte. Noll/en publicerad domare betyder en möjlig lucka, inte att tillsättningen faktiskt är ledig. Ungdomsmatcher kan ha en annan förväntad bemanning. Verifiera alltid i iBIS.

Hämtningen fortsätter i små beständiga deljobb. En färdig snapshot ersätter föregående snapshot i en transaktion. Under uppdatering eller planeringsfel finns föregående underlag kvar och dagens datumgräns tillämpas fortfarande. Misslyckade enskilda matchkontroller utelämnas och antal visas. Statistikens måndagsjobb använder samma alarmkö och fortsätter efter återbudshämtningen.

Skyddad manuell start: POST `/internal/availability` med importbehörighet. GET samma adress visar bara köprogress. Ingen hemlighet ingår i källkoden.
