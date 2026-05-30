-- 配信者が課金タブで入力する表示名（管理者の招待 label とは別）

alter table public.profiles
  add column if not exists display_name text;

comment on column public.profiles.display_name is 'ユーザー登録時に入力。課金・招待コード適用の前提';
