# analysis/

Scripts that turn the raw CSVs in `results/` and `data/experiment.json`
into analysis-ready tables. Each script is self-contained (`python
analysis/<script>.py` from the repo root) and re-derives its output from
scratch, so re-run them after any change to `results/` or `experiment.json`.

## `build_survey_datatable.py` → `survey_data.csv`

One row per participant (52 rows), merging `demographics_*.csv`,
`presurvey_*.csv`, and `postsurvey_*.csv`.

| Column | Description |
|---|---|
| `username` | Anonymized participant ID (primary key) |
| `arm` | `control` or `treatment` |
| `session` | Two-digit session number within `arm` |
| `demographics_timestamp`, `demographics-survey-q1` ... `q7`, `q63` | See [../results/README.md](../results/README.md#demographics_csv) |
| `presurvey_timestamp`, `presurvey_q1t2` ... `presurvey_q9c2` | Pre-survey items, prefixed to avoid colliding with postsurvey's `q4r2`/`q5t1` |
| `postsurvey_timestamp`, `postsurvey_q1c2` ... `postsurvey_q9r3` | Post-survey items, same prefixing |

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
| `design_1`, `design_2` | Each partner's chosen design (`Design K`/`L`/`M`/`Y`) |
| `strategy_1`, `strategy_2` | Each partner's self-reported strategy (`collaborative`/`individual`, or `undefined` if their submission failed to register that round) |
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

## `build_task_variables.py` → `task_variables.csv`

One row per real task round per pair (780 rows), keyed identically to
`task_data.csv` (`arm`, `session`, `round`, `username_1`/`_2`,
`task_1`/`_2`), adding the derived variables defined in Section 4.1 of
the accompanying paper. Per-partner values are suffixed `_1`/`_2`; for
`N_ij`, `N_12` is partner 1's view of partner 2's belief and `N_21` the
reverse. Payoffs come from `data/experiment.json` (the same values
summarized in `task_summary.csv`), and every recorded score is
cross-checked against the payoff implied by both partners' designs.

| Column | Description |
|---|---|
| `u_1`, `u_2` | Normalized deviation loss (Eq. 1): `(V_Y_II - V_X_CI) / ((V_Y_II - V_X_CI) + (V_X_CC - V_Y_IC))` for the selected collaborative design `X`, or the mean over all three collaborative designs if `Design Y` was selected |
| `R` | Risk dominance (Eq. 3): `0.5*ln(u_1/(1-u_1)) + 0.5*ln(u_2/(1-u_2))` |
| `delta_u` | Risk threshold asymmetry: `|u_1 - u_2|` |
| `P_1`, `P_2` | Reported collaboration belief (0-100), i.e. `collabBelief_1`/`_2` |
| `N_1`, `N_2` | Collaborative intention: `P_i - 100*u_i` |
| `N_12`, `N_21` | Partner collaborative intention: `P_j - 100*u_i` |
| `S_1`, `S_2` | Strategy inferred from the selected design: `C` (`Design K`/`L`/`M`) or `I` (`Design Y`) |
| `V_1`, `V_2` | Realized payoff, i.e. `score_1`/`_2` |
| `O` | Joint outcome: `S` (successful collaboration, both `C`), `I` (mutual independence, both `I`), or `F` (coordination failure, `S_1 != S_2`) |
| `E` | Payoff efficiency (Eq. 6): `0.5*(V_1 - V_1,Y_II)/(V_1,A_CC - V_1,Y_II) + 0.5*(V_2 - V_2,Y_II)/(V_2,A_CC - V_2,Y_II)`, each partner normalized by their own task's payoffs |

Values are blank where their inputs are missing. In the two control rounds
where one partner's design failed to register, that partner has no
`u`/`N`/`S`, neither partner has `V`, and `R`, `delta_u`, `O`, and `E`
are blank. The other partner's `u`/`N` are still reported. The paper's
Table 3 excludes them, which is reproduced by keeping only rows with a
non-blank `R`.

## `analysis.ipynb`

Analysis results computed from the tables above. Run it from this
directory. Needs `pandas`, `statsmodels`, `scipy`, `matplotlib`, and a Jupyter
kernel (`ipykernel`).

- **Summary of Experimental Data**: n, mean, and SE by arm (control,
  treatment, overall) for demographic factors, derived task attributes,
  individual observations, and paired observations, plus demographic
  balance tests between arms
- **Categorical Outcomes**: binomial GEE models (exchangeable working
  correlation, cluster-robust SEs on pair) of mutual independence and
  coordination failure, each against successful collaboration, on `T`,
  centered `R` and `delta_u`, and `T × delta_u`
- **Payoff Efficiency**: Gaussian GEE model of `E` with the same
  covariates, working correlation, and clustering, and a plot of predicted
  `E` against `delta_u` by arm (needs `matplotlib`)
- **Collaboration Beliefs**: Gaussian GEE model of each participant's
  reported belief `P_i` on `T` and their own and partner's centered
  normalized deviation loss (`u_i`, `u_j`)
- **Collaborative Strategies**: chain of binomial GEE models of `S_i = C`
  (M1 structural; M2 adds `P_i`; M3 adds `P_j`), fit with a
  `params_niter=20` warm start because the fully iterated fit diverges
  for M3
- **Mixed-Effects Robustness Checks**: linear mixed-effects models with a
  random intercept per pair for the efficiency, belief, and strategy models,
  alongside their GEE estimates
- **Strategy Overrides**: counts of upgrades (`N_i <= 0`, `S_i = C`) and
  downgrades (`N_i > 0`, `S_i = I`) by sign of `N_ij` and arm, and binomial
  GEE models of each override direction on `T`, centered `N_ij`, and
  `T × N_ij`
- **Manipulative Behavior**: per-participant under- and over-cooperation
  scores (treatment only), each tested against all other treatment
  participants with a one-sided leave-one-out Mann-Whitney U test and
  Benjamini-Hochberg FDR correction (needs `scipy`), and a random-intercept
  mixed-model check flagging the same participants
