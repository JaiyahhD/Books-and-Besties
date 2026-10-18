# Bestie Locker — Y2K Collegiate Glam

## Preview without accounts
Open `index.html` with Live Server and navigate to `#locker-preview` (e.g. `http://127.0.0.1:5500/#locker-preview`). The preview shows sample student ID, team and statistics; it does not write data or accept book submissions.

## Live Bestie Locker
The real member dashboard is at `#dashboard` after Bestie Login. It uses the existing Supabase member data and book logging workflow, which still requires configuration and live testing.

## Files updated
- `js/app.js`: new member dashboard HTML and optional design-preview route.
- `css/styles.css`: new scoped `.locker-*` styles.
- All other pages, functions, and database setup files are retained.

## Deployment
Back up the existing project before copying these files. Do not commit secrets or private PINs. Test on desktop and mobile before sharing the member portal.
