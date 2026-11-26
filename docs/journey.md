# Min domarresa – approval requirement

All new user-supplied halls, clubs and referees must be proposed and approved by
an administrator before they appear in any catalogue, map totals or badges.
This includes administrators submitting a new name themselves. Ordinary match
statistics and the existing source-backed catalogues are separate from proposals.

- `POST /api/journey/items`: creates a pending journey_proposals row, never a
  private or shared catalogue item. Ignore any client-supplied status/shared flag.
- `GET /api/journey`: includes only this member's proposal statuses/comments.
  Pending/rejected names are not selectable and cannot affect progress.
- `GET /api/journey/proposals`: ADMIN only; all pending proposals plus the most
  recent 50 reviewed decisions. Does not require referee membership from admins.
- `POST /api/journey/proposals/:id/review`: ADMIN only. Decision is approved or
  rejected. Approval requires `verified:true`, confirming existence or historical
  existence. Admin may correct name, scope and municipality. Optional comment is
  shown to the submitter. An active hall needs a valid municipality code.
- Approval publishes one canonical shared entry. Same-name approvals from different
  submitters reuse it. No automatic experience checkmark is awarded.
- Rejection publishes nothing. A reviewed decision cannot be replayed or changed
  by a competing reviewer. The atomic transaction retains reviewer ID/time/comment.
- Members cannot submit another user's identity, review, classify catalogue items,
  or inspect anyone else's pending submissions. Mutations retain origin checks.

Existing journey_manual_items are archived and migrated idempotently into pending
proposals with unique legacy_item_id. Existing custom:* checkmarks stay archived;
if that proposal is approved, its original member's checkmark is copied to the
approved canonical key. They are excluded from counts until approval. Existing
shared entries originally authored by admins remain in the approved catalogue.

Admin UI: Administration > Domarresan – förslag. Member UI: Föreslå ett tillägg,
optional evidence, and Mina förslag with pending/approved/rejected statuses.
No email notifications are sent by this workflow. Proposal evidence is visible to
admins; approved names are shared, while experience selections remain private.

Validated with unit tests for all categories, strict verification, role/origin
checks, no pre-approval count changes, privacy, rejection, duplicate approval,
legacy migration and restoring selected experience only after approval. Browser
checks cover the full member/admin flow at 320, 390 and 1440 px.

The sections below describe the underlying checklist and map. Any earlier private
addition behaviour is superseded by this approval requirement.

The private member tab now uses manually selected grids, without maps or external
requests. It is separate from ordinary match statistics. The saved seasonal hall
and association names are the initial catalogue. Users can add private historical
places, clubs and colleagues without changing anyone else's catalogue.

`GET /api/journey` returns these three lists and the user's own selections.
`POST /api/journey/selection` takes `{kind,key,selected}` and sets an explicit
boolean (idempotent, not a server-side toggle). `POST /api/journey/items` takes
`{kind,name}`. All endpoints require a paid approved active referee membership.
No request can select a different user. Mutations retain the app's same-origin
and JSON protections. Names are validated and HTML-escaped in the browser.

Tables: journey_manual_selections, journey_manual_items and
journey_referee_directory. Referee names/IDs come only from the existing local
match_referees table. All discovered names are retained, regardless of current
activity or later match removal. The member's own referee ID/name is excluded.
No personal contact details or membership information is in the directory.

Selections start empty: unreliable automatic venue/association matches are not
converted into claimed experiences. Old journey facts and awards remain archived
in the database but do not control the new grids. There is no automatic queue,
match-cache hook or statistics-sync hook for the manual checklist. Ordinary match
statistics retain their own independent imports.

Every selected tile in a category uses the category's current tier: first selection
bronze, ceil(60% of catalogue) silver, all selected gold. Unchecking recomputes
both colour and progress. User additions increase that account's target count.
Both halls and associations at gold grant the extra silver combined badge.
The colleague category follows the same colours. No penalty or public ranking.

Search, selected/unselected filters and keyboard-operable tabs keep the long
colleague catalogue usable. Save failures retain the previous state; the UI
announces saving/errors and prevents competing writes while a save is pending.
No third-party map requests, mapping keys or paid service are involved.

Validation: npm run check; npm test; browser checks of persistence, all three
categories, private additions, colour changes at thresholds, save failures,
account isolation and responsive layouts without screenshots.

## Aktiva / Legends and municipal map

The local `journey-history.json` catalogue preserves existing numeric keys and
adds stable `history:*` keys for historical names. Initial targets are 48 active
halls/50 active clubs and 19 historical hall entries/137 historical club entries.
Historical availability is not a complete archive. Older entries without current
competition evidence are explicitly unconfirmed, rather than declared dissolved.
MB87 is user-provided; Tösse has a source reference. Catalogue provenance is kept.

Referees require a Värmland district/regional match link to enter the general
lists. Names remain retained after later removal of that match. Current-season
match evidence or an upcoming assignment marks a referee active; otherwise they
are historical/unconfirmed. Previously selected outside-scope colleagues remain
available to that account. Own ID/name is excluded. No external fetch is made.

Each scope has separate counts, progress and combined badges. Selections retain
one `(user,kind,key)` identity across scopes. Admin POST `/api/journey/classify`
can move shared items; owners can move their private custom items. Common overrides
are stored in journey_catalog_overrides. Admin can add shared items via the existing
items endpoint with `shared:true`; other members cannot. Active custom halls must
have one of the valid municipality codes. Existing personal additions migrate to
Legends without losing their selection records.

The map uses active halls only, independent of which collection is currently open.
0 selected = gray; some = blue; all = green. A municipality with no listed halls
never becomes complete. Historical halls cannot prevent a current municipality
from completing. Club counts are shown separately and do not change the hall colour.
Pins appear for selected halls; a toggle shows unselected halls too. Identical
positions share a grouped pin. Map/list buttons navigate to the manual tile and
never mark it automatically. Private additions without positions count in their
assigned municipality but do not receive a fabricated pin.

Twenty municipal areas: Värmland county plus Karlskoga, Degerfors, Åmål and
Bengtsfors (Billingsfors). Shapes are local SCB RegSO 2025 unions, simplified for
browser rendering, preserving real municipality membership from unsimplified
polygons. `server/build-journey-history.py` documents regeneration; it requires
shapely and the source inventories in outputs. The map paths are code-native SVG,
not generated raster artwork, and no external map provider is contacted at runtime.
Vallargärdet is approximately positioned at the independently geocoded school
address Diamantvägen 12 (OpenStreetMap); all initial active halls have positions.

Browser validation: 320/390/1440 px, scope navigation, historic selections after
reload, admin moves, map-to-tile navigation, gray/blue/green and reverse transitions,
zoom controls and no horizontal overflow. No screenshots were created.

## Shared member profile and series checklist

The fixed `journey-series.json` catalogue adds 29 lifetime experience boxes:
boys red 1–7, girls red 1–4, men 5–2, women 3–1, HJ17/DJ17, male/female
HJ18/DJ18 JAS, HJ16–20, senior/junior DM group/finals and Lilla VM group/finals.
No green/blue series. These are personal experience statements, not eligibility.
They use existing manual selection, badges and admin proposal approval protections.
The Series tab opens from the profile via `?category=series` and uses the active
collection for the fixed lifetime checklist. Historical section badges stay separate.

Member profile sharing has a contact master switch and individual switches for
email, phone, city, address, departure and bio. Existing shared contact permissions
migrate unchanged; new badge/series sharing defaults off. Old clients retain their
previous all-contact sharing semantics, without ever enabling badge/series sharing.
Photo sharing remains independent. Login email is never substituted for contact email.

`journeyProfileSummary` returns only earned badge aggregates and names of selected
series. No hall/club/colleague lists, map coordinates or proposal metadata reach
another member's profile. Separate share_badges/share_series opt-ins control the
response itself. Revoking either permission stops subsequent reads immediately.
Only paid approved members or admins can read shared profiles/photos; temporary
members can still edit their own profile and see directory names, without contact
fields or shared images. Member directory pictures use the same protected endpoint.

The owner can preview the shared profile and open the series checklist. The shared
profile explains that these are self-reported experiences, not federation ranking.
Contact privacy, separate opt-ins, revocation, bronze/gold display and checklist
persistence were tested through real local handlers at 320/390/1440 px without
screenshots or changes to production members' profile settings.
