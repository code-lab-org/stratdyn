# data/

Configuration and login data used by the running server (see `stratdyn.js`).

- **experiment.json** — the study design: `tasks` (each with four design
  options and their upside/downside payoffs), `partners` (the pairing of
  participants), and `assignments` (the sequence of task indices each
  participant sees, so partners are shown differently-labeled but
  structurally matched tasks — index into `tasks` by position).
- **adminCredentials.json** / **userCredentials.json** — login credentials
  used to gate access to the admin dashboard and the participant task flow
  during data collection. Kept as-is for provenance; they are not live
  credentials for any running service. `userCredentials.json` originally
  only listed the last session's 4 participants; it has been extended to
  cover all 52 `control`/`treatment` participants (`user0011`-`user0062`,
  matching `experiment.json`), following the same `userNNNN`/`passNNNN`
  pattern as the existing entries.

### `partners` / `assignments` reconstruction

The server only ever persists the *current* session's `partners` and
`assignments` in this file (they're overwritten each time a new session is
started), so the copy previously committed here only reflected the last
session that was run. `partners` and `assignments` have been reconstructed
to cover every participant across all `control` and `treatment` sessions in
`results/`, by reading each participant's `partner` column and the ordered
sequence of `task` labels from their `task_*.csv` rows and mapping each
label back to its index in the `tasks` array.

One thing to note about this reconstruction:

- **A subset of participants have task index `23` repeated and index `33`
  missing from their sequence.** This is a known data-entry error from when the assignment
  sequences were generated: index `33` was mistakenly entered as `23`. Task index `33` is a distraction task that should have been paired with itself.

### Task structure (`analysis/build_task_summary.py`)

`analysis/build_task_summary.py` reads `experiment.json`'s `tasks` array
and derives one summary row per task index (0-39) — see
[../analysis/README.md](../analysis/README.md) for the full column
definitions.

Its `paired_task_index` column (the task index a partner sees at the same
round) is computed by scanning `assignments`/`partners` for what index
actually accompanies each task index — except for indices 30-39
(distraction tasks 30-35, training tasks 36-39), which are asserted to be
self-paired (`paired_task_index == task_index`) rather than inferred. This
is by design (both partners always see the identical task at these
rounds), confirmed by unanimous 52/52 self-pairing in the data for every
one of these indices *except* 33 — which, per the data-entry error noted
above, is corrupted to always show paired with `23` instead. Trusting the
raw data for index 33 specifically would get it wrong 100% of the time, so
the whole 30-39 range is asserted rather than left to a majority vote.

- **Task index 19 ("Task Illinois")'s highest-upside design has a downside
  payoff that doesn't fit its difficulty tier.** `task_difficulty` is
  assigned purely from `task_index` (`(task_index // 5) + 1`), while which
  design becomes `A`/`B`/`C` is chosen per-task by upside, independent of
  index. Task 19 sits in tier 4, and its designs' downsides at the
  `payoff_magnitude = 1` level should scale up from tier 3's -68 toward
  tier 5's -150, the same way every other tier does — instead, its
  highest-upside design (`Design M`, upside 100) has a downside of exactly
  **-68**, identical to task index 14 ("Task Texas", tier 3)'s
  highest-upside design, rather than a harsher value consistent with tier
  4. This looks like a copy-paste error in the original task payoff table,
  not a data-collection issue like the ones above. Effect: in
  `analysis/risk_dominance_analysis.ipynb`, task 19's computed `u` (design
  `A`'s risk threshold) comes out to 0.702 instead of the ~0.75 every other
  tier-4 task produces — a 0.048 deviation, by far the largest across all
  90 computed `u`/`u_B`/`u_C` values (every other value is within 0.009 of
  its tier's nominal target). `u_B` and `u_C` for task 19 are unaffected
  (~0.75, as expected) since `Design K`/`Design L`'s payoffs for that task
  are unremarkable. Left as-is (not corrected), consistent with how the
  index 33 error above is handled — flagged here rather than silently
  patched, since the actually-intended payoff value isn't recoverable.
