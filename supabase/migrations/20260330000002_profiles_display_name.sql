-- profiles.display_name（将来の Supabase Auth 連携用・現行 UI では未使用）

alter table public.profiles
  add column if not exists display_name text;

comment on column public.profiles.display_name is 'ユーザー登録時に入力（表示名）';
