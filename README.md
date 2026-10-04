# VDK.nu
VDK.nu – digital medlems- och utvecklingsplattform för Värmlands Domarkollektiv.

Svensk publik webbplats och medlemsplattform i svart, gult och vitt.

## Starta

Node.js 24+. Kör `npm start` och öppna `http://localhost:3000`.
För konfigurerad medlemsdrift: kopiera `.env.example` till `.env` och kör `node --env-file=.env server/index.mjs`.

## Verifiera

`npm run check` och `npm test`.

## Drift och integrationsstatus

Se [driftinstruktioner och exakt funktionsstatus](docs/DRIFT-OCH-STATUS.md).
Frontend publiceras via GitHub Pages. Medlemsserver och privat statistikdatabas är driftsatta på Cloudflare Workers med SQLite i en Durable Object. API-domänanslutningen återstår; aktuell status och verifieringsgränser finns i driftinstruktionerna.
