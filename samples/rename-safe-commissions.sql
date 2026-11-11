-- Rename-safe referral commissions (excerpt, cleaned).
-- Commission is computed from the code text stored on each order, and an order can carry
-- more than one code ("CODE_A, CODE_B"). Renaming a code used to orphan its history.
-- This trigger rewrites the token on every affected order, preserving order and the other codes.

create or replace function trg_referral_code_rename() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if upper(trim(new.code)) is distinct from upper(trim(old.code)) then
    update orders o
       set referral_code = (
         select string_agg(case when upper(t) = upper(trim(old.code)) then upper(trim(new.code)) else t end,
                           ', ' order by ord)
           from regexp_split_to_table(trim(o.referral_code), '[\s,;|]+') with ordinality x(t, ord)
          where t <> '')
     where upper(trim(old.code)) = any(regexp_split_to_array(upper(coalesce(o.referral_code, '')), '[\s,;|]+'));
  end if;
  return new;
end $$;

revoke all on function trg_referral_code_rename() from public, anon, authenticated;

create trigger trg_referral_codes_rename
after update of code on referral_codes
for each row execute function trg_referral_code_rename();

-- Proof (rolled back): rename a high-volume code and confirm the creator's owed balance is unchanged,
-- multi-code orders keep their other code, and no order still carries the old name.
