# Min domarresa

Private `/api/journey` requires a paid, active referee membership for the current
season (including administrators). Never accepts another member's ID.

## Catalogue 2026/27

`data-catalogs/journey-2026-27.json` contains the reviewed, fixed seasonal target:
48 physical courts and 50 associations. A scheduled, non-cancelled district match
is evidence of current activity; training and pure SIBF competitions are excluded
from this census. All ages are checked, including pool matches. The geographical
scope includes Karlskoga, Degerfors, Billingsfors and Åmål.

Identical court names and coordinates are merged with an explicit list of API-ID
aliases. Distinct A/B courts and AllOffice/ASP/Klubbhuset remain separate. Three
unpositioned outside-district venues were excluded after location review.
Vallargärdet was verified locally but has no accurate source coordinates; it
counts and appears in the list, without a misleading map marker.

Regeneration: run `node server/build-journey-catalog.mjs`, then
`node server/review-journey-catalog.mjs`. Review the resulting diff, errors,
unpositioned venues and court aliases. **Assign a new catalogue version when the
target changes.** Do not silently mutate an existing version after publication.
The active definition means a club absent from the current programme is omitted;
it does not claim that every omitted association has been legally dissolved.

## Imported evidence and badges

Existing member matches are enriched via a background queue of competition and
team metadata requests. This does not overwrite match or penalty records.
New normal imports save the metadata immediately. Completion of the regular
statistics sync enqueues any missing team links. Opening the page also enqueues
missing records, allowing newly linked members to catch up.

Only completed, non-cancelled, non-abandoned, non-WO matches already in the
member's imported bank count; future and excluded records cannot grant badges.
One court per venue identity; one association per match, even if both teams
belong to it. Referee IDs identify distinct colleagues; the member is excluded.
Bronze uses ceil(25%), silver ceil(60%), gold 100%, with no awards for empty
targets. Both gold targets grant the requested additional silver combined badge.
Awards persist with their version, independent of later season filters/catalogues.

Coverage is limited to the match bank. Older youth, pool or cup matches that were
never imported cannot be inferred or manually fabricated. The UI explains this
and reports pending/missing data. There is no public ranking or penalty incentive.

## Queue and operation

The existing Durable Object alarm handles three jobs at a time, after email,
availability and ordinary statistics jobs. Each job retries up to three times
with backoff; a failed job does not block others. The authenticated internal
`GET /internal/journey` reports pending/failed counts. `POST /internal/journey`
requeues missing evidence and retries failed jobs; uses the existing import
secret. Do not log credentials or member sessions. No new cron/service is needed.

## Maps and privacy

Leaflet 1.9.4 is bundled locally. OpenStreetMap tiles load only after choosing
Visa karta; attribution remains visible and image requests carry an origin
referrer. No prefetching/offline downloads or forced cache bypass. No member or
match information is sent to the tile provider. Club locations represent the
most common home venue in the current programme. List/search/filter features
work independently of the external map. Group markers preserve distinct courts
and clubs at identical coordinates. There is no paid mapping dependency.

Validation: `npm run check`, `npm test`, public export, and browser checks of
both maps, search, marker-to-list selection, season filtering and overflow at
320/390/1440 px. Never create screenshots/images without the user's authorization.
