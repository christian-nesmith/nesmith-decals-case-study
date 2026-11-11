-- Pause-aware agent liveness (excerpt, cleaned).
-- Each scheduled agent writes a heartbeat. This view decides whether it is alive using
-- that agent's real schedule, and treats a deliberate, self-expiring pause as healthy.
-- When the pause expires the agent reads STALE again, so a forgotten pause cannot hide an outage.

create or replace view v_agent_liveness as
with expected(component, interval_mins, floor_mins, what) as (
  values ('snap-desk',        10,    0, 'Snap desk, every 10 min'),
         ('email-desk',       30,    0, 'Email desk, every 30 min'),
         ('lead-followup',   720, 2760, 'Lead follow-ups, Mon-Sat (weekend gap is 42h)'),
         ('shipping-sync',   360,    0, 'Label sync, 4x daily')
)
select e.component,
       case
         when coalesce((h.meta->>'paused_until')::timestamptz, '-infinity') > now() then 'OK'
         when h.component is null then 'BLIND'
         when h.last_beat < now() - make_interval(mins => l.limit_mins) then 'STALE'
         else 'OK'
       end as verdict,
       case
         when coalesce((h.meta->>'paused_until')::timestamptz, '-infinity') > now()
           then 'paused on purpose until ' || (h.meta->>'paused_until') || ' | ' || e.what
         else round(extract(epoch from now() - h.last_beat) / 3600.0, 1) || 'h since last beat | ' || e.what
       end as detail
from expected e
left join heartbeats h on h.component = e.component
cross join lateral (
  select greatest(3 * coalesce(h.expected_interval_mins, e.interval_mins), e.floor_mins) as limit_mins
) l;

-- Negative control, run inside a transaction that always rolls back:
-- 1. age every heartbeat by 5 days and set paused_until in the future -> every verdict must be OK
-- 2. move paused_until into the past                                  -> every verdict must be STALE
do $$
declare paused text; expired text;
begin
  update heartbeats set last_beat = now() - interval '5 days',
         meta = meta || '{"paused_until":"2099-01-01T00:00:00Z"}';
  select string_agg(verdict, ',') into paused from v_agent_liveness;
  update heartbeats set meta = meta || '{"paused_until":"2000-01-01T00:00:00Z"}';
  select string_agg(verdict, ',') into expired from v_agent_liveness;
  raise exception 'DRY RUN paused=% expired=%', paused, expired;  -- forces rollback
end $$;
