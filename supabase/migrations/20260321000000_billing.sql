-- Billing: Stripe subscriptions + user-bound invite tokens

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  twitch_user_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stripe_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.stripe_subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_price_id text not null,
  feature_id text not null check (feature_id in ('probabilities', 'autoReply', 'viewerSettings', 'layoutFine', 'all')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create index stripe_subscriptions_user_id_idx on public.stripe_subscriptions (user_id);

create table public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature_id text not null check (feature_id in ('probabilities', 'autoReply', 'viewerSettings', 'layoutFine', 'all')),
  source text not null check (source in ('stripe', 'invite')),
  stripe_subscription_id text,
  invite_token_id uuid,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index feature_entitlements_user_feature_uidx
  on public.feature_entitlements (user_id, feature_id);

create table public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  feature_id text not null check (feature_id in ('probabilities', 'autoReply', 'viewerSettings', 'layoutFine', 'all')),
  allowed_user_id uuid references public.profiles (id) on delete set null,
  allowed_email text,
  bind_on_first_redeem boolean not null default false,
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz,
  max_redemptions int not null default 1 check (max_redemptions >= 1),
  redemption_count int not null default 0,
  expires_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.feature_entitlements enable row level security;
alter table public.invite_tokens enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);

create policy entitlements_select_own on public.feature_entitlements
  for select using (auth.uid() = user_id);

create policy stripe_subs_select_own on public.stripe_subscriptions
  for select using (auth.uid() = user_id);

create policy stripe_customers_select_own on public.stripe_customers
  for select using (auth.uid() = user_id);

-- invite_tokens: no direct client access (API uses service role)
