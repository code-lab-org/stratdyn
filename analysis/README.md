# analysis/

Scripts that turn the raw CSVs in `results/` and `data/experiment.json`
into analysis-ready tables. Each script is self-contained (`python
analysis/<script>.py` from the repo root) and re-derives its output from
scratch, so re-run them after any change to `results/` or `experiment.json`.

## `build_survey_datatable.py` → `survey_data.csv`

One row per participant (52 rows), merging `demographics_*.csv`,
`presurvey_*.csv`, and `postsurvey_*.csv`.

Columns are renamed from their raw `results/*.csv` names to something
descriptive (see `descriptive_column` in the script); raw names are listed
below for cross-reference with [../results/README.md](../results/README.md).

| Column | Raw name(s) | Description |
|---|---|---|
| `username` | `username` | Anonymized participant ID (primary key) |
| `arm` | *(derived from filename)* | `control` or `treatment` |
| `session` | *(derived from filename)* | Two-digit session number within `arm` |
| `gender` | `demographics-survey-q1` | `Female` / `Male` (no other values in this dataset) |
| `age` | `demographics-survey-q2` | In years |
| `stem_education_years` | `demographics-survey-q3` | Years of college-level STEM education |
| *(dropped)* | `demographics-survey-q4`, `q5` | Intended to capture professional experience / native language, but a client-side bug duplicated `stem_education_years` into both instead — dropped entirely rather than kept as columns that just repeat `stem_education_years`; see [../results/README.md](../results/README.md#demographics_csv) for the raw data |
| `english_proficiency` | `demographics-survey-q63` | `Fluent/Native` / `High` / `Medium-High` / `Medium-Low` / `Low` |
| `social_closeness` | `demographics-survey-q7` | 1 (first-time meeting) to 5 (very close) familiarity with one's partner |
| `presurvey_trust_1..3`, `presurvey_risk_1..3`, `presurvey_control_1..3` | `q1t2` ... `q9c2` | Pre-survey items, renamed from their raw `q<n><construct><item>` codes to `<construct>_<item>` (`t`=trust, `r`=risk, `c`=control) |
| `postsurvey_trust_1..3`, `postsurvey_risk_1..3`, `postsurvey_control_1..3` | `q1c2` ... `q9r3` | Post-survey items, same renaming. Both surveys carry the same 9 constructs in a different on-screen order — `presurvey_trust_2` and `postsurvey_trust_2` are the same construct/item, asked before and after the task sequence |

A duplicate demographics submission (`user0038`) is deduplicated (first
submission kept). See [../results/README.md](../results/README.md) for
survey item text and known data quality notes.

## `build_task_datatable.py` → `task_data.csv`

One row per real task round per pair (780 rows: 26 pairs × 30 rounds),
merging each round's two per-partner rows from `task_*.csv`.

| Column | Description |
|---|---|
| `arm`, `session` | Study arm and session |
| `round` | 1-30, sequential within this pair after exclusions (see below) |
| `username_1`, `username_2` | The pair's two participants; `username_1` is always the alphabetically-lower of the two, consistently across all of that pair's rounds |
| `task_1`, `task_2` | Each partner's task **index** into `data/experiment.json`'s `tasks` array (not its label) |
| `design_1`, `design_2` | Each partner's chosen design, shortened to just its letter (`K`/`L`/`M`/`Y`, from raw `Design K`/`L`/`M`/`Y`) |
| `strategy_1`, `strategy_2` | Each partner's self-reported strategy, shortened to `C` (collaborative) or `I` (individual); left as the literal string `undefined` if their submission failed to register that round |
| `collabBelief_1`, `collabBelief_2` | Each partner's stated belief (0-100) that the other will act collaboratively |
| `usedRobot_1`, `usedRobot_2` | Whether each partner consulted the AI recommendation |
| `score_1`, `score_2` | Each partner's points earned. Blank for 4 rounds where a design failed to register for one partner, breaking the scoring match for both (see [../results/README.md](../results/README.md#task_csv--decision-task-rounds)) |

Excluded from this table: every pair's 4 `Training Task` rounds, and 6
"distraction" tasks (`Task Idoha`, `Florida`, `Utah`, `Massachusetts`,
`Montana`, `Mississippi` — task indices 30-35) that lacked the study's
target payoff dynamic. `round` is renumbered to count only what remains.

## `build_task_summary.py` → `task_summary.csv`

One row per task index (36 rows, 0-35; the four `Training Task` rounds,
indices 36-39, are excluded), describing each task's payoff structure from
`data/experiment.json`. Column names follow the
payoff-matrix notation `V_{tier}^{outcome}` (flattened to `V_TIER_OUTCOME`
for CSV): tier is `A`/`B`/`C` for the three collaborative design options
(`Design K`/`L`/`M`), ranked by upside with `A` largest, or `Y` for the
individual option; outcome is `CC` (both partners collaborative — the
upside), `CI` (this option collaborative, partner individual — the
downside), `IC` (this option individual, partner collaborative — `Y`'s
upside), or `II` (both individual — `Y`'s downside).

| Column | Description |
|---|---|
| `task_index` | 0-35, position in `data/experiment.json`'s `tasks` array |
| `paired_task_index` | The task index a partner is shown at the same round. For real tasks (0-29), derived by majority vote over every occurrence in `assignments`. For distraction tasks (30-35, the only non-real tasks left in this table), asserted as self-paired (`== task_index`) rather than inferred — see [../data/README.md](../data/README.md#task-structure-analysisbuild_task_summarypy) for why (one of these, index 33, is corrupted in the raw assignment data and would otherwise be inferred wrong) |
| `V_A_CC`, `V_A_CI` | Upside/downside of the collaborative option with the **largest** upside |
| `V_B_CC`, `V_B_CI` | Upside/downside of the collaborative option with the **second-largest** upside |
| `V_C_CC`, `V_C_CI` | Upside/downside of the collaborative option with the **smallest** upside |
| `V_Y_IC`, `V_Y_II` | Upside/downside of the individual option (`Design Y`) |
| `task_difficulty` | `1`-`6` for task indices 0-4, 5-9, ..., 25-29 respectively (`n/a` for distraction/training tasks) |
| `payoff_magnitude` | `5`/`4`/`3`/`2`/`1` for `V_A_CC` of `130`/`122`/`114`/`106`/`100` respectively (`n/a` otherwise) |

`task_difficulty` and `payoff_magnitude` together form a 6×5 factorial
design covering all 30 real tasks exactly once: `V_A_CC` cycles through
the same 5 values at every difficulty tier, while the downside values grow
more severe as `task_difficulty` increases.
