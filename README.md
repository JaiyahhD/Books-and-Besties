# 🎀 Books & Besties HQ
**Read · Connect · Belong** — official community site with your supplied logo.

## Included
- Responsive public homepage, About page, seasonal branding, current/upcoming themes, current Book Pick and Facebook link.
- Public Book Pick nominations and one-vote-per-verified-email voting (email code through Netlify Functions + Resend).
- Bestie email + 6-digit PIN signup/login, email confirmation, admin approval and team assignment.
- Monthly Crown: 3 teams, custom competition dates, reading logs, automatic daily 1,000-page cap, 72-hour logging window, rejection/recalculation, leaderboard, archives in the database.
- Private Admin HQ: members, seasons, polls, homepage manager, logs, owner-only admin invitations.

## IMPORTANT: Before launch
**This ZIP contains real working website source, not a preconfigured live service.** You must create and connect Supabase, Netlify, and (for public voting and staff invitations) Resend. Nothing can save member accounts, email voting codes, or scores until you configure these services. The original logo is in `assets/logo.png`.

**Security:** The two PINs discussed in chat are NOT in any files. They should be replaced with fresh private PINs. Do not publish PINs, service role keys, Resend API keys, or the voting pepper in GitHub. A six-digit PIN is less secure than a password. Supabase email confirmation is enabled for members, but **this starter does not yet implement mandatory second-factor verification on every admin login**. For production use, enable Supabase MFA or extend the admin login flow to require a second factor. Use rate limiting and abuse protection at Netlify/Supabase as well.

## Setup — in order
1. **Extract the ZIP**. Open the *entire* `books-and-besties` folder in VS Code (do not drag out individual files). The logo is already in `assets/`.
2. Create a Supabase project at https://supabase.com. In **SQL Editor**, paste and run `supabase/schema.sql` **once** in a fresh project. Do not run it repeatedly; it creates tables, triggers, policies, and functions.
3. In Supabase Authentication → Providers → Email, enable **Confirm email**. Configure the Site URL and Redirect URLs for your deployed Netlify domain and your localhost development URL. Set your Auth minimum password length to **6**. (Supabase uses the PIN as the password; it hashes it on the server.) Set the appropriate password strength rules to allow numeric PINs only if you accept the reduced security. Email verification and rate limits remain important.
4. In `js/config.js`, paste your Supabase **Project URL** and **publishable/anon key**. These are public browser values. **Never use the `service_role` key here.** Paste your real Facebook group URL in `FACEBOOK_URL` or enter it later in Admin HQ.
5. Register YOUR Bestie account on the website using your own email and a **new private PIN**. Confirm the email. Open `supabase/bootstrap_owner.sql`, replace the placeholder email with your email, and run it once in Supabase SQL Editor. Log out and log in using **Admin Login**. This makes you the only initial owner. Other admins must be invited by you.
6. Create a Resend account at https://resend.com and verify a sending domain. You will need `RESEND_API_KEY` and `FROM_EMAIL` (e.g. `Books & Besties <hello@yourdomain.com>`).
7. Push this whole folder to a GitHub repository using GitHub Desktop. Connect the repo to Netlify. Netlify build settings: publish directory `.` (project root), no build command required. Netlify automatically bundles functions from `netlify/functions` and installs package dependencies.
8. In Netlify → Site configuration → Environment variables, set:
   - `SUPABASE_URL` = Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = **secret** Supabase service role key
   - `RESEND_API_KEY` = secret Resend API key
   - `FROM_EMAIL` = verified sender address
   - `VOTE_PEPPER` = long random secret string (32+ characters)
   - `SITE_URL` = `https://YOUR-SITE.netlify.app/`
   These variables must be **server-side only**; do not prefix with `VITE_` or paste into client JavaScript. Redeploy after changing them.
9. In Supabase Auth URL configuration, allow your Netlify URL. Test email confirmation, login, admin dashboard, public voting, and a test Monthly Crown competition before inviting members.
10. In Admin HQ, create a **draft** season with three teams, activate it, approve members and assign teams. Create a draft Book Pick poll and publish it. Update the homepage theme and Facebook URL.

## Local development
For public static pages, use VS Code Live Server (open `index.html`). For Netlify voting and staff functions, install Node.js and run:
```bash
npm install
npx netlify dev
```
Netlify Functions only work on Netlify or with `netlify dev`, not plain Live Server. Put server secrets in Netlify environment variables (or a **local untracked** `.env` file). Do not commit `.env`.

## Current default homepage
- **October:** Boo & Boujee
- **November:** The Velvet Latte Lounge
- **Current Bestie Book Pick:** *Misery* by Stephen King
- Logo: your exact uploaded Books & Besties logo.

## Monthly Crown rules — important
The implemented baseline is:
- Up to 1,000 credited pages per member per completion date, with excess pages receiving zero credit.
- A completed book must be logged by **72 hours after the end of its completion date in America/Chicago**. (This interpretation is configurable in SQL, but changing it requires an update to `submit_book`.)
- Competition must be active, today's date must fall within season dates, completion date must be within season dates, and member must be approved and assigned a team.
- Straightforward duplicate title/date submissions are rejected.
- Credited pages recalculate when admins reject/restore a log.
- **Amazon-listed page count, audiobook conversion, rereads, and exceptions are not automatically verified yet**. The system accepts the submitted page count and admins can reject entries. The final published rules and any additional scoring validation need your confirmation before a full public launch.
- Assign teams **before members log**. Moving a member later does **not** retroactively move already credited pages; historical team credit stays with the original team. Admin review can correct errors manually in Supabase until a transfer tool is added.
- The current member dashboard totals show up to 150 recent submissions, not a guaranteed lifetime total; a server-side summary RPC should be added if you need larger histories.
- The competition is a single active season at a time. Archived seasons remain in the database. You can activate the next draft after closing the current one.

## Public vote limitations
Voting requires an email verification code, but one-email-one-vote is not the same as one-human-one-vote. Someone with multiple email addresses can vote multiple times. Production deployment should add Netlify edge/bot protection, request throttling by IP, and email sending quotas. Do not publish the site widely without these protections.

## Production checklist
- [ ] Correct Facebook URL and email sender domain
- [ ] New private owner PIN; no PINs in source control
- [ ] Mandatory admin MFA / second factor
- [ ] Confirm email + reset email works
- [ ] Rate limiting / bot protection / abuse controls
- [ ] Test row-level security with member and admin accounts
- [ ] Finalize Monthly Crown rules and scoring exceptions
- [ ] Review privacy policy and data retention (emails, votes, reading logs)
- [ ] Test mobile screens, keyboard navigation, and Netlify functions

## Project files
- `index.html` — single-page app shell
- `css/styles.css` — site styling, responsive layouts, seasonal CSS variables
- `js/config.js` — public browser configuration
- `js/app.js` — page rendering, authentication, dashboards, forms
- `supabase/schema.sql` — database schema, row-level security, scoring functions
- `supabase/bootstrap_owner.sql` — promote the initial owner after signup
- `netlify/functions/` — email-verified public votes and owner-only admin invitations
- `netlify.toml` / `package.json` — deployment configuration

## Troubleshooting
- **Site loads but login fails:** Verify the URL/key in `js/config.js`, email verification, and Auth settings allowing six-digit numeric passwords.
- **Member can't log a book:** Confirm approved profile, active season, team assignment, and date window.
- **Poll code doesn't arrive:** Check Netlify functions logs, Resend domain verification, FROM_EMAIL, and environment variables.
- **Admin Login says unauthorized:** Run `bootstrap_owner.sql` after creating/verifying your account; then sign out/in.
- **Leaderboard empty:** Activate a season, assign teams, and submit a valid log.

Built for Books & Besties ♡


## Scrapbook × Varsity redesign (October 2026)
This edition refreshes the CSS and public homepage while preserving the existing Supabase schema, authentication, admin functions, and Monthly Crown logic. Fonts load from Google Fonts when online. The site uses the supplied original logo. Theme accent/background values can still be changed by admins; the permanent scrapbook styling remains. Do not place real admin PINs in source files. Preview with a local server, then test all flows against a configured Supabase project before deploying.


## Dreamhouse scrapbook redesign (v3)
This edition recreates the layered scrapbook composition using actual HTML and CSS components, with small decorative image crops from the supplied visual reference. The homepage cards, navigation, book pick and Monthly Crown links remain functional HTML. The original logo is unchanged. Backend integration is unchanged and still requires configuration, testing and final scoring-rule verification.
