# Bestie University — Bratz-inspired Collegiate Glam

This edition rebuilds the public homepage as a unified, responsive design with a single campus illustration, CSS-built headline, cards, residence halls, and navigation. It retains the existing routes, database schema, authentication and Netlify Functions from the prior project.

## Preview
Open index.html with Live Server. For actual accounts, polls, team scoring and admin controls, complete the Supabase and Netlify configuration described in README.md. The public homepage can be previewed without Supabase.

## Design notes
- Larger typography: Bungee + Righteous for display, Nunito for body, Pacifico for occasional accent headings. Fonts load from Google Fonts and require internet.
- The single campus illustration is decorative, while all visible homepage links, headings, content panels and buttons are HTML.
- The residence hall names are sourced from the active competition when connected, otherwise illustrative October defaults. Do not treat them as live standings.
- Theme cards are rendered in CSS and use site settings, rather than multiple decorative images.
- The existing backend is not yet production tested. Never put PINs or service-role keys into public files.
