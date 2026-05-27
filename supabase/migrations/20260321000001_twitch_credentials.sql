-- Twitch トークンはクライアントから直接読めない（Edge Function + service role のみ）

create table public.user_twitch_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_twitch_credentials enable row level security;

-- ポリシーなし = authenticated / anon は SELECT 不可（Edge Function のみ）
