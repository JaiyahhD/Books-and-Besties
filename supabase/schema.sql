-- Books & Besties HQ — Run in Supabase SQL Editor on a NEW project.
-- IMPORTANT: Replace owner UUID using bootstrap_owner.sql AFTER registering your account.
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text not null,display_name text not null default 'Bestie',role text not null default 'member' check(role in('member','admin','owner')),status text not null default 'pending' check(status in('pending','approved','suspended')),created_at timestamptz not null default now());
create table public.site_settings(id integer primary key default 1 check(id=1),current_theme text not null default 'Boo & Boujee',next_theme text not null default 'The Velvet Latte Lounge',featured_book text not null default 'Misery',featured_author text not null default 'Stephen King',theme_accent text not null default '#b96e8d',theme_hero_color text not null default '#f4e3e9',theme_hero text,facebook_url text not null default '',about_text text not null default 'Books & Besties is a welcoming community of readers who connect through books, group conversations, monthly reads, and friendly reading competitions.',announcement text not null default 'Welcome to Books & Besties! Read • Connect • Belong.');
insert into public.site_settings(id) values(1);
create table public.seasons(id uuid primary key default gen_random_uuid(),name text not null,description text,starts_on date not null,ends_on date not null,status text not null default 'draft' check(status in('draft','active','closed')),created_at timestamptz not null default now(),check(ends_on>=starts_on));
create unique index only_one_active_season on public.seasons(status) where status='active';
create table public.teams(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id) on delete cascade,name text not null,color text not null default '#b96e8d',unique(season_id,name),unique(id,season_id));
create table public.team_memberships(user_id uuid not null references public.profiles(id) on delete cascade,season_id uuid not null references public.seasons(id) on delete cascade,team_id uuid not null,primary key(user_id,season_id),foreign key(team_id,season_id) references public.teams(id,season_id));
create table public.book_logs(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,season_id uuid not null references public.seasons(id),team_id uuid not null references public.teams(id),title text not null,author text not null,pages integer not null check(pages between 1 and 10000),credited_pages integer not null default 0 check(credited_pages>=0),completed_on date not null,rating numeric(2,1) check(rating between 1 and 5),status text not null default 'accepted' check(status in('accepted','rejected')),created_at timestamptz not null default now());
create index logs_user_date on public.book_logs(user_id,completed_on);create index logs_season_team on public.book_logs(season_id,team_id,status);
create table public.polls(id uuid primary key default gen_random_uuid(),title text not null,description text,closes_at timestamptz not null,status text not null default 'draft' check(status in('draft','open','closed','revealed')),created_at timestamptz not null default now());
create unique index one_open_poll on public.polls(status) where status='open';
create table public.poll_options(id uuid primary key default gen_random_uuid(),poll_id uuid not null references public.polls(id) on delete cascade,title text not null,author text,sort_order integer not null default 0,unique(id,poll_id));
-- Sensitive voting tables are ONLY accessed by service role from Netlify functions.
create table public.vote_codes(id uuid primary key default gen_random_uuid(),poll_id uuid not null references public.polls(id) on delete cascade,option_id uuid not null references public.poll_options(id),email_hash text not null,code_hash text not null,expires_at timestamptz not null,attempts integer not null default 0,created_at timestamptz not null default now());
create table public.votes(id uuid primary key default gen_random_uuid(),poll_id uuid not null references public.polls(id) on delete cascade,option_id uuid not null references public.poll_options(id),email_hash text not null,created_at timestamptz not null default now(),unique(poll_id,email_hash));
create view public.team_scores with(security_invoker=true) as select t.id,t.season_id,t.name,t.color,coalesce(sum(l.credited_pages),0)::bigint total_pages,count(l.id)::bigint books_logged from public.teams t left join public.book_logs l on l.team_id=t.id and l.status='accepted' group by t.id;
create view public.poll_results with(security_invoker=true) as select o.poll_id,o.id option_id,o.title,o.author,count(v.id)::bigint vote_count from public.poll_options o left join public.votes v on v.option_id=o.id group by o.id;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=(select auth.uid()) and role in('admin','owner') and status='approved')$$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=(select auth.uid()) and role='owner' and status='approved')$$;
create or replace function public.on_new_user() returns trigger language plpgsql security definer set search_path='' as $$begin insert into public.profiles(id,email,display_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'display_name','Bestie'),70));return new;end$$;
create trigger create_profile after insert on auth.users for each row execute function public.on_new_user();
-- Read policies; all writes to sensitive tables go through SECURITY DEFINER RPCs.
alter table public.profiles enable row level security;alter table public.site_settings enable row level security;alter table public.seasons enable row level security;alter table public.teams enable row level security;alter table public.team_memberships enable row level security;alter table public.book_logs enable row level security;alter table public.polls enable row level security;alter table public.poll_options enable row level security;alter table public.vote_codes enable row level security;alter table public.votes enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_admin());
create policy settings_read on public.site_settings for select to anon,authenticated using(true);
create policy settings_write on public.site_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy seasons_read on public.seasons for select to anon,authenticated using(status<>'draft' or public.is_admin());
create policy teams_read on public.teams for select to anon,authenticated using(exists(select 1 from public.seasons s where s.id=season_id and (s.status<>'draft' or public.is_admin())));
create policy memberships_read on public.team_memberships for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy logs_read on public.book_logs for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy polls_read on public.polls for select to anon,authenticated using(status<>'draft' or public.is_admin());
create policy options_read on public.poll_options for select to anon,authenticated using(exists(select 1 from public.polls p where p.id=poll_id and (p.status<>'draft' or public.is_admin())));
create policy votes_admin_read on public.votes for select to authenticated using(public.is_admin());
-- Poll results only available to admins or after reveal. Revoke direct view access from public.
revoke all on public.poll_results from anon,authenticated;
grant select on public.team_scores to anon,authenticated;
create or replace function public.recalculate_day(p_user uuid,p_date date,p_season uuid) returns void language plpgsql security definer set search_path='' as $$
declare r record; remaining integer:=1000;begin
 for r in select id,pages,status from public.book_logs where user_id=p_user and completed_on=p_date and season_id=p_season order by created_at,id for update loop
  update public.book_logs set credited_pages=case when r.status='accepted' then least(r.pages,remaining) else 0 end where id=r.id;
  if r.status='accepted' then remaining:=greatest(0,remaining-r.pages);end if;
 end loop;
end$$;
revoke all on function public.recalculate_day(uuid,date,uuid) from public,anon,authenticated;
create or replace function public.submit_book(p_title text,p_author text,p_pages integer,p_completed_on date,p_rating numeric default null) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.seasons%rowtype; t uuid; new_id uuid; p public.profiles%rowtype;begin
 select * into p from public.profiles where id=auth.uid();if p.id is null or p.status<>'approved' then raise exception 'Account must be approved';end if;
 select * into s from public.seasons where status='active';if s.id is null then raise exception 'No active competition';end if;
 if current_date<s.starts_on or current_date>s.ends_on then raise exception 'Competition is not currently accepting logs';end if;
 if p_completed_on<s.starts_on or p_completed_on>s.ends_on or p_completed_on>current_date or now()>((p_completed_on + 1)::timestamp at time zone 'America/Chicago') + interval '72 hours' then raise exception 'Completion date outside competition or 72-hour logging window';end if;
 if length(trim(coalesce(p_title,'')))<2 or length(trim(coalesce(p_author,'')))<2 or p_pages not between 1 and 10000 then raise exception 'Invalid book details';end if;
 if p_rating is not null and (p_rating<1 or p_rating>5) then raise exception 'Invalid rating';end if;
 select team_id into t from public.team_memberships where user_id=auth.uid() and season_id=s.id;
 if t is null then raise exception 'Admin must assign your team';end if;
 -- Prevent straightforward duplicate title/date entries.
 if exists(select 1 from public.book_logs where user_id=auth.uid() and season_id=s.id and completed_on=p_completed_on and lower(trim(title))=lower(trim(p_title)) and status='accepted') then raise exception 'This book was already submitted for that date';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_completed_on::text||s.id::text));
 insert into public.book_logs(user_id,season_id,team_id,title,author,pages,completed_on,rating) values(auth.uid(),s.id,t,trim(p_title),trim(p_author),p_pages,p_completed_on,p_rating) returning id into new_id;
 perform public.recalculate_day(auth.uid(),p_completed_on,s.id);return new_id;
end$$;
-- The completion-day 72-hour cutoff uses the end of the completion date in America/Chicago; adjust to your final rulebook before launch.
create or replace function public.approve_member(p_user uuid,p_team uuid default null) returns void language plpgsql security definer set search_path='' as $$declare s uuid;begin
 if not public.is_admin() then raise exception 'Not authorized';end if;
 update public.profiles set status='approved' where id=p_user and role='member';if not found then raise exception 'Member not found';end if;
 select id into s from public.seasons where status='active';if p_team is not null then
 if s is null or not exists(select 1 from public.teams where id=p_team and season_id=s) then raise exception 'Invalid team';end if;
 insert into public.team_memberships(user_id,season_id,team_id) values(p_user,s,p_team) on conflict(user_id,season_id) do update set team_id=excluded.team_id;end if;end$$;
create or replace function public.assign_member_team(p_user uuid,p_team uuid) returns void language plpgsql security definer set search_path='' as $$declare s uuid;begin
 if not public.is_admin() then raise exception 'Not authorized';end if;select id into s from public.seasons where status='active';if s is null then raise exception 'No active season';end if;
 if p_team is null then delete from public.team_memberships where user_id=p_user and season_id=s;return;end if;
 if not exists(select 1 from public.teams where id=p_team and season_id=s) then raise exception 'Invalid team';end if;
 insert into public.team_memberships(user_id,season_id,team_id) values(p_user,s,p_team) on conflict(user_id,season_id) do update set team_id=excluded.team_id;
 -- Existing accepted logs stay with their original team; admins should assign teams before submissions.
end$$;
create or replace function public.create_crown_season(p_name text,p_starts date,p_ends date,p_teams text[]) returns uuid language plpgsql security definer set search_path='' as $$declare s uuid;i integer;colors text[]:=array['#b96e8d','#8ba9a3','#a58ab6'];begin
 if not public.is_admin() then raise exception 'Not authorized';end if;
 if length(trim(p_name))<2 or p_starts>p_ends or array_length(p_teams,1)<>3 then raise exception 'Enter a name, valid dates, and exactly three teams';end if;
 insert into public.seasons(name,starts_on,ends_on) values(trim(p_name),p_starts,p_ends) returning id into s;
 for i in 1..3 loop insert into public.teams(season_id,name,color) values(s,trim(p_teams[i]),colors[i]);end loop;return s;end$$;
create or replace function public.set_season_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$begin if not public.is_admin() then raise exception 'Not authorized';end if;if p_status not in('active','closed') then raise exception 'Invalid status';end if;update public.seasons set status=p_status where id=p_id and status in('draft','active');if not found then raise exception 'Season not found or already closed';end if;end$$;
create or replace function public.create_book_poll(p_title text,p_closes timestamp,p_options jsonb) returns uuid language plpgsql security definer set search_path='' as $$declare id uuid;o jsonb;i integer:=0;begin
 if not public.is_admin() then raise exception 'Not authorized';end if;
 if jsonb_array_length(p_options)<2 or jsonb_array_length(p_options)>20 or length(trim(p_title))<2 or p_closes<now() then raise exception 'Invalid poll details';end if;
 insert into public.polls(title,closes_at) values(trim(p_title),p_closes at time zone 'America/Chicago') returning polls.id into id;
 for o in select * from jsonb_array_elements(p_options) loop i:=i+1;insert into public.poll_options(poll_id,title,author,sort_order) values(id,left(trim(o->>'title'),200),left(trim(coalesce(o->>'author','')),160),i);end loop;return id;end$$;
create or replace function public.set_poll_status(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$begin if not public.is_admin() then raise exception 'Not authorized';end if;
 if p_status not in('open','closed','revealed') then raise exception 'Invalid status';end if;
 update public.polls set status=p_status where id=p_id and ((status='draft' and p_status='open') or (status='open' and p_status='closed') or (status='closed' and p_status='revealed'));if not found then raise exception 'Invalid poll transition';end if;end$$;
create or replace function public.review_book(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$declare l public.book_logs%rowtype;begin
 if not public.is_admin() then raise exception 'Not authorized';end if;if p_status not in('accepted','rejected') then raise exception 'Invalid status';end if;
 select * into l from public.book_logs where id=p_id for update;if l.id is null then raise exception 'Book not found';end if;
 perform pg_advisory_xact_lock(hashtext(l.user_id::text||l.completed_on::text||l.season_id::text));
 update public.book_logs set status=p_status where id=p_id;perform public.recalculate_day(l.user_id,l.completed_on,l.season_id);end$$;
-- Public score view needs access to accepted logs without exposing individual logs. SECURITY DEFINER RPC returns aggregated scores.
revoke all on public.team_scores from anon,authenticated;
create or replace function public.public_team_scores(p_season uuid) returns table(id uuid,name text,color text,total_pages bigint,books_logged bigint) language sql stable security definer set search_path='' as $$select t.id,t.name,t.color,coalesce(sum(l.credited_pages),0)::bigint,count(l.id)::bigint from public.teams t join public.seasons s on s.id=t.season_id left join public.book_logs l on l.team_id=t.id and l.status='accepted' where t.season_id=p_season and s.status<>'draft' group by t.id$$;
grant execute on function public.public_team_scores(uuid) to anon,authenticated;
grant execute on function public.submit_book(text,text,integer,date,numeric),public.approve_member(uuid,uuid),public.assign_member_team(uuid,uuid),public.create_crown_season(text,date,date,text[]),public.set_season_status(uuid,text),public.create_book_poll(text,timestamp,jsonb),public.set_poll_status(uuid,text),public.review_book(uuid,text) to authenticated;
-- Postgres default execute permissions are PUBLIC; revoke explicitly from anonymous visitors.
revoke execute on function public.submit_book(text,text,integer,date,numeric),public.approve_member(uuid,uuid),public.assign_member_team(uuid,uuid),public.create_crown_season(text,date,date,text[]),public.set_season_status(uuid,text),public.create_book_poll(text,timestamp,jsonb),public.set_poll_status(uuid,text),public.review_book(uuid,text) from public,anon;

create or replace function public.admin_poll_results(p_poll uuid) returns table(title text,vote_count bigint) language plpgsql stable security definer set search_path='' as $$begin if not public.is_admin() then raise exception 'Not authorized';end if;return query select o.title,count(v.id)::bigint from public.poll_options o left join public.votes v on v.option_id=o.id where o.poll_id=p_poll group by o.id order by count(v.id) desc;end$$;
revoke execute on function public.admin_poll_results(uuid) from public,anon;grant execute on function public.admin_poll_results(uuid) to authenticated;
-- Service-role-only atomic public vote confirmation.
create or replace function public.confirm_public_vote(p_code_id uuid,p_option uuid,p_hash text,p_code_hash text) returns void language plpgsql security definer set search_path='' as $$
declare c public.vote_codes%rowtype; p public.polls%rowtype;begin
 select * into c from public.vote_codes where id=p_code_id for update;
 if c.id is null or c.email_hash<>p_hash or c.option_id<>p_option or c.code_hash<>p_code_hash or c.expires_at<now() or c.attempts>5 then raise exception 'Invalid or expired voting code';end if;
 select * into p from public.polls where id=c.poll_id for update;
 if p.status<>'open' or p.closes_at<=now() then raise exception 'Poll is closed';end if;
 if not exists(select 1 from public.poll_options where id=p_option and poll_id=p.id) then raise exception 'Invalid option';end if;
 insert into public.votes(poll_id,option_id,email_hash) values(p.id,p_option,p_hash);
 delete from public.vote_codes where id=c.id;
 exception when unique_violation then raise exception 'This email has already voted';
end$$;
revoke all on function public.confirm_public_vote(uuid,uuid,text,text) from public,anon,authenticated;
-- The service_role bypasses RLS and may call this RPC. No browser-accessible grant.
