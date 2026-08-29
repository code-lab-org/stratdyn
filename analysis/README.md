# analysis/

Scripts that turn the raw CSVs in `results/` and `data/experiment.json`
into analysis-ready tables, and notebooks that analyze those tables.

Scripts are self-contained (`python analysis/<script>.py` from the repo
root) and re-derive their output from scratch, so re-run them after any
change to `results/` or `experiment.json`. Notebooks assume they're run
from within `analysis/` (so e.g. `pd.read_csv("survey_data.csv")` resolves)
and should be re-run after regenerating any table they read.

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

## `descriptive_statistics.ipynb`

Notebook (not a script) for statistical analysis of the built tables above.
Currently covers demographic descriptive statistics from `survey_data.csv`
— gender counts, and min/mean/max for age, English proficiency (mapped to
an ordinal 1-5 scale), and social closeness (familiarity with one's
partner) — broken out by `arm` and for the population as a whole.
`demographics-survey-q3` (education) is excluded. See the notebook's own
markdown cells for the specific cleaning decisions (a few `q63`/`q7`
responses are the literal string `"undefined"` and are excluded from the
numeric summaries rather than guessed at).

`task_difficulty` and `payoff_magnitude` together form a 6×5 factorial
design covering all 30 real tasks exactly once: `V_A_CC` cycles through
the same 5 values at every difficulty tier, while the downside values grow
more severe as `task_difficulty` increases.

## `outcome_analysis.ipynb`

Notebook analyzing `task_data.csv`. Each round has one of three outcomes
based on both partners' strategies: **successful collaboration** (`C`/`C`),
**mutual independence** (`I`/`I`), or **coordination failure** (`C`/`I`,
either order). Rounds with a `strategy_1`/`strategy_2` of the literal
string `"undefined"` (a submission that failed to register — see
[../results/README.md](../results/README.md#task_csv--decision-task-rounds))
are dropped before classifying.

- **Descriptive**: outcome frequency (counts and within-arm percentages)
  for `control`, `treatment`, and overall, at the round level.
- **Inferential (pair-level)**: rounds within a pair aren't independent
  (the same two partners produced all ~30 of their rounds together, and
  `arm` is assigned at the pair level), so each pair is first collapsed to
  its own outcome rates, giving one independent observation per pair (12
  control, 14 treatment) instead of one per round. A Welch's t-test,
  Mann-Whitney U test, and Cohen's *d* then compare control vs. treatment
  pairs for each outcome. With this small a sample, none of the three
  outcomes reach conventional significance under Welch's t-test, though
  Mann-Whitney shows a trend for successful collaboration and coordination
  failure (p ≈ 0.06-0.07, moderate effect sizes).
- **Inferential (round-level, basic model)**: a mixed logistic model
  (`successful_collaboration ~ arm`, random intercept per pair, fit via
  `statsmodels`' `BinomialBayesMixedGLM`) is fit to use all 778 rounds
  directly. **Its reported standard error for `arm` is not trustworthy** —
  `arm` is a pair-level covariate, constant within each pair's ~30 rounds,
  and the mean-field variational approximation `fit_vb()` uses is known to
  underestimate posterior uncertainty for exactly this kind of
  higher-level covariate. The notebook demonstrates this by cross-checking
  against GEE with cluster-robust standard errors (clustered on pair),
  which agrees with the pair-level test (not significant, same direction)
  rather than the mixed model's implausibly tiny SE. Use the pair-level
  test or GEE for the `arm` effect; the mixed model's random-intercept
  variance is still a legitimate estimate of between-pair heterogeneity,
  and the same approach becomes trustworthy for the `arm` effect too once
  round-level covariates (e.g. `task_difficulty`, `payoff_magnitude`) are
  added, since those vary within a pair and don't share this confound.
- **Inferential (round-level, with task difficulty)**: joins in each
  round's task difficulty from `task_summary.csv` (via `task_1`/`task_2`)
  as two derived, round-varying covariates — `max_difficulty` (the harder
  of the two partners' tasks) and `diff_difficulty` (how mismatched their
  difficulties are) — and fits
  `successful_collaboration ~ arm + max_difficulty_c + diff_difficulty_c + arm:diff_difficulty_c`
  (mean-centered so `arm`'s main effect is interpretable at a typical
  task, rather than extrapolating to `diff_difficulty = 0`, which never
  occurs in this data). Since these covariates vary within a pair, GEE and
  the mixed model agree throughout — unlike the `arm`-only model above.
  `max_difficulty_c` is a robust, strongly significant predictor (GEE
  p < 0.001; harder tasks reduce successful collaboration). The
  `arm:diff_difficulty_c` interaction is also significant (GEE p ≈ 0.02):
  control's success rate declines as the partners' task difficulties
  diverge, while treatment's stays roughly flat — the treatment appears to
  specifically buffer against difficulty asymmetry between partners,
  rather than uniformly raising the collaboration rate. `arm`'s main
  effect (at a typical task) remains non-significant, consistent with the
  basic model.
- **Robustness check (excluding robot non-adopters)**: 2 of the 14
  treatment pairs never used the robot at all (see
  `robot_use_analysis.ipynb`). Re-running the pair-level test and both GEE
  models after excluding those 2 pairs leaves the basic `arm` effect
  essentially unchanged (one dropped pair was low-performing, the other a
  perfect performer — they roughly cancel), but the
  `arm:diff_difficulty_c` interaction gets substantially stronger (GEE p
  0.021 → 0.0002). One excluded pair (`user0031`/`user0032`) shows a
  clean control-like decline with `diff_difficulty` despite being assigned
  to treatment — consistent with getting none of the buffering effect
  since they never engaged with the tool. **This is a post-hoc,
  per-protocol-style check, not a causal estimate** — robot use wasn't
  randomly assigned, so a properly-adjusted "effect among compliers" would
  need an instrumental-variable / CACE approach; reported as a robustness
  signal alongside the main results, not a replacement for them.

## `efficiency_analysis.ipynb`

A numeric counterpart to `outcome_analysis.ipynb`: instead of a 3-category
outcome, each round is scored by efficiency
`E = (V_1 * V_2) / (V_1_max * V_2_max)`, where `V_1`/`V_2` are the round's
realized `score_1`/`score_2` and `V_1_max`/`V_2_max` are each partner's own
best-possible score that round — the larger of `V_A_CC` and `V_Y_IC` for
their assigned task (i.e. the best upside across all four design options,
regardless of what was actually chosen). `E` is not bounded to `[0, 1]`: a
coordination failure gives the mismatched partner a downside payoff, which
is negative for harder tasks, so `E` can go negative too — a real feature
(captures actual welfare loss), not a bug.

As a sanity check, `E` tracks the three `outcome_analysis.ipynb` categories
as expected: high (~0.90) for successful collaboration, modest (~0.19) for
mutual independence, negative (~-0.25) for coordination failure.

Since `E` is continuous, round-level models use `statsmodels`' `MixedLM` —
a proper REML-estimated linear mixed model — instead of the
variational-Bayes `BinomialBayesMixedGLM` that needed the GEE-vs-mixed-model
caveat in `outcome_analysis.ipynb`. `MixedLM` and GEE now agree closely on
every term, confirming that discrepancy was a VB-specific artifact rather
than intrinsic to mixed models with pair-level covariates.

The analysis independently reproduces every conclusion from the
categorical analysis using this different, welfare-weighted measure: no
significant uniform `arm` effect (coef ≈ 0.16, p ≈ 0.18 in both models);
`max_difficulty_c` a robust, strongly significant predictor (p < 0.001);
and a significant `arm:diff_difficulty_c` interaction (MixedLM p = 0.008,
GEE p = 0.018) — treatment's efficiency holds up better than control's
under partner difficulty mismatch, the same buffering pattern as before,
now visible in realized payoff magnitudes rather than just win/loss
classification. The pair-level aggregate test is weaker here (Mann-Whitney
p = 0.12) than its categorical counterpart (p = 0.064) — plausible, since
`E` absorbs extra variance from the *size* of losses, not just win/loss.

Also checks `avg_social_closeness` (each pair's average of both partners'
pre-task "how well do you know your partner" rating, from
`survey_data.csv`) — another pair-level covariate, like `arm`. It shows a
positive coefficient on `E` in both models, but they disagree on
confidence (`MixedLM` p ≈ 0.09, GEE p ≈ 0.02); with only 24 pairs
contributing (2 dropped for missing/`"undefined"` closeness data), this is
reported as a plausible trend, not a confirmed effect. `arm` is unaffected
either way. (A `log_round` covariate was also tried and dropped — no
detectable effect on efficiency, p ≈ 0.9 in both models.)

## `belief_analysis.ipynb`

A third outcome analysis, this time on `collabBelief` (0-100, each
partner's own stated belief that their partner will act collaboratively).
Unlike the categorical outcome or `E`, this is an **individual** measure —
each partner reports their own — so `task_data.csv` is reshaped to one row
per (participant, round) rather than one row per round, carrying along
`arm` and the round's `max_difficulty`/`diff_difficulty` (shared by both
partners, since they depend on both of that round's tasks).

**Important timing caveat**: per `public/index.js`, `collabBelief` is
submitted *before* the robot becomes accessible each round (the robot
button stays disabled until both partners have submitted their belief),
so any `arm` effect below can't reflect the robot mechanically shaping
that round's stated belief. It also displays `"Partner Belief = " +
partnerCollabBelief` in its info modal — a participant's belief is shown
to their partner — so an `arm` effect is at least as plausibly a
strategic/self-presentational reporting effect (specific to treatment,
which has this sharing mechanism and control doesn't) as it is a genuine
shift in private forecasts building up over repeated exposure to the
condition. This dataset can't distinguish those explanations.

With that caveat in mind, this produces the clearest, most robust `arm`
effect anywhere in this analysis — significant at **every** level:
pair-level (Welch p = 0.005, Mann-Whitney p = 0.009, Cohen's *d* = 1.28)
and round-level (`MixedLM` and GEE both coef ≈ 19.8, p = 0.001), unchanged
by adding difficulty covariates. `max_difficulty_c` is negative and
significant (p ≈ 0.002 — harder tasks reduce stated belief in the
partner). `diff_difficulty_c` is positive and significant (p ≈ 0.02) —
belief rises slightly as the partners' difficulties diverge, an
unhypothesized result flagged for further investigation rather than
over-interpreted here.

Read alongside `outcome_analysis.ipynb`/`efficiency_analysis.ipynb`: the
treatment arm reports much higher stated belief throughout, and separately
shows behavioral trends (buffering against difficulty mismatch) that only
reach significance in some specifications — but whether the belief measure
is a genuine psychological mediator of those behaviors, or largely a
reporting artifact of the belief-sharing mechanism, isn't something this
data can settle. Present it as a description of what was reported, not a
validated explanation for the behavioral results.

**Does belief predict the participant's own strategy choice?** A second
model on the same reshaped data: `chose_C ~ collabBelief_c + arm +
max_difficulty_c + diff_difficulty_c`. Unlike the robot-timing issue above,
this direction is temporally valid — the design table is blocked until
`collabBelief` is submitted, so belief precedes that round's choice. Fit
with GEE and `BinomialBayesMixedGLM` as in `outcome_analysis.ipynb`.
`collabBelief_c` is a strong, robust predictor in both (coef ≈ 0.040,
p < 0.001 in both — the two agree closely since it varies within pair and
within person round-to-round), and `max_difficulty_c` is negative and
significant in both. `arm` is **not significant in GEE** (p ≈ 0.96) once
belief and difficulty are controlled — the mixed model's large `arm`
coefficient here is the same pair-level-covariate VB artifact as
elsewhere; trust GEE. So `arm` has no additional association with strategy
choice beyond what a participant's own stated belief and task difficulty
already capture — participants act consistently with what they report,
regardless of what's driving that report.

All three possible `arm` interactions with this model were tested before
settling on a final specification: `collabBelief_c:arm` was a weak,
inconsistent trend (GEE p = 0.076, but the mixed model showed almost
nothing — 0.004 vs GEE's 0.025) and `max_difficulty_c:arm` wasn't close to
significant in either model (they didn't even agree on its sign). Only
`diff_difficulty_c:arm` was real — significant and consistent in both (GEE
p = 0.020, mixed model corroborates) — so it's the only one added, for a
more parsimonious final model. In control, `diff_difficulty_c` pulls
(non-significantly) away from `C` as the partners' difficulties diverge;
in treatment that slope flips positive. This is a **third** independent
confirmation of the same buffering pattern found for the categorical
outcome and for efficiency — now shown to hold even at the level of
individual strategy choice, after controlling for the person's own stated
belief, so it isn't just an artifact of belief itself differing by arm.

**Does the partner's belief predict a participant's own choice?** A
participant's belief can only reach their partner via the robot's info
modal (`"Partner Belief = " + partnerCollabBelief`), a treatment-only
mechanism — so `partner_belief_c` is interacted with `arm` rather than
added as a main effect, expecting it to matter only where that channel
exists. `chose_C ~ collabBelief_c + partner_belief_c * arm +
max_difficulty_c + diff_difficulty_c + arm:diff_difficulty_c` confirms
exactly that: `partner_belief_c` alone (the control-arm slope) is not
significant (GEE p = 0.152, as expected with no sharing mechanism), while
`partner_belief_c:arm` is significant (GEE p = 0.004, mixed model
corroborates) — an effective treatment-arm slope (≈ 0.043) comparable in
size to a participant's own belief. A clean internal-consistency check:
the one arm with a plausible channel for partner belief to matter is the
one where it does. It can't confirm a participant saw their partner's
belief any *specific* round, though — only that they were in the arm where
it was possible.

## `risk_dominance_analysis.ipynb`

Visualizes successful collaboration rate against a game-theoretic risk
measure, using `task_summary.csv` and `task_data.csv`. For a task, `u` is
the normalized deviation loss — the minimum belief a partner will
collaborate needed to make collaborating the better choice — computed from
design `A`'s (the collaborative option with the largest upside) and design
`Y`'s (individual) payoffs:
`u = (V_Y^II - V_A^CI) / ((V_Y^II - V_A^CI) + (V_A^CC - V_Y^IC))`. For a
round, `R` is the average log-odds of the two partners' task-level `u`
(higher `R` means the individual strategy is more risk-dominant that
round). `u` is only meaningful for the 30 real tasks (not the 6 distraction
tasks, which lack the collaborative-dilemma payoff structure the formula
assumes), and is nearly constant across `payoff_magnitude` within each
`task_difficulty` tier — confirming the reference-design assumption that
the non-`A` collaborative designs were held similar, subject to rounding.

Since `u` is effectively a function of `task_difficulty` alone, `R` is
mostly determined by the unordered pair of difficulty tiers involved (15
of up to 21 possible combinations occur), but `u` varies slightly *within*
a tier depending on `payoff_magnitude` (rounding in the underlying
payoffs) — so a few raw `R` values sit close enough together to be the
same signal blurred by that noise, not a meaningfully different `R`. To
average over this, `R` is grouped into 10 equal-width bins (plotted at
each bin's actual mean `R`), with a 95% CI per point (normal approximation
to the binomial — a rough sense of spread, not rigorous, since it treats
rounds as independent, which they aren't — see `outcome_analysis.ipynb`).

The plot has three panels, one per outcome (successful collaboration,
mutual independence, coordination failure), each by arm. All three show
the direction risk-dominance theory predicts: as `R` rises, successful
collaboration falls and mutual independence rises in both arms (coordination
failure is noisier, no clean trend). Control's successful-collaboration
rate declines more steeply than treatment's, which stays comparatively
high and flat — visually consistent with the `arm:diff_difficulty`
interaction found in `outcome_analysis.ipynb` — and the mutual-independence
panel shows the complementary pattern: control's lost collaboration mostly
becomes mutual independence rather than coordination failure.

## `robot_use_analysis.ipynb`

Exploratory analysis of `usedRobot` — exclusive to the treatment arm (28
users, 14 pairs) — from `task_data.csv`.

- **Per-user / per-pair descriptives**: robot use is highly heterogeneous
  — 10 of 28 users never use it, 2 use it every round. The two partners'
  individual rates within a pair are only moderately correlated (r ≈ 0.41),
  so it's not a fully shared "pair culture."
- **Over the 30 rounds**: use starts high (~70% round 1) and declines
  steadily (Pearson r = -0.67, p < 0.001) — a novelty/trust-calibration
  pattern, not escalation. A median split on pair-level use shows both
  groups declining at a similar rate; the above-median group simply starts
  and stays higher throughout rather than following a different trajectory.
- **Does a failed round trigger robot use next round?** A naive round-level
  test says yes emphatically (p < 0.0001), but that ignores clustering by
  pair. Refit with GEE (clustered on pair) and a mixed model, controlling
  for the declining `round` trend: `round` remains strongly significant
  (GEE p = 0.002) but the reactive effect (`prev_bad`) is **not significant**
  once properly clustered (GEE p = 0.11) — directionally consistent, but
  underpowered to confirm with only 14 pairs. A real open question, not a
  settled result.

## `belief_manipulation_analysis.ipynb`

Looks for evidence, within the treatment arm only, of participants
exploiting the belief-sharing mechanism documented in
`belief_analysis.ipynb` — reporting a `collabBelief` high enough to
encourage their partner to collaborate, then choosing `I` themselves
anyway. This is a viable exploit specifically because `V_Y` doesn't depend
on the partner's choice, so it's never costly to the person doing it.

Rather than an arbitrary threshold, reuses each task's `u` (the risk-
dominance threshold from `risk_dominance_analysis.ipynb`) as the natural
cutoff: `belief_favors_C` = the participant's own `collabBelief >= 100 *
u_own` (their own task's payoffs implied collaborating was the rational
bet). `inconsistent_exploit` = `belief_favors_C` but the participant chose
`I` anyway. Uses `u_own` (the participant's own task), not the round's
paired `R`, since `R` mixes in the partner's task difficulty, which the
participant reporting the belief can't act on for their own payoff
calculation.

- **Base rates** (n = 840 participant-round observations): 81.0% of rounds
  had `belief_favors_C`; of those, 7.9% (54) were followed by `I` anyway
  (`inconsistent_exploit`). For contrast, the reverse pattern
  (`inconsistent_generous` — belief favored `I`, participant chose `C`
  anyway) is far more common relative to its opportunity: 51.2% (82 of
  160) — participants default toward collaborating more than their own
  stated belief implies, the opposite of a manipulative pattern.
- **Individual flagging**: for each of the 28 treatment participants, an
  exact one-sided binomial test compares their `inconsistent_exploit` rate
  (among their own `belief_favors_C` rounds) against a leave-one-out
  population baseline, with FDR correction across the 28 tests. Three
  participants survive correction: `user0031` (14/30, 46.7%), `user0042`
  (10/25, 40.0%), `user0048` (8/16, 50.0%). Two more are elevated but don't
  survive correction (`user0049` 4/12, `user0050` 4/13, p_adj ≈ 0.07 each).
  18 of the 28 participants show zero inconsistent rounds.
- **Corroboration**: a participant's `inconsistent_exploit` rate correlates
  strongly with their pair's overall success rate (Pearson r = -0.888,
  p < 0.001) — partly definitional (an `I` choice can't be part of a `C`/`C`
  round), but the three flagged participants' *identities* line up, using
  entirely different data, with pairs already flagged elsewhere: `user0031`
  is from `user0031_user0032`, the `outcome_analysis.ipynb` robustness-check
  pair that behaved like control despite treatment assignment and is one of
  only two treatment pairs with 0% robot use; `user0042` and `user0048` are
  from `user0041_user0042` and `user0047_user0048`, the treatment arm's
  highest (100%) and third-highest (73.3%) robot-use pairs, both among its
  three lowest success rates.
- **Caveats**: this flags patterns consistent with manipulation, not
  intent — `u_own` assumes a stylized expected-value-maximizing model, the
  binomial test treats a participant's own rounds as independent (likely
  understating true variability if the behavior is serially correlated),
  and per-participant power varies a lot (7-30 favorable rounds). Best read
  as a data-driven shortlist for closer qualitative review, not a final
  determination of who manipulated whom.
