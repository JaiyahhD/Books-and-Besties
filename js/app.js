
(() => {
    'use strict';

    const C = window.BB_CONFIG || {};
    const configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
    const db = configured && window.supabase
        ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY)
        : null;

    const $ = s => document.querySelector(s);
    const app = $('#app');

    let session = null;
    let profile = null;
    let settings = null;
    let season = null;
    let teams = [];
    let logs = [];
    let poll = null;
    let votes = [];
    let members = [];
    let adminTab = 'overview';

    const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));

    const num = n => Number(n || 0).toLocaleString();

    const date = s => s
        ? new Date(s + 'T12:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        : '—';

    const today = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const message = s => {
        const t = $('#toast');
        t.textContent = s;
        t.style.display = 'block';
        clearTimeout(message.timer);
        message.timer = setTimeout(() => t.style.display = 'none', 4200);
    };

    const defaults = {
        current_theme: 'Boo & Boujee',
        next_theme: 'The Velvet Latte Lounge',
        featured_book: 'Misery',
        featured_author: 'Stephen King',
        theme_name: 'Boo & Boujee',
        theme_hero: '',
        theme_accent: '#b96e8d',
        theme_hero_color: '#f4e3e9',
        facebook_url: C.FACEBOOK_URL || '',
        about_text: 'Books & Besties is a welcoming community of readers who connect through books, group conversations, monthly reads, and friendly reading competitions.'
    };

    const val = id => $('#' + id)?.value?.trim() || '';
    const fb = () => settings?.facebook_url || C.FACEBOOK_URL || '#';

    const btn = (text, href, cls = '') =>
        `<a class="btn ${cls}" href="${escape(href)}">${text}</a>`;

    const pagehead = (eyebrow, title, desc) =>
        `<section class="pagehead"><div class="wrap"><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="lead">${desc}</p></div></section>`;

    const field = (label, id, type = 'text', value = '', extra = '') =>
        `<div class="form-row"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${escape(value)}" ${extra}></div>`;

    const panel = (title, body) =>
        `<div class="card"><h3>${title}</h3>${body}</div>`;

    const logged = () => !!session;
    const admin = () => profile?.role === 'admin' || profile?.role === 'owner';
    const owner = () => profile?.role === 'owner';

    async function loadPublic() {
        settings = { ...defaults };
        if (!db) return;

        const [s, t, p] = await Promise.all([
            db.from('site_settings').select('*').eq('id', 1).maybeSingle(),
            db.from('seasons').select('*').eq('status', 'active').limit(1).maybeSingle(),
            db.from('polls').select('*,poll_options(*)').eq('status', 'open')
                .order('created_at', { ascending: false }).limit(1).maybeSingle()
        ]);

        if (s.data) settings = { ...defaults, ...s.data };
        season = t.data || null;
        poll = p.data || null;

        if (season) {
            const r = await db.from('teams')
                .select('*')
                .eq('season_id', season.id)
                .order('name');
            teams = r.data || [];
        }
    }

    async function loadUser() {
        if (!db) return;

        const r = await db.auth.getSession();
        session = r.data?.session || null;
        profile = null;

        if (session) {
            const p = await db.from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
            profile = p.data || null;
        }
    }

    function applyTheme() {
        document.documentElement.style.setProperty(
            '--accent', settings.theme_accent || defaults.theme_accent
        );
        document.documentElement.style.setProperty(
            '--hero', settings.theme_hero_color || defaults.theme_hero_color
        );

        $('#footerFb').href = fb();
        $('#footerFb').style.display = fb() === '#' ? 'none' : '';
    }

    function nav() {
        document.querySelectorAll('.guest-only').forEach(x =>
            x.classList.toggle('hidden', logged())
        );
        document.querySelectorAll('.signed-in-only').forEach(x =>
            x.classList.toggle('hidden', !logged())
        );
        document.querySelectorAll('.member-only').forEach(x =>
            x.classList.toggle('hidden', !logged())
        );
        document.querySelectorAll('.admin-only').forEach(x =>
            x.classList.toggle('hidden', !admin())
        );
    }

    function render() {
        applyTheme();
        nav();

        const route = location.hash.split('?')[0].replace('#', '') || 'home';

        const routes = {
            home,
            about,
            'book-pick': bookPick,
            crown,
            login: () => authPage(false),
            'admin-login': () => authPage(true),
            register,
            dashboard: () => dashboard(false),
            'locker-preview': () => dashboard(true),
            admin: adminPage,
            'reset-pin': resetPin
        };

        app.innerHTML = (routes[route] || home)();

        app.querySelectorAll('form[data-action]').forEach(f =>
            f.addEventListener('submit', handleForm)
        );

        app.querySelectorAll('[data-click]').forEach(b =>
            b.addEventListener('click', handleClick)
        );

        app.querySelectorAll('[data-tab]').forEach(b =>
            b.addEventListener('click', () => {
                adminTab = b.dataset.tab;
                render();
                fillAdmin();
            })
        );

        window.scrollTo(0, 0);

        // PHASE 8.6: Load live announcements whenever the Quad is rendered.
        if (app.querySelector('#campusBulletinFeed')) {
            fillCampusBulletin();
        }
    }

    function home() {
        const names = teams.length
            ? teams.map(t => escape(t.name))
            : ['Vicious Vixens', 'The Ghoulfriends', 'Pretty Little Hexes'];

        const em = ['💋', '👻', '🔮'];

        const teamCards = names.slice(0, 3).map((name, i) => `
            <div class="glam-hall hall-${i + 1}">
                <span class="hall-emblem">${em[i]}</span>
                <strong>${name}</strong>
                <small>Residence Hall ${i + 1}</small>
            </div>
        `).join('');

        const community = escape(fb());

        return `<div class="glam-home">
            <section class="glam-campus" aria-labelledby="glam-title">
                <div class="glam-leopard-strip" aria-hidden="true"></div>
                <div class="glam-hero-scene">
                    <div class="glam-campus-title">
                        <span class="glam-welcome">✦ WELCOME TO ✦</span>
                        <h1 id="glam-title">
                            <span>BESTIE</span>
                            <span>UNIVERSITY</span>
                        </h1>
                        <div class="glam-motto">READ · CONNECT · BELONG</div>
                        <p>A community built on books, friendship, laughter, and a shared love of reading. ♡</p>
                        <a class="glam-join" href="${community}" target="_blank" rel="noopener noreferrer">
                            ♥ Join Our Facebook Community <span>↗</span>
                        </a>
                    </div>
                </div>
                <nav class="glam-shortcuts" aria-label="Explore Bestie University">
                    <a href="#book-pick"><span>📖</span>Book Pick</a>
                    <a href="#crown"><span>👑</span>Monthly Crown</a>
                    <a href="#about"><span>🎀</span>Our Story</a>
                    <a href="#crown"><span>🏠</span>Campus Housing</a>
                    <a href="#dashboard"><span>💖</span>Bestie Locker</a>
                    <a href="${community}" target="_blank" rel="noopener noreferrer">
                        <span>💌</span>Join the Besties
                    </a>
                </nav>
            </section>

            <section class="glam-content" aria-label="Campus news and happenings">
                <div class="glam-main-grid">
                    <article class="glam-panel glam-feature">
                        <div class="glam-panel-heading">
                            <span>♡ CURRENT BESTIE BOOK PICK</span>
                            <span>✦</span>
                        </div>
                        <div class="glam-feature-body">
                            <div class="glam-cover">
                                <small>STEPHEN KING</small>
                                <strong>MISERY</strong>
                                <span>✦</span>
                            </div>
                            <div>
                                <span class="glam-kicker">THE CAMPUS READ</span>
                                <h2>${escape(settings.featured_book)}</h2>
                                <p class="glam-author">by ${escape(settings.featured_author)}</p>
                                <p>One book. A whole campus of opinions. Come read and discuss with your Besties!</p>
                                <a href="#book-pick" class="glam-small-btn">Explore Book Pick ↗</a>
                            </div>
                        </div>
                    </article>

                    <article class="glam-panel glam-theme">
                        <div class="glam-panel-heading">
                            <span>👻 THIS MONTH ON CAMPUS</span>
                            <span>OCTOBER</span>
                        </div>
                        <div class="glam-theme-body">
                            <span class="glam-theme-star">✧</span>
                            <small>CURRENT CAMPUS THEME</small>
                            <h2>${escape(settings.current_theme)}</h2>
                            <p>Spooky season, but make it Bestie University.</p>
                            <span class="glam-ghosts" aria-hidden="true">👻 🎀 🕯️</span>
                        </div>
                    </article>

                    <article class="glam-panel glam-upcoming">
                        <div class="glam-panel-heading">
                            <span>☕ COMING TO CAMPUS</span>
                            <span>NEXT MONTH</span>
                        </div>
                        <div class="glam-upcoming-body">
                            <small>NOVEMBER THEME</small>
                            <h2>${escape(settings.next_theme)}</h2>
                            <p>Warm drinks, velvet vibes, and pages worth staying up for.</p>
                            <span aria-hidden="true">☕ 📚 ✨</span>
                        </div>
                    </article>
                </div>

                <div class="glam-lower-grid">
                    <article class="glam-panel glam-housing">
                        <div class="glam-panel-heading">
                            <span>👑 CAMPUS HOUSING</span>
                            <a href="#crown">Crown Commons ↗</a>
                        </div>
                        <p class="glam-subtitle">Monthly Crown · Our three residence halls</p>
                        <div class="glam-halls">${teamCards}</div>
                        <a href="#crown" class="glam-small-btn">View the Team Standings ↗</a>
                    </article>

                    <article class="glam-panel glam-bulletin">
                        <div class="glam-panel-heading">
                            <span>📣 CAMPUS BULLETIN</span>
                            <span>THE LATEST</span>
                        </div>
                        <div id="campusBulletinFeed" aria-live="polite">
                            <div class="glam-bulletin-item">
                                <span>💌</span>
                                <p>Loading the latest campus announcements…</p>
                            </div>
                        </div>
                    </article>

                    <article class="glam-panel glam-calendar">
                        <div class="glam-panel-heading">
                            <span>🗓️ CAMPUS HAPPENINGS</span>
                            <span>EXPLORE</span>
                        </div>
                        <a href="#book-pick">
                            <span>📚</span>
                            <span><b>Campus Book Club</b><small>Read, discuss, and vote</small></span>↗
                        </a>
                        <a href="#crown">
                            <span>🏆</span>
                            <span><b>Monthly Crown</b><small>Log your pages and compete</small></span>↗
                        </a>
                        <a href="#about">
                            <span>🎀</span>
                            <span><b>Meet the Besties</b><small>Our community story</small></span>↗
                        </a>
                    </article>
                </div>
            </section>

            <section class="glam-admissions">
                <span>💌 CAMPUS ADMISSIONS</span>
                <h2>Your Bestie Era Starts Here! ♡</h2>
                <p>Come for the books. Stay for the friendships. Find your people, one chapter at a time.</p>
                <a href="${community}" target="_blank" rel="noopener noreferrer" class="glam-join">
                    Join Our Facebook Group ↗
                </a>
                <small>Facebook membership and website accounts are separate.</small>
            </section>
        </div>`;
    }

    // =========================================================
    // PHASE 8.6 — LIVE PUBLIC CAMPUS BULLETIN
    // Reads published announcements without sending Campus Mail.
    // =========================================================

    async function fillCampusBulletin() {
        const feed = $('#campusBulletinFeed');
        if (!feed) return;

        if (!db) {
            feed.innerHTML = `
                <div class="glam-bulletin-item">
                    <span>💌</span>
                    <p>Campus announcements are temporarily unavailable.</p>
                </div>`;
            return;
        }

        try {
            const { data, error } = await db.rpc(
                'get_public_campus_bulletin'
            );

            if (error) throw error;

            // Don't update an old element after navigation.
            if (!feed.isConnected) return;

            const announcements = Array.isArray(data) ? data : [];

            if (!announcements.length) {
                feed.innerHTML = `
                    <div class="glam-bulletin-item">
                        <span>🎀</span>
                        <p>No campus announcements just yet. Stay tuned, Besties!</p>
                    </div>`;
                return;
            }

            const emojis = ['💌', '📣', '✨', '🎀', '📚'];

            feed.innerHTML = announcements.map((announcement, index) => {
                const emoji = emojis[index % emojis.length];
                const title = escape(announcement.title || 'Campus Update');
                const body = escape(announcement.message || '');

                return `
                    <div class="glam-bulletin-item">
                        <span>${emoji}</span>
                        <p>
                            <strong>${title}</strong>
                            <span style="display:block;white-space:pre-wrap;margin-top:5px;">
                                ${body}
                            </span>
                        </p>
                    </div>`;
            }).join('');

        } catch (error) {
            console.error('Campus Bulletin could not load:', error);

            if (!feed.isConnected) return;

            feed.innerHTML = `
                <div class="glam-bulletin-item">
                    <span>💌</span>
                    <p>Campus Bulletin couldn't load right now. Please check back soon.</p>
                </div>`;
        }
    }

    function about() {
        return pagehead(
            'Our Story',
            'Read. Connect. Belong.',
            'Books & Besties is more than a reading group — it’s a place to find your people.'
        ) + `<section class="section">
            <div class="wrap two-col">
                <div>
                    <h2>Welcome to your bookish family ♡</h2>
                    <p class="lead">${escape(settings.about_text)}</p>
                    <p>From our monthly Bestie Book Pick to themed events and Monthly Crown team competitions, there's always a new chapter to share.</p>
                    <div class="actions">
                        ${fb() !== '#'
                            ? `<a class="btn" href="${escape(fb())}" target="_blank" rel="noopener">Join Us on Facebook ↗</a>`
                            : ''}
                        ${btn('Explore Monthly Crown', '#crown', 'outline')}
                    </div>
                </div>
                <div class="card center">
                    <img src="assets/logo.png" alt="Books & Besties official logo" style="width:min(100%,350px);border-radius:16px">
                    <h3>All readers welcome.</h3>
                    <p>Come for the books. Stay for the besties.</p>
                </div>
            </div>
        </section>`;
    }

    function bookPick() {
        const options = (poll?.poll_options || [])
            .sort((a, b) => a.sort_order - b.sort_order);

        return pagehead(
            'The Bestie Ballot',
            'Bestie Book Pick',
            'One community. So many good books. Help us choose our next read!'
        ) + `<section class="section">
            <div class="wrap two-col">
                <div class="card">
                    <span class="pill">📖 Current Club Read</span>
                    <div class="book-display" style="margin-top:22px">
                        <div class="book-cover">${escape(settings.featured_book)}</div>
                        <div>
                            <h2>${escape(settings.featured_book)}</h2>
                            <p class="muted">${escape(settings.featured_author)}</p>
                            <p>Our current Bestie Book Pick! Join the discussion with the group on Facebook.</p>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <span class="pill">💗 Public voting</span>
                    <h3 style="margin-top:15px">${poll ? escape(poll.title) : 'Next Bestie Book Pick'}</h3>
                    ${!configured
                        ? `<p class="muted">Voting will appear here after the site is connected to Supabase and the poll is published.</p>`
                        : !poll
                            ? `<p class="muted">Nominations are being prepared. Check back for our next poll!</p>`
                            : `<p>${escape(poll.description || 'Choose your favorite nomination!')}</p>
                               <p class="hint">Vote without creating an account. We verify votes by email to limit duplicates.</p>
                               <form data-action="request-vote">
                                   ${options.map(o => `
                                       <label class="vote-option">
                                           <input type="radio" name="option" value="${escape(o.id)}" required>
                                           <div>
                                               <strong>${escape(o.title)}</strong>
                                               <span>${escape(o.author || '')}</span>
                                           </div>
                                       </label>`).join('')}
                                   ${field('Your email address', 'voteEmail', 'email', '', 'required autocomplete="email"')}
                                   <button class="btn" type="submit">Email My Voting Code ♡</button>
                               </form>
                               <div id="verifyVote" class="hidden" style="margin-top:20px">
                                   <form data-action="verify-vote">
                                       ${field('6-digit code from your email', 'voteCode', 'text', '', 'inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required')}
                                       <button class="btn secondary" type="submit">Confirm My Vote</button>
                                   </form>
                               </div>
                               <p class="hint" style="margin-top:12px">
                                   Voting closes: ${poll.closes_at
                                       ? new Date(poll.closes_at).toLocaleString()
                                       : 'When the admin closes the poll'}.
                               </p>`}
                </div>
            </div>
        </section>`;
    }

    function crown() {
        return pagehead(
            'Monthly Crown HQ',
            'Every page counts. Every bestie matters.',
            'Three teams. One crown. A whole lot of reading.'
        ) + `<section class="section">
            <div class="wrap">
                <div class="two-col">
                    <div class="card">
                        <span class="eyebrow">Current Competition</span>
                        <h2>${escape(season?.name || 'The Next Crown Awaits')}</h2>
                        <p class="muted">${season
                            ? `${date(season.starts_on)} – ${date(season.ends_on)}`
                            : 'The next competition will be announced soon.'}</p>
                        <p>${escape(season?.description || 'Join a team, read your heart out, and celebrate every chapter.')}</p>
                        ${btn(
                            logged() ? 'Open My Dashboard' : 'Bestie Login',
                            '#' + (logged() ? 'dashboard' : 'login')
                        )}
                    </div>
                    <div class="card">
                        <h3>👑 Team Standings</h3>
                        <div id="leaderboard">
                            <p class="muted">${season
                                ? 'Loading scores…'
                                : 'Scores will appear when a competition is active.'}</p>
                        </div>
                    </div>
                </div>
                <div class="card" style="margin-top:22px">
                    <h3>Monthly Crown Rules</h3>
                    <p class="muted">These are the baseline rules. Admins can publish the complete rulebook and configure each competition.</p>
                    <div id="rules">
                        <ul class="rule-list">
                            <li>Up to <strong>1,000 credited pages per member per completion day</strong>.</li>
                            <li>Submit completed books within <strong>72 hours</strong> of completion.</li>
                            <li>Use the qualifying page count for your book (typically its Amazon listing).</li>
                            <li>Only eligible submissions during the active competition count.</li>
                            <li>Duplicates and invalid submissions do not count.</li>
                        </ul>
                        <p class="hint">Audiobooks, rereads, and other exceptions require your final approved rulebook before launch.</p>
                    </div>
                </div>
            </div>
        </section>`;
    }

    function authPage(isAdmin) {
        if (logged()) {
            return pagehead(
                'Welcome Back',
                'You’re already signed in!',
                'Head over to your dashboard.'
            ) + `<section class="section">
                <div class="wrap center">
                    ${btn(
                        admin() ? 'Admin HQ' : 'My Dashboard',
                        '#' + (admin() ? 'admin' : 'dashboard')
                    )}
                </div>
            </section>`;
        }

        return pagehead(
            isAdmin ? 'Private Staff Access' : 'Hey, Bestie! ',
            isAdmin ? 'Admin Login' : 'Bestie Login',
            isAdmin
                ? 'Authorized Books & Besties administrators only.'
                : 'Log your reads, check your team, and see how many pages you’ve earned.'
        ) + `<section class="section slim">
            <div class="wrap">
                <div class="card form-card">
                    <form data-action="login" data-admin="${isAdmin}">
                        ${field('Email address', 'loginEmail', 'email', '', 'required autocomplete="email"')}
                        ${field('Your 6-digit PIN', 'loginPin', 'password', '', 'required inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" autocomplete="current-password"')}
                        <button class="btn" style="width:100%">
                            ${isAdmin ? 'Enter Admin HQ' : 'Enter Bestie HQ'} →
                        </button>
                    </form>
                    <div class="divider"></div>
                    <p class="center tiny">
                        ${isAdmin ? 'Admin accounts are invitation-only.' : 'New around here?'}
                        ${isAdmin ? '' : `<a href="#register">Create a Bestie account</a> · `}
                        <a href="#reset-pin">Forgot your PIN?</a>
                    </p>
                    <p class="hint">PINs are private. Admins may be asked for an additional email verification code.</p>
                </div>
            </div>
        </section>`;
    }

    function register() {
        if (logged()) return dashboard();

        return pagehead(
            'Become a Bestie',
            'Your next chapter starts here.',
            'Create your account, verify your email, and wait for admin approval to participate in Monthly Crown.'
        ) + `<section class="section slim">
            <div class="wrap">
                <div class="card form-card">
                    <form data-action="register">
                        ${field('Display name', 'regName', 'text', '', 'required maxlength="70"')}
                        ${field('Email address', 'regEmail', 'email', '', 'required autocomplete="email"')}
                        ${field('Choose a 6-digit PIN', 'regPin', 'password', '', 'required pattern="[0-9]{6}" inputmode="numeric" minlength="6" maxlength="6" autocomplete="new-password"')}
                        ${field('Confirm your PIN', 'regPin2', 'password', '', 'required pattern="[0-9]{6}" inputmode="numeric" minlength="6" maxlength="6"')}
                        <button class="btn" style="width:100%">Create My Account ♡</button>
                    </form>
                    <p class="hint" style="margin-top:14px">Use a PIN you don't use elsewhere. Your account must be approved and assigned to a team before logging books.</p>
                </div>
            </div>
        </section>`;
    }

    function resetPin() {
        return pagehead(
            'Account Recovery',
            'Reset Your PIN',
            'We’ll send a secure recovery link to your account email.'
        ) + `<section class="section slim">
            <div class="wrap">
                <div class="card form-card">
                    <form data-action="reset-request">
                        ${field('Account email', 'resetEmail', 'email', '', 'required')}
                        <button class="btn">Send Reset Link</button>
                    </form>
                    <div class="divider"></div>
                    <form data-action="reset-update">
                        ${field('New PIN (after opening your recovery link)', 'newPin', 'password', '', 'pattern="[0-9]{6}" minlength="6" maxlength="6" inputmode="numeric" required')}
                        <button class="btn outline">Save New PIN</button>
                    </form>
                    <p class="hint">For your security, the new PIN form only works after you open the recovery email link.</p>
                </div>
            </div>
        </section>`;
    }

    function dashboard(preview = false) {
        if (!logged() && !preview) return authPage(false);

        const name = preview ? 'Bestie' : escape(profile?.display_name || 'Bestie');
        const approved = preview || profile?.status === 'approved';
        const team = preview ? 'The Ghoulfriends' : '—';

        const logForm = preview
            ? `<div class="locker-preview-form">
                <p>✨ This is a design preview. Sign in once the database is connected to submit real reading logs.</p>
                <div class="locker-demo-fields">
                    <span>📖 Book title</span>
                    <span>✍️ Author</span>
                    <span>📄 Pages</span>
                    <span>📅 Date completed</span>
                </div>
                <a class="locker-button" href="#login">Sign in to log books ↗</a>
            </div>`
            : !approved
                ? `<p class="muted">Book logging unlocks after an admin approves your account and assigns your team.</p>`
                : !season
                    ? `<p class="muted">No active Monthly Crown competition yet. Check back when your admins open a season!</p>`
                    : `<form data-action="log-book" class="locker-form">
                        ${field('Book title', 'logTitle', 'text', '', 'required maxlength="200"')}
                        ${field('Author', 'logAuthor', 'text', '', 'required maxlength="160"')}
                        ${field('Pages (qualifying edition)', 'logPages', 'number', '', 'required min="1" max="10000"')}
                        ${field('Date completed', 'logDate', 'date', today(), 'required')}
                        ${field('Rating (optional)', 'logRating', 'number', '', 'min="1" max="5" step="0.5"')}
                        <button class="locker-button" type="submit">♡ Add to My Reading Registry</button>
                        <p class="hint">Eligible submissions are credited automatically under the competition rules.</p>
                    </form>`;

        return `<div class="locker-page">
            <section class="locker-mast">
                <div class="locker-mast-inner">
                    <span class="locker-tag">🎀 BESTIE UNIVERSITY · STUDENT PORTAL</span>
                    <h1>MY BESTIE <em>LOCKER</em></h1>
                    <p>Heyyy, ${name}! ♡ Your books, your team, your crown-worthy reading era.</p>
                    <div class="locker-mast-links">
                        <a href="#crown">👑 Crown Commons</a>
                        <a href="#book-pick">📚 Campus Library</a>
                        <a href="#home">🏫 Campus Quad</a>
                    </div>
                </div>
            </section>

            <main class="locker-shell">
                ${preview ? `<div class="locker-notice"><strong>👀 DESIGN PREVIEW</strong> These stats and the student ID are examples, not real member data. <a href="#login">Bestie Login →</a></div>` : ''}
                ${!preview && !approved ? `<div class="locker-notice"><strong>💌 Pending campus admission:</strong> An admin must approve your account and assign your Monthly Crown team before you can log competition books.</div>` : ''}

                <div class="locker-top-grid">
                    <section class="locker-id" aria-label="Bestie student ID">
                        <div class="locker-id-header">
                            <span>✦ B&B UNIVERSITY ✦</span>
                            <span>🎓 CAMPUS ID</span>
                        </div>
                        <div class="locker-id-body">
                            <div class="locker-avatar" aria-hidden="true">💗</div>
                            <div class="locker-id-details">
                                <small>OFFICIAL BESTIE</small>
                                <h2>${name}</h2>
                                <p>READ · CONNECT · BELONG</p>
                                <span class="locker-status">
                                    ${preview ? '✨ CAMPUS PREVIEW' : approved ? '✓ ENROLLED BESTIE' : '⌛ AWAITING APPROVAL'}
                                </span>
                            </div>
                        </div>
                        <div class="locker-id-bottom">
                            <span>📚 BOOKISH DEPARTMENT</span>
                            <span>EST. 2026 ♡</span>
                        </div>
                    </section>

                    <section class="locker-team">
                        <span class="locker-label">🏠 CAMPUS HOUSING</span>
                        <div class="locker-crest">👻</div>
                        <small>YOUR MONTHLY CROWN RESIDENCE</small>
                        <h2 id="myTeam">${team}</h2>
                        <p>Every page helps your house chase the crown!</p>
                        <a href="#crown" class="locker-mini-link">View Campus Standings ↗</a>
                    </section>
                </div>

                <div class="locker-stat-grid">
                    <div class="locker-stat">
                        <span>📖</span><small>BOOKS LOGGED</small>
                        <strong id="myBooks">${preview ? '6' : '0'}</strong>
                        <em>Keep turning pages!</em>
                    </div>
                    <div class="locker-stat">
                        <span>💖</span><small>CREDITED PAGES</small>
                        <strong id="myPages">${preview ? '2,845' : '0'}</strong>
                        <em>Every page counts</em>
                    </div>
                    <div class="locker-stat">
                        <span>👑</span><small>CURRENT CROWN</small>
                        <strong>${season ? escape(season.name) : 'Coming Soon'}</strong>
                        <em>Campus competition</em>
                    </div>
                </div>

                <div class="locker-main-grid">
                    <section class="locker-card locker-log">
                        <div class="locker-card-title">
                            <span>✎ THE READING REGISTRY</span><span>💌</span>
                        </div>
                        <div class="locker-card-inner">
                            <h2>Log Your Latest Read! ♡</h2>
                            <p>Finished a book? Add it to your campus reading record.</p>
                            ${logForm}
                        </div>
                    </section>

                    <section class="locker-card locker-history">
                        <div class="locker-card-title">
                            <span>📚 MY BOOKSHELF</span><span>🎀</span>
                        </div>
                        <div class="locker-card-inner">
                            <h2>Reading History</h2>
                            <p>Your completed chapters, all in one cute little corner.</p>
                            <div id="myHistory">
                                ${preview
                                    ? `<div class="locker-sample-book">
                                        <span>📕</span>
                                        <div><strong>Sample reading entry</strong><small>Demo only · No books submitted</small></div>
                                        <span>♡</span>
                                    </div>`
                                    : '<p class="muted">Loading your books…</p>'}
                            </div>
                        </div>
                    </section>
                </div>

                <section class="locker-bottom">
                    <div>
                        <span>✦ CAMPUS REMINDER ✦</span>
                        <h2>Same books. Brighter days. Bigger besties. ♡</h2>
                        <p>Check the campus bulletin, vote for the next Bestie Book Pick, and keep your reading streak going!</p>
                    </div>
                    <a class="locker-button" href="#book-pick">Visit the Campus Library ↗</a>
                </section>
            </main>
        </div>`;
    }

    function adminPage() {
        if (!admin()) {
            return pagehead(
                'Private Area',
                'Admins Only',
                'Please sign in with an authorized admin account.'
            ) + `<section class="section"><div class="wrap">
                ${btn('Admin Login', '#admin-login')}
            </div></section>`;
        }

        const tabs = [
            'overview', 'members', 'seasons', 'polls', 'site', 'logs',
            ...(owner() ? ['staff'] : [])
        ];

        return pagehead(
            'Private Admin HQ',
            'The Bestie Control Room',
            'Manage the club without touching code.'
        ) + `<section class="section slim">
            <div class="wrap">
                <div class="tabs">
                    ${tabs.map(t => `
                        <button data-tab="${t}" class="${adminTab === t ? 'active' : ''}">
                            ${t[0].toUpperCase() + t.slice(1)}
                        </button>`).join('')}
                </div>
                <div id="adminContent">${adminBody()}</div>
            </div>
        </section>`;
    }

    function adminBody() {
        if (adminTab === 'overview') {
            return `<div class="three-col">
                <div class="stat">
                    <small>Current Theme</small>
                    <strong style="font-size:20px">${escape(settings.current_theme)}</strong>
                </div>
                <div class="stat">
                    <small>Current Book Pick</small>
                    <strong style="font-size:20px">${escape(settings.featured_book)}</strong>
                </div>
                <div class="stat">
                    <small>Active Crown</small>
                    <strong style="font-size:20px">${escape(season?.name || 'None')}</strong>
                </div>
            </div>
            <div class="card" style="margin-top:20px">
                <h3>Welcome, ${escape(profile?.display_name || 'Admin')}!</h3>
                <p>Use the tabs above to approve Besties, configure seasons, manage polls, publish monthly themes, and review logs.</p>
                <p class="hint">Your account has the ${escape(profile?.role)} role.</p>
            </div>`;
        }

        if (adminTab === 'members') {
            return `<div class="card">
                <h3>Member Approvals & Team Assignments</h3>
                <p class="muted">Approve accounts and assign a team for the active season.</p>
                <div id="memberAdmin">Loading…</div>
            </div>`;
        }

        if (adminTab === 'seasons') {
            return `<div class="two-col">
                <div class="card">
                    <h3>Create a Competition</h3>
                    <form data-action="create-season">
                        ${field('Competition name', 'seasonName', 'text', '', 'required')}
                        ${field('Start date', 'seasonStart', 'date', '', 'required')}
                        ${field('End date', 'seasonEnd', 'date', '', 'required')}
                        ${field('Team 1 name', 'team1', 'text', '', 'required')}
                        ${field('Team 2 name', 'team2', 'text', '', 'required')}
                        ${field('Team 3 name', 'team3', 'text', '', 'required')}
                        <button class="btn">Create Draft Season</button>
                    </form>
                </div>
                <div class="card">
                    <h3>Manage Competitions</h3>
                    <p class="hint">Only one season can be active at a time. Activate when the teams and dates are ready.</p>
                    <div id="seasonAdmin">Loading…</div>
                </div>
            </div>`;
        }

        if (adminTab === 'polls') {
            return `<div class="two-col">
                <div class="card">
                    <h3>Create a Book Pick Poll</h3>
                    <form data-action="create-poll">
                        ${field('Poll title', 'pollTitle', 'text', 'Next Bestie Book Pick', 'required')}
                        ${field('Voting closes', 'pollClose', 'datetime-local', '', 'required')}
                        <div class="form-row">
                            <label for="pollChoices">Book nominees (one per line: Title | Author)</label>
                            <textarea id="pollChoices" required placeholder="Book One | Author One&#10;Book Two | Author Two"></textarea>
                        </div>
                        <button class="btn">Create Draft Poll</button>
                    </form>
                </div>
                <div class="card">
                    <h3>Poll Management</h3>
                    <div id="pollAdmin">Loading…</div>
                </div>
            </div>`;
        }

        if (adminTab === 'site') {
            return `<div class="card">
                <h3>Seasonal Homepage Manager</h3>
                <p class="muted">Update the public homepage. Colors must be valid hex codes; optional hero image must be an HTTPS URL.</p>
                <p class="hint">📣 Campus announcements are now managed through Communications Studio in Campus HQ.</p>
                <form data-action="save-site">
                    <div class="two-col">
                        ${field('Current theme', 'siteCurrent', 'text', settings.current_theme, 'required')}
                        ${field('Next theme', 'siteNext', 'text', settings.next_theme, 'required')}
                        ${field('Current book pick', 'siteBook', 'text', settings.featured_book, 'required')}
                        ${field('Book author', 'siteAuthor', 'text', settings.featured_author, 'required')}
                        ${field('Accent color', 'siteAccent', 'color', settings.theme_accent)}
                        ${field('Hero background color', 'siteHeroColor', 'color', settings.theme_hero_color)}
                    </div>
                    ${field('Seasonal banner image URL (optional)', 'siteHero', 'url', settings.theme_hero || '')}
                    ${field('Facebook group URL', 'siteFb', 'url', settings.facebook_url || '')}
                    <div class="form-row">
                        <label for="siteAbout">About the group</label>
                        <textarea id="siteAbout">${escape(settings.about_text)}</textarea>
                    </div>
                    <button class="btn">Save & Publish Changes</button>
                </form>
            </div>`;
        }

        if (adminTab === 'logs') {
            return `<div class="card">
                <h3>Reading Log Review</h3>
                <p class="muted">Correct, reject, or restore submissions. The leaderboard recalculates from eligible entries.</p>
                <div id="logAdmin">Loading…</div>
            </div>`;
        }

        if (adminTab === 'staff') {
            return `<div class="card">
                <h3>Admin Invitations</h3>
                <p>Only the owner can invite staff. Each invitation generates a random temporary six-digit PIN sent privately by email; the admin must change it.</p>
                <form data-action="invite-admin">
                    ${field('Admin display name', 'staffName', 'text', '', 'required')}
                    ${field('Admin email', 'staffEmail', 'email', '', 'required')}
                    <button class="btn">Send Admin Invitation</button>
                </form>
                <p class="hint">Configure RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, and SITE_URL in Netlify first. Never share PINs in public code.</p>
                <div id="staffAdmin" style="margin-top:20px"></div>
            </div>`;
        }

        return '';
    }

    async function handleForm(e) {
        e.preventDefault();

        const f = e.currentTarget;
        const action = f.dataset.action;
        const button = f.querySelector('button[type="submit"],button.btn');

        if (button) button.disabled = true;

        try {
            if (action === 'login') {
                if (!db) throw Error('Website is not connected yet. See README setup instructions.');

                const r = await db.auth.signInWithPassword({
                    email: val('loginEmail'),
                    password: val('loginPin')
                });

                if (r.error) throw r.error;

                await loadUser();

                if (f.dataset.admin === 'true' && !admin()) {
                    await db.auth.signOut();
                    session = null;
                    profile = null;
                    throw Error('This account does not have admin access.');
                }

                message('Welcome back! ♡');
                location.hash = admin() ? '#admin' : '#dashboard';
                render();
                await hydrate();

            } else if (action === 'register') {
                if (!db) throw Error('Connect Supabase before registration.');
                if (val('regPin') !== val('regPin2')) throw Error('PINs do not match.');
                if (!/^[0-9]{6}$/.test(val('regPin'))) throw Error('Use exactly six digits.');

                const r = await db.auth.signUp({
                    email: val('regEmail'),
                    password: val('regPin'),
                    options: {
                        data: { display_name: val('regName') },
                        emailRedirectTo: location.origin + location.pathname + '#login'
                    }
                });

                if (r.error) throw r.error;

                message('Check your email to verify your account, then await admin approval.');
                location.hash = '#login';

            } else if (action === 'reset-request') {
                if (!db) throw Error('Connect Supabase first.');

                const r = await db.auth.resetPasswordForEmail(
                    val('resetEmail'),
                    { redirectTo: location.origin + location.pathname + '#reset-pin' }
                );

                if (r.error) throw r.error;
                message('If this email has an account, a recovery link has been sent.');

            } else if (action === 'reset-update') {
                if (!db) throw Error('Connect Supabase first.');
                if (!/^[0-9]{6}$/.test(val('newPin'))) throw Error('Use six digits.');

                const r = await db.auth.updateUser({
                    password: val('newPin')
                });

                if (r.error) throw r.error;

                message('Your PIN has been updated.');
                location.hash = '#dashboard';

            } else if (action === 'log-book') {
                const r = await db.rpc('submit_book', {
                    p_title: val('logTitle'),
                    p_author: val('logAuthor'),
                    p_pages: Number(val('logPages')),
                    p_completed_on: val('logDate'),
                    p_rating: val('logRating') ? Number(val('logRating')) : null
                });

                if (r.error) throw r.error;

                message('Book submitted! Eligible pages updated.');
                render();
                await hydrate();

            } else if (action === 'save-site') {
                const patch = {
                    current_theme: val('siteCurrent'),
                    next_theme: val('siteNext'),
                    featured_book: val('siteBook'),
                    featured_author: val('siteAuthor'),
                    theme_accent: val('siteAccent'),
                    theme_hero_color: val('siteHeroColor'),
                    theme_hero: val('siteHero') || null,
                    facebook_url: val('siteFb'),
                    about_text: val('siteAbout')
                };

                const r = await db.from('site_settings')
                    .update(patch)
                    .eq('id', 1);

                if (r.error) throw r.error;

                settings = { ...settings, ...patch };
                message('Homepage published!');
                render();

            } else if (action === 'create-season') {
                const r = await db.rpc('create_crown_season', {
                    p_name: val('seasonName'),
                    p_starts: val('seasonStart'),
                    p_ends: val('seasonEnd'),
                    p_teams: [val('team1'), val('team2'), val('team3')]
                });

                if (r.error) throw r.error;

                message('Draft competition created.');
                render();
                await hydrate();

            } else if (action === 'create-poll') {
                const choices = val('pollChoices')
                    .split('\n')
                    .map(s => s.split('|').map(x => x.trim()))
                    .filter(a => a[0]);

                if (choices.length < 2) throw Error('Add at least two nominees.');

                const r = await db.rpc('create_book_poll', {
                    p_title: val('pollTitle'),
                    p_closes: val('pollClose'),
                    p_options: choices.map(x => ({
                        title: x[0],
                        author: x[1] || ''
                    }))
                });

                if (r.error) throw r.error;

                message('Draft poll created.');
                render();
                await hydrate();

            } else if (action === 'request-vote') {
                const choice = f.querySelector('input[name="option"]:checked');
                if (!choice) throw Error('Select a book.');

                const r = await fetch('/.netlify/functions/vote-request', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        poll_id: poll.id,
                        option_id: choice.value,
                        email: val('voteEmail')
                    })
                });

                const j = await r.json();
                if (!r.ok) throw Error(j.error || 'Could not send code.');

                window.pendingVote = {
                    email: val('voteEmail'),
                    poll_id: poll.id,
                    option_id: choice.value
                };

                $('#verifyVote').classList.remove('hidden');
                message('Check your inbox for a six-digit code.');

            } else if (action === 'verify-vote') {
                const r = await fetch('/.netlify/functions/vote-confirm', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        ...window.pendingVote,
                        code: val('voteCode')
                    })
                });

                const j = await r.json();
                if (!r.ok) throw Error(j.error || 'Vote could not be verified.');

                message('Your vote has been counted! ♡');
                render();

            } else if (action === 'invite-admin') {
                const r = await secureFunction('admin-invite', {
                    name: val('staffName'),
                    email: val('staffEmail')
                });

                message(r.message || 'Invitation sent.');
                render();
            }

        } catch (err) {
            message(err.message || 'Something went wrong.');
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function secureFunction(name, payload) {
        const s = (await db.auth.getSession()).data.session;
        if (!s) throw Error('Please log in.');

        const r = await fetch('/.netlify/functions/' + name, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: 'Bearer ' + s.access_token
            },
            body: JSON.stringify(payload)
        });

        const j = await r.json();
        if (!r.ok) throw Error(j.error || 'Request failed.');
        return j;
    }

    async function handleClick(e) {
        const b = e.currentTarget;
        const kind = b.dataset.click;

        try {
            if (kind === 'approve') {
                const r = await db.rpc('approve_member', {
                    p_user: b.dataset.id,
                    p_team: ($('#team-' + b.dataset.id)?.value || null)
                });

                if (r.error) throw r.error;
                message('Member approved.');
                await fillAdmin();

            } else if (kind === 'assign') {
                const select = $('#team-' + b.dataset.id);

                const r = await db.rpc('assign_member_team', {
                    p_user: b.dataset.id,
                    p_team: select.value || null
                });

                if (r.error) throw r.error;
                message('Team updated.');
                await fillAdmin();

            } else if (kind === 'season-status') {
                const r = await db.rpc('set_season_status', {
                    p_id: b.dataset.id,
                    p_status: b.dataset.status
                });

                if (r.error) throw r.error;
                message('Competition updated.');
                await loadPublic();
                render();

            } else if (kind === 'poll-status') {
                const r = await db.rpc('set_poll_status', {
                    p_id: b.dataset.id,
                    p_status: b.dataset.status
                });

                if (r.error) throw r.error;
                message('Poll updated.');
                await loadPublic();
                render();

            } else if (kind === 'log-status') {
                const r = await db.rpc('review_book', {
                    p_id: b.dataset.id,
                    p_status: b.dataset.status
                });

                if (r.error) throw r.error;
                message('Submission updated.');
                await fillAdmin();

            } else if (kind === 'staff-remove') {
                if (!confirm('Revoke this administrator’s privileges?')) return;

                const r = await secureFunction('admin-revoke', {
                    user_id: b.dataset.id
                });

                message(r.message);
                await fillAdmin();
            }

        } catch (err) {
            message(err.message || 'Action failed.');
        }
    }

    async function fillDashboard() {
        if (!logged()) return;

        const r = await db.from('book_logs')
            .select('id,title,author,pages,credited_pages,completed_on,status,created_at')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(150);

        logs = r.data || [];

        const current = logs.filter(l => l.status === 'accepted');

        if ($('#myPages')) {
            $('#myPages').textContent = num(
                current.reduce((s, l) => s + Number(l.credited_pages || 0), 0)
            );
        }

        if ($('#myBooks')) {
            $('#myBooks').textContent = num(current.length);
        }

        const t = await db.from('team_memberships')
            .select('teams(name),season_id')
            .eq('user_id', session.user.id)
            .eq('season_id', season?.id || '00000000-0000-0000-0000-000000000000')
            .maybeSingle();

        if ($('#myTeam')) {
            $('#myTeam').textContent = t.data?.teams?.name || 'Unassigned';
        }

        if ($('#myHistory')) {
            $('#myHistory').innerHTML = logs.length
                ? `<div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Book</th>
                                <th>Finished</th>
                                <th>Pages</th>
                                <th>Credited</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(l => `
                                <tr>
                                    <td>
                                        ${escape(l.title)}<br>
                                        <span class="tiny muted">${escape(l.author)}</span>
                                    </td>
                                    <td>${date(l.completed_on)}</td>
                                    <td>${num(l.pages)}</td>
                                    <td>${num(l.credited_pages)}</td>
                                    <td>${escape(l.status)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`
                : '<p class="muted">Your bookshelf is waiting for its first entry.</p>';
        }
    }

    async function fillLeaderboard() {
        if (!season || !$('#leaderboard') || !db) return;

        const r = await db.rpc('public_team_scores', {
            p_season: season.id
        });

        const a = (r.data || []).sort(
            (x, y) => Number(y.total_pages) - Number(x.total_pages)
        );

        const max = Math.max(
            ...a.map(x => Number(x.total_pages)),
            1
        );

        $('#leaderboard').innerHTML = a.length
            ? a.map((t, i) => `
                <div class="leader">
                    <div class="leader-head">
                        <span>${['👑', '🥈', '🥉'][i] || '📚'} ${escape(t.name)}</span>
                        <span>${num(t.total_pages)} pages</span>
                    </div>
                    <div class="track">
                        <div class="fill" style="width:${Math.max(0, Number(t.total_pages) / max * 100)}%;background:${escape(t.color || '#b96e8d')}"></div>
                    </div>
                    <span class="tiny muted">${num(t.books_logged)} books logged</span>
                </div>`).join('')
            : '<p class="muted">No team scores yet.</p>';
    }

    async function fillAdmin() {
        if (!admin() || !db) return;

        if (adminTab === 'members') {
            const r = await db.from('profiles')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(250);

            const m = (r.data || []).filter(x => x.role === 'member');

            const ms = season
                ? await db.from('team_memberships')
                    .select('*')
                    .eq('season_id', season.id)
                : { data: [] };

            $('#memberAdmin').innerHTML = m.length
                ? `<div class="table-scroll">
                    <table>
                        <tr>
                            <th>Bestie</th><th>Status</th>
                            <th>Team</th><th>Action</th>
                        </tr>
                        ${m.map(x => {
                            const existing = (ms.data || [])
                                .find(y => y.user_id === x.id)?.team_id || '';

                            return `<tr>
                                <td>
                                    ${escape(x.display_name)}<br>
                                    <span class="tiny muted">${escape(x.email)}</span>
                                </td>
                                <td>
                                    <span class="tag ${x.status === 'pending' ? 'pending' : ''}">
                                        ${escape(x.status)}
                                    </span>
                                </td>
                                <td>
                                    <select id="team-${x.id}">
                                        <option value="">Unassigned</option>
                                        ${teams.map(t => `
                                            <option value="${t.id}" ${existing === t.id ? 'selected' : ''}>
                                                ${escape(t.name)}
                                            </option>`).join('')}
                                    </select>
                                </td>
                                <td>
                                    ${x.status === 'pending'
                                        ? `<button class="btn small" data-click="approve" data-id="${x.id}">Approve</button>`
                                        : `<button class="btn small outline" data-click="assign" data-id="${x.id}">Save Team</button>`}
                                </td>
                            </tr>`;
                        }).join('')}
                    </table>
                </div>`
                : '<p>No member registrations yet.</p>';
        }

        if (adminTab === 'seasons') {
            const r = await db.from('seasons')
                .select('*')
                .order('created_at', { ascending: false });

            $('#seasonAdmin').innerHTML = (r.data || []).map(s => `
                <div class="leader">
                    <strong>${escape(s.name)}</strong>
                    <p class="tiny muted">${date(s.starts_on)} – ${date(s.ends_on)} · ${escape(s.status)}</p>
                    ${s.status === 'draft'
                        ? `<button class="btn small" data-click="season-status" data-id="${s.id}" data-status="active">Activate</button>`
                        : ''}
                    ${s.status === 'active'
                        ? `<button class="btn small secondary" data-click="season-status" data-id="${s.id}" data-status="closed">Close & Archive</button>`
                        : ''}
                </div>`).join('') || '<p>No competitions yet.</p>';
        }

        if (adminTab === 'polls') {
            const r = await db.from('polls')
                .select('*,poll_options(*)')
                .order('created_at', { ascending: false });

            $('#pollAdmin').innerHTML = (r.data || []).map(p => `
                <div class="leader">
                    <strong>${escape(p.title)}</strong>
                    <p class="tiny muted">
                        ${escape(p.status)} · ${p.poll_options?.length || 0} nominees ·
                        closes ${new Date(p.closes_at).toLocaleString()}
                    </p>
                    ${p.status === 'draft'
                        ? `<button class="btn small" data-click="poll-status" data-id="${p.id}" data-status="open">Publish Poll</button>`
                        : ''}
                    ${p.status === 'open'
                        ? `<button class="btn small secondary" data-click="poll-status" data-id="${p.id}" data-status="closed">Close Poll</button>`
                        : ''}
                    ${p.status === 'closed'
                        ? `<button class="btn small outline" data-click="poll-status" data-id="${p.id}" data-status="revealed">Reveal Results</button>`
                        : ''}
                    <div id="pollresult-${p.id}" class="tiny muted"></div>
                </div>`).join('') || '<p>No polls yet.</p>';

            for (const p of r.data || []) {
                if (p.status === 'revealed') {
                    const z = await db.rpc('admin_poll_results', {
                        p_poll: p.id
                    });

                    const el = $('#pollresult-' + p.id);

                    if (el) {
                        el.textContent = (z.data || [])
                            .map(x => x.title + ': ' + x.vote_count + ' votes')
                            .join(' · ');
                    }
                }
            }
        }

        if (adminTab === 'logs') {
            const r = await db.from('book_logs')
                .select('*,profiles(display_name,email)')
                .order('created_at', { ascending: false })
                .limit(200);

            $('#logAdmin').innerHTML = (r.data || []).length
                ? `<div class="table-scroll">
                    <table>
                        <tr>
                            <th>Bestie</th><th>Book</th><th>Pages</th>
                            <th>Credited</th><th>Status</th><th>Actions</th>
                        </tr>
                        ${r.data.map(x => `
                            <tr>
                                <td>${escape(x.profiles?.display_name)}</td>
                                <td>
                                    ${escape(x.title)}<br>
                                    <span class="tiny muted">${date(x.completed_on)}</span>
                                </td>
                                <td>${num(x.pages)}</td>
                                <td>${num(x.credited_pages)}</td>
                                <td>${escape(x.status)}</td>
                                <td>
                                    <button class="btn small outline" data-click="log-status" data-id="${x.id}" data-status="rejected">Reject</button>
                                    <button class="btn small" data-click="log-status" data-id="${x.id}" data-status="accepted">Restore</button>
                                </td>
                            </tr>`).join('')}
                    </table>
                </div>`
                : '<p>No submissions yet.</p>';
        }

        if (adminTab === 'staff' && owner()) {
            const r = await db.from('profiles')
                .select('*')
                .in('role', ['admin', 'owner'])
                .order('display_name');

            $('#staffAdmin').innerHTML = `<h3>Current Admins</h3>` +
                (r.data || []).map(x => `
                    <div class="leader">
                        <strong>${escape(x.display_name)}</strong>
                        <span class="tag">${escape(x.role)}</span>
                        <p class="tiny muted">${escape(x.email)}</p>
                        ${x.role !== 'owner'
                            ? `<button class="btn small outline" data-click="staff-remove" data-id="${x.id}">Revoke Admin Access</button>`
                            : ''}
                    </div>`).join('');
        }

        $('#adminContent')?.querySelectorAll('[data-click]').forEach(b =>
            b.addEventListener('click', handleClick)
        );
    }

    async function init() {
        document.querySelector('#year').textContent = new Date().getFullYear();

        $('#menuToggle').onclick = () => {
            const n = $('#nav');
            n.classList.toggle('open');
            $('#menuToggle').setAttribute(
                'aria-expanded',
                n.classList.contains('open')
            );
        };

        $('#nav').addEventListener('click', e => {
            if (e.target.closest('a')) {
                $('#nav').classList.remove('open');
            }
        });

        $('#logoutBtn').onclick = async () => {
            if (db) await db.auth.signOut();

            session = null;
            profile = null;
            location.hash = '#home';
            render();
        };

        app.innerHTML = '<div class="loading">Opening the lounge… ♡</div>';

        await Promise.all([loadPublic(), loadUser()]);

        render();
        await hydrate();

        window.addEventListener('hashchange', async () => {
            await loadUser();
            render();
            await hydrate();
        });

        if (db) {
            db.auth.onAuthStateChange(async event => {
                if (event === 'PASSWORD_RECOVERY') {
                    location.hash = '#reset-pin';
                }

                if (event === 'SIGNED_OUT') {
                    session = null;
                    profile = null;
                    render();
                }
            });
        }
    }

    async function hydrate() {
        if (location.hash.startsWith('#crown')) {
            await fillLeaderboard();
        }

        if (location.hash.startsWith('#dashboard')) {
            await fillDashboard();
        }

        if (location.hash.startsWith('#admin')) {
            await fillAdmin();
        }
    }

    init().catch(e => {
        app.innerHTML = '<div class="wrap section">The lounge could not load. Refresh to try again.</div>';
        console.error(e);
    });

})();
