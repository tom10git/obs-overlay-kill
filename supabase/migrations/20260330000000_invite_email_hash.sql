-- 招待の allowed_email を平文で保持しない（第三者の DB 読取でメール・なりすましを防ぐ）

create extension if not exists pgcrypto;

alter table public.invite_tokens
  add column if not exists allowed_email_hash text;

update public.invite_tokens
set allowed_email_hash = encode(digest(lower(trim(allowed_email)), 'sha256'), 'hex')
where allowed_email is not null
  and trim(allowed_email) <> ''
  and allowed_email_hash is null;

drop index if exists public.invite_tokens_allowed_email_idx;

alter table public.invite_tokens
  drop column if exists allowed_email;

create index if not exists invite_tokens_allowed_email_hash_idx
  on public.invite_tokens (allowed_email_hash)
  where allowed_email_hash is not null;

comment on column public.invite_tokens.allowed_email_hash is 'lower(trim(email)) の SHA-256 hex。照合は invite-redeem（JWT の email）のみ';

-- invite_tokens: クライアント（anon / authenticated）は一切触れない
drop policy if exists invite_tokens_deny_authenticated on public.invite_tokens;
drop policy if exists invite_tokens_deny_anon on public.invite_tokens;

create policy invite_tokens_deny_authenticated on public.invite_tokens
  for all
  to authenticated
  using (false)
  with check (false);

create policy invite_tokens_deny_anon on public.invite_tokens
  for all
  to anon
  using (false)
  with check (false);
