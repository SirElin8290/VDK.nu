# Interna meddelanden

Fliken Meddelanden på Mina sidor erbjuder enskilda konversationer mellan aktiva, betalande och godkända medlemskonton samt administratörer. Mottagarlistan visar endast namn, inte e-postadresser. Även administratörers konversationsfrågor begränsas till deras egna meddelanden.

Meddelanden sparas i Durable Objects SQLite. Servern kontrollerar avsändaren från sessionen och mottagarens behörighet. Texten begränsas till 4 000 tecken och återges som vanlig text. Ett klient-id förhindrar dubbelsändning vid återförsök. Läsmarkeringar kan endast ändras av mottagaren. Konversationer laddas 50 meddelanden åt gången med åtkomst till äldre sidor.

Mejlavisering är på som standard och kan stängas av i fliken. Ett generiskt meddelande skickas via den befintliga Resend-konfigurationen för konto@vdk.nu, med länk till inkorgen. Innehållet i konversationen följer inte med mejlet. Aviseringar samlas, högst en per mottagare och 15 minuter. En beständig kö hanteras av Durable Object-alarmet, med återförsök och en fast Resend-idempotensnyckel. Interna meddelanden finns kvar även om mejlet misslyckas. Lästa meddelanden eller avstängda aviseringar tar bort väntande mejlavisering.

När Mina sidor är synligt kontrolleras olästa meddelanden var 30:e sekund. En öppen konversation uppdateras utan att skrivna utkast ersätts. Bakgrundsflikar markeras inte automatiskt som lästa.

Verifiering: 51 automatiska tester; två testmedlemmars meddelanden och svar, oläststatus, inställningar och vanlig text på 320, 390 och 1440 pixlars bredd. Mejlkö och återförsök kontrollerades med testmailer. Faktisk mejlleverans till en medlems brevlåda är inte testad i detta arbete.
