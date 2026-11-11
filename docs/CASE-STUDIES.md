# Case studies

Five real production problems, how I found them, and how I fixed them.

## 1. The monitor that cried wolf every weekend

**Symptom.** A health alert fired every 10 minutes for days, and the owner learned to ignore it.

**Diagnosis.** Two different watchers decided whether an agent was "dead". One knew that the outreach desk does not run on weekends; the other used a flat 2x-interval rule and called a normal Friday-to-Monday gap an outage. A third, real alert (two bounced customer emails) was buried under the noise.

**Fix.** Made one view the single source of truth for agent liveness, and pointed every other watcher at it. Added a self-expiring `paused_until` window so planned downtime reads as "paused on purpose" and automatically turns back into an alarm if nobody resumes the agent. Tested with a rollback: paused desks read OK, the same desks with an expired pause read STALE.

**Result.** Health went from permanently red to green, and the remaining alert was a real customer problem that got handled.

## 2. Commission that vanished on a rename

**Symptom.** A creator's balance was a few dollars short.

**Diagnosis.** Commission is computed from the code text stored on each order. A code had been renamed, so an old order still carried the old text and matched nobody.

**Fix.** Retagged the order, then fixed the source: a trigger rewrites every order's code text when a code is renamed, including orders that used two codes. Proved it by renaming a high-volume code inside a rolled-back transaction and confirming the owed balance did not move.

## 3. Use counts that doubled

**Symptom.** One code showed 22 uses against 11 paid orders.

**Diagnosis.** Both the pay function and a database trigger incremented the counter. The double count had been fixed going forward months earlier, but history was never repaired.

**Fix.** Recounted every code from paid orders, split multi-code orders correctly, and corrected only the codes that disagreed.

## 4. The weekly report that was always half empty

**Symptom.** "Top products" and "cover stock" were blank in every Monday owner email.

**Diagnosis.** Reading the API gateway logs showed the job asked the database for a `quantity` column (the real one is `qty`) and a column that never existed. Both reads failed with 400s, and the email quietly rendered "no data".

**Fix.** Corrected the two reads, made units sum quantities, and verified the deployed function differs from the old one only on those lines.

## 5. A color list that lived in eleven places

**Symptom.** The owner renamed the vinyl color list and dropped one color.

**Diagnosis.** The palette was defined in the storefront, quote builder, shop page, product page generator, admin hub, two databases and several edge functions.

**Fix.** Backed up both catalogs, renamed labels everywhere while keeping internal keys stable (so past orders still render), applied the full 16-color list to every decal in both catalogs, regenerated 183 product pages and the merchant feed, and verified at phone width that every picker shows exactly the new list.
