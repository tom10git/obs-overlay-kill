-- 同一メールの有効招待を1件に制限（重複登録防止）

-- 既存の重複: 最新の1件だけ残し、他は無効化
with ranked as (
  select
    id,
    row_number() over (
      partition by allowed_email_hash
      order by
        case when redemption_count < max_redemptions then 0 else 1 end,
        created_at desc
    ) as rn
  from public.invite_tokens
  where revoked_at is null
    and allowed_email_hash is not null
)
update public.invite_tokens t
set revoked_at = now()
from ranked r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists invite_tokens_active_email_hash_uidx
  on public.invite_tokens (allowed_email_hash)
  where revoked_at is null and allowed_email_hash is not null;
