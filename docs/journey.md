# Min domarresa – manual checklist

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
