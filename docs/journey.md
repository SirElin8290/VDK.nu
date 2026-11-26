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
