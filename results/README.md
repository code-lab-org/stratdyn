# Results data dictionary

Each session produces four CSV files, named `{type}_{arm}_{N}.csv`:

- `type` is `demographics`, `presurvey`, `postsurvey`, or `task`.
- `arm` is `control` or `treatment`.
- `N` is the two-digit, zero-padded session number within that arm. Sessions
  are numbered in the order they were run; `control` has sessions 01-06 and
  `treatment` has sessions 01-07.
- Rows are appended live as participants interact with the app (see
  `stratdyn.js`), so a session's files can be joined on `username` and
  `timestamp`.

Usernames (e.g. `user0059`) are anonymized participant IDs assigned before
the session and are consistent across all four files within a session, and
between a participant and their partner's rows.

## `task_*.csv` — decision-task rounds

One row per decision submitted by a participant during the design-task
sequence.

| Column | Description |
|---|---|
| `timestamp` | Unix ms timestamp when the decision was submitted |
| `username` | Anonymized participant ID |
| `partner` | Anonymized ID of the participant's partner for this round |
| `task` | Task label (e.g. `Training Task 1`, `Task Washington`); definitions and payoffs are in `data/experiment.json` |
| `design` | The design option chosen (`Design K`, `L`, `M`, or `Y`). Recorded with a non-breaking space (U+00A0) between "Design" and the letter rather than a regular space — `stratdyn.js` strips that character from the copy it uses for scoring but not from the copy it logs, so the raw value never string-matches the plain-space labels used everywhere else (e.g. `data/experiment.json`). `analysis/build_task_datatable.py` normalizes this |
| `strategy` | Self-reported strategy behind the choice: `collaborative` or `individual`. `Design Y` is the fixed-payoff (50/50) option associated with an individual strategy; `Design K`/`L`/`M` are the variable-payoff options associated with a collaborative strategy |
| `collabBelief` | Participant's stated belief (0-100) that their partner will act collaboratively this round |
| `usedRobot` | Whether the participant consulted the AI recommendation ("robot") before deciding |
| `score` | Points earned this round. Computed from the participant's and partner's chosen designs: the upside payoff is awarded if both designs are in the collaborative set (K/L/M), the downside payoff if a design is in the collaborative set but the pairing doesn't fully align, and so on — see the `submit-decision` handler in `stratdyn.js` for the exact payoff matrix. `null` until the partner has also submitted a decision for the round |
| `partnerScore` | Points earned by the partner this round, using the same logic |

**Two rows per round, one per partner.** Each design-task round produces
two rows sharing the same unordered `{username, partner}` pair, in
submission order: the row submitted *first* always has `score` and
`partnerScore` recorded as the literal string `null`, since neither
partner's score can be computed until both have decided. The row submitted
*second* carries the real values — its own `score` and its partner's
`partnerScore` — computed from **both** partners' choices at that point.
`analysis/build_task_datatable.py` merges each such pair of rows into one
per-round record.

Occasionally (8 rounds out of 1040 in this repo) *both* rows end up with
`score`/`partnerScore` still `null`, because one partner's design failed to
register that round (`design` is empty and `strategy` is the literal string
`undefined` — see e.g. `user0014` in `task_control_01.csv`, round 4).
When a design doesn't match any of that task's options, the server's
scoring logic (`submit-decision` in `stratdyn.js`) never assigns a score to
either partner. There's no way to recover a real score for these rounds;
`analysis/build_task_datatable.py` leaves `score_1`/`score_2` blank for
them rather than guessing.

Every pair's first 4 rounds are `Training Task 1`-`4` (indices 36-39 in
`data/experiment.json`'s `tasks` array) — a practice sequence run before the
40 real tasks that make up the study design. `analysis/build_task_datatable.py`
excludes these from its output entirely and renumbers `round` to count only
the remaining real tasks.

`analysis/build_task_datatable.py` also excludes six "distraction" tasks —
`Task Idoha`, `Task Florida`, `Task Utah`, `Task Massachusetts`,
`Task  Montana`, `Task  Mississippi` (indices 30-35) — which didn't have the
payoff dynamic the study is actually about, and replaces `task_1`/`task_2`
with the task's index into `data/experiment.json`'s `tasks` array instead
of its label, leaving 30 possible task indices (0-29) and 30 rounds per
pair (780 rows total) in `analysis/task_data.csv`.

## `presurvey_*.csv` and `postsurvey_*.csv`

One row per participant, submitted before and after the design-task
sequence respectively. Each item is answered on a 0-100 slider from
"Definitely Disagree" (0) to "Definitely Agree" (100). Question text is
taken verbatim from `public/index.html`.

Column names encode the underlying construct and item number: `t` = Trust,
`r` = Risk, `c` = Control (locus of control), each with 3 items (`1`-`3`).
The same 9 underlying items appear in both surveys, reworded in the past
tense for the post-survey and presented in a different on-screen order.

**Fixed data quality issue:** `presurvey_*.csv` previously had a stray extra
field in every row. The server's write handler (`stratdyn.js`,
`submit-survey`) had a doubled comma between the `q5t1` and `q6r1` values,
so every data row had 12 comma-separated fields against the 11-column
header. The write handler has been fixed, and the
historical `presurvey_*.csv` files in this repo have been corrected in
place (the stray field removed, remaining values re-aligned to the header)
— they no longer need any special handling to read correctly.

| Column | Description |
|---|---|
| `timestamp` | Unix ms timestamp when the survey was submitted |
| `username` | Anonymized participant ID |

**Pre-survey items:**

| Column | Question text |
|---|---|
| `q1t2` | I trust I can maximize my overall experiment score by choosing individual design option. |
| `q2r3` | I think choosing collaboration during the experiment is a takeable risk. |
| `q3c1` | The score I will receive in the experiment will be determined by my own decisions and efforts. |
| `q4r2` | I perceive choosing collaborative design options in the experiment has higher risk than choosing individual design options. |
| `q5t1` | I believe that choosing collaborative options during experiment is trustworthy. |
| `q6r1` | I think choosing collaborative design options puts my goal of maximizing my total score in the experiment at risk. |
| `q7c3` | I believe my partner's decisions will determine the score that I will receive from the experiment. |
| `q8t3` | I will trust the information my partner provides while making a decision. |
| `q9c2` | I believe I will have enough influence to collaborate successfully with my partner. |

**Post-survey items** (same 9 constructs, past tense):

| Column | Question text |
|---|---|
| `q1c2` | I believe I had enough influence over achieving a successful collaboration with my partner. |
| `q2r1` | I think choosing collaborative design options put my goal of maximizing my total score in the experiment at risk. |
| `q3t3` | I did not trust the information my partner provides while making a decision. |
| `q4r2` | I perceive choosing collaborative design options in the experiment had higher risk than choosing individual design options. |
| `q5t1` | I believe that choosing collaborative options during experiment was trustworthy. |
| `q6c3` | I believe my partner's decisions determined the score that I will receive from the experiment. |
| `q7t2` | I trust that I maximized my overall experiment score by choosing individual design option. |
| `q8c1` | The score I received in the experiment determined by my own decisions and efforts. |
| `q9r3` | I think choosing collaboration during the experiment was a takeable risk. |

## `demographics_*.csv`

One row per participant. Question text and response options are taken
verbatim from `public/index.html`.

`demographics_control_04.csv` has one duplicate submission (`user0038`
appears twice, ~100 seconds apart, with identical answers) — a double
form-submit rather than two different responses. Keep the first row and
drop the second when using this file; `analysis/build_survey_datatable.py`
does this automatically.

| Column | Question | Response |
|---|---|---|
| `demographics-survey-q1` | What is your gender? | `Female` / `Male` / `Other` / `Rather-not-say` |
| `demographics-survey-q2` | How old are you (as of today, in years)? | free-text number |
| `demographics-survey-q3` | How many years of college-level (undergraduate and graduate) education have you completed in a technical field (STEM)? | free-text number |
| `demographics-survey-q4` | How many years of professional experience do you have in a technical field (STEM)? | free-text number. **Known data quality issue — affects all sessions in this repo:** the client-side form handler (`public/index.js`, submit handler for `#demographics-survey-form`) read the `#demographics-survey-q3` input for this field instead of `#demographics-survey-q4`, so in every CSV collected to date this column actually duplicates the `q3` (years of STEM education) answer rather than capturing years of professional experience. Fixed in `public/index.js` (commit that added this note); the fix only takes effect for sessions run after the fix, not the historical data in this repo |
| `demographics-survey-q5` | What is your native language? | free-text. Same bug as `q4` above applied here too — every CSV collected to date duplicates the `q3` answer instead of capturing native language. Also fixed in `public/index.js` going forward |
| `demographics-survey-q63` | What is your level of English proficiency? | `Fluent/Native` / `High` (TOEFL > 95 or IELTS > 7) / `Medium-High` (TOEFL 85-94 or IELTS 6.5-7) / `Medium-Low` (TOEFL 60-84 or IELTS 6) / `Low` (TOEFL < 60 or IELTS < 6). This is the on-screen question 6 (`name="demographics-survey-q6"` in the HTML); the server logs it under the column name `q63`, not `q6` — kept as recorded |
| `demographics-survey-q7` | How well do you know your selected partner in the experiment? ("1" meaning do not know at all – "5" meaning very closely know) | `1` first-time meeting / `2` seen, met a few times / `3` meet/see occasionally / `4` friend, meet regularly / `5` relative, partner, very close friend |
