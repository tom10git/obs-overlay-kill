-- Remove Stripe / invite / entitlement billing tables (Twitch OAuth profiles remain)

drop policy if exists entitlements_select_own on public.feature_entitlements;
drop policy if exists stripe_subs_select_own on public.stripe_subscriptions;
drop policy if exists stripe_customers_select_own on public.stripe_customers;

drop table if exists public.feature_entitlements;
drop table if exists public.stripe_subscriptions;
drop table if exists public.stripe_customers;
drop table if exists public.invite_tokens;

comment on column public.profiles.display_name is 'ユーザー登録時に入力（表示名）';
