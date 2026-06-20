# Privacy Policy

_Last updated: June 20, 2026_

Traverse is a pathfinding visualizer. This policy explains the only piece of personal data the app touches: your location.

## Location access

On page load, Traverse asks your browser for permission to access your current location, using the standard browser Geolocation API.

- **Why:** solely to center the map on your city when the app opens, so you don't have to manually search for or scroll to your location.
- **What happens to it:** your coordinates are used once, locally in your browser, to call `map.setView(...)` on the Leaflet map. They are never sent to our servers, our Cloudflare Worker API, or any third party.
- **What's stored:** nothing. Your location is not saved to a database, cookie, local storage, or any file. It is discarded as soon as the map finishes centering.
- **If you deny or it fails:** the app falls back to a default map view. Nothing else changes.

You can revoke location permission at any time through your browser's site settings, and the app will continue to work normally.

## Other data the app sends

To function, Traverse sends a few things to external services, none of which are tied to your identity:

- **Map tiles** are loaded from CARTO/OpenStreetMap tile servers as you pan and zoom.
- **Search queries** you type into the location search box are sent to the OpenStreetMap Nominatim geocoding service to find matching places.
- **Road network requests** (the bounding box of the area you're routing through) are sent to our Cloudflare Worker, which queries the Overpass API for OpenStreetMap road data.

None of these requests include your name, account, location-on-load, or any other identifying information beyond the map area you're actively viewing.

## Accounts, cookies, and tracking

Traverse has no user accounts, no login, no cookies, and no analytics or tracking scripts. There is nothing to opt out of because nothing is collected in the first place.

## Changes to this policy

If this app starts handling data differently in the future, this file will be updated and the "Last updated" date above will change.

## Contact

Questions about this policy can be raised via [GitHub Issues](https://github.com/KireinaR/traverse/issues) on the project repository.
