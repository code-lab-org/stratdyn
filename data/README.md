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
