-- 複数ユーザー向け招待: 無期限・ラベル・無効化

alter table public.invite_tokens
  alter column expires_at drop not null;

alter table public.invite_tokens
  add column if not exists label text,
  add column if not exists revoked_at timestamptz;

comment on column public.invite_tokens.expires_at is 'NULL = 無期限';
comment on column public.invite_tokens.label is '管理者用メモ（配信者名など）';
comment on column public.invite_tokens.revoked_at is '設定時は利用不可';

create index if not exists invite_tokens_allowed_email_idx
  on public.invite_tokens (lower(allowed_email))
  where allowed_email is not null;

create index if not exists invite_tokens_active_idx
  on public.invite_tokens (revoked_at, expires_at);
