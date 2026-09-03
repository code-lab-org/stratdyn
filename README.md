# stratdyn

A web application used to run a human-subjects behavioral experiment on
collaborative vs. individual decision-making under risk. Participants are
paired up and repeatedly choose between a set of "designs" for a shared task,
each with different upside/downside payoffs, and can pursue a collaborative
or an individual strategy. The app also supports an optional AI decision aid
("the robot") and mediator information panel that can be shown to
participants during the task.

This repository contains the experiment server/client code and the raw data
collected across control and treatment study sessions. It accompanies a
manuscript reporting the study's results.

## Study flow

Each session is driven by an admin (who advances/returns the shared task
index for all connected participants) and proceeds through the following
screens, in order, for each participant:

1. **Wait screen** — before the session admin starts the study.
2. **Demographics survey**
3. **Pre-task survey**
4. **Design tasks** — a sequence of partnered decision rounds. In each round
   a participant:
   - sees a task with several design options, each with an upside and a
     downside payoff (see `data/experiment.json`),
   - optionally consults the robot recommendation and/or mediator info,
   - picks a design and states whether their strategy was `collaborative`
     or `individual`,
   - reports their belief about the probability their partner will act
     collaboratively (`collabBelief`),
   - receives a score based on their choice and their partner's choice for
     that round (see the payoff logic in `stratdyn.js`, `submit-decision`).
5. **Post-task survey**
6. **Thank you screen**

Decisions and survey responses are appended live to CSV files in `results/`
as participants progress (see [results/README.md](results/README.md) for the
data dictionary).

## Repository layout

```
app.js                  Express app setup (static file serving, middleware)
bin/www                 Server entry point (creates the HTTP server)
stratdyn.js             Core experiment logic: socket.io event handlers,
                         session state machine, and CSV logging
data/
  experiment.json       Task definitions, upside/downside payoffs, and the
                         partner/task assignment for each participant
  adminCredentials.json Login credentials for the session admin
  userCredentials.json  Login credentials for study participants
public/                 Client-side HTML/CSS/JS for the experiment UI
  index.html            The experiment UI (welcome/survey/task/admin screens)
  index.js              Client-side socket.io event handling and UI logic
results/                Collected data, one subfolder per study arm
  control/              Control-group sessions
  treatment/             Treatment-group ("experimental group") sessions
analysis/               Scripts for turning results/ into analysis-ready tables
  build_survey_datatable.py  Merges demographics/presurvey/postsurvey into
                              one per-participant survey_data.csv
  build_task_datatable.py    Merges each task round's two partner rows into
                              one per-round task_data.csv
  build_task_summary.py      Derives one payoff-structure summary row per
                              task index from data/experiment.json
  descriptive_statistics.ipynb  Demographic descriptive statistics
  outcome_analysis.ipynb        Task-round outcome frequency by arm
  efficiency_analysis.ipynb     Numeric efficiency counterpart to the above
  belief_analysis.ipynb         Stated collaboration-belief counterpart
  risk_dominance_analysis.ipynb Success rate vs. risk dominance, by arm
  robot_use_analysis.ipynb      Robot use over time and after failed rounds
  belief_manipulation_analysis.ipynb  Flags participants whose stated
                                       belief and strategy were inconsistent
  outcome_analysis_selected_u.ipynb   Joint outcome model using each
                                       participant's actually-selected
                                       design's risk threshold
```

## Running locally

```
npm install
npm start
```

This starts the server on the port configured in `bin/www` (default 3000).
Participants and the admin log in from `public/index.html` using the
credentials in `data/adminCredentials.json` / `data/userCredentials.json`.
The admin account sees a live dashboard of connected participants and their
in-progress decisions, and uses it to advance the group through the task
sequence.

Each run of the server writes to a fixed set of output filenames, following
the same `{type}_{arm}_{N}.csv` convention as `results/` (currently a
placeholder, `arm`/`00`, near the top of `stratdyn.js`). Update those
filenames for the session about to be run, and move the previous session's
output files into `results/` before starting a new one, so they are not
overwritten.

## Data

Collected survey and task data live under `results/`, organized by study
arm (`control/`, `treatment/`) and then by session number. See
[results/README.md](results/README.md) for a description of each file type
and its columns.

`analysis/build_survey_datatable.py` reads every `demographics_*.csv`,
`presurvey_*.csv`, and `postsurvey_*.csv` under `results/` and merges them
into one row per participant (`analysis/survey_data.csv`), adding `arm` and
`session` columns. Run it with `python analysis/build_survey_datatable.py`
after any change to `results/`.

`analysis/build_task_datatable.py` reads every `task_*.csv` and merges each
round's two per-partner rows into one row per round (`analysis/task_data.csv`),
with each partner's task, design, strategy, collaboration belief, robot
usage, and score in separate `_1`/`_2` columns. The four `Training Task`
rounds every pair starts with, plus six "distraction" tasks that lacked the
study's target payoff dynamic (`Task Idoha`, `Task Florida`, `Task Utah`,
`Task Massachusetts`, `Task Montana`, `Task Mississippi`), are excluded,
leaving 30 rounds per pair; `task_1`/`task_2` hold the task's index into
`data/experiment.json` rather than its label. Run it with
`python analysis/build_task_datatable.py` after any change to `results/`.
See
[results/README.md](results/README.md#task_csv--decision-task-rounds) for
how the two raw rows per round are paired and scored.

`analysis/build_task_summary.py` reads `data/experiment.json`'s `tasks`
array and derives one payoff-structure summary row per task index
(`analysis/task_summary.csv`), including each task's paired task index and
its 6×5 difficulty/payoff-magnitude factorial grouping. See
[analysis/README.md](analysis/README.md) for the full column reference.

## Analysis

`analysis/descriptive_statistics.ipynb` covers demographic descriptive
statistics (gender counts, min/mean/max age, English proficiency, and
social closeness) by study arm and overall, built on
`analysis/survey_data.csv`.

`analysis/outcome_analysis.ipynb` covers task-round outcomes, built on
`analysis/task_data.csv`. Each round is classified as successful
collaboration (`C`/`C`), mutual independence (`I`/`I`), or coordination
failure (`C`/`I`), after dropping rounds with an undefined strategy.
Reports round-level frequency by arm, then — accounting for rounds within
a pair not being independent — aggregates to one outcome-rate observation
per pair (12 control, 14 treatment) and compares arms with a Welch's
t-test, Mann-Whitney U test, and Cohen's *d*. Also fits a round-level mixed
logistic model (random intercept per pair) as a basic starting point for
using all 778 rounds directly, and cross-checks it against GEE — the two
disagree sharply on significance for the `arm` effect, which the notebook
resolves in GEE's favor (see [analysis/README.md](analysis/README.md) for
why). Finally, adds each round's task difficulty (from
`analysis/task_summary.csv`) as covariates and finds a significant
`arm × difficulty-mismatch` interaction: the treatment appears to buffer
against the harm of partners facing mismatched task difficulty, rather
than uniformly raising collaboration. As a robustness check, also
re-fits both models after excluding the 2 treatment pairs that never used
the robot (a post-hoc, non-causal sensitivity check, not a replacement for
the main results) — the difficulty-mismatch interaction gets substantially
stronger, consistent with those pairs getting none of the tool's buffering
effect. The same round-level modeling is then repeated for coordination
failure specifically: task difficulty mismatch significantly raises
coordination failure in control, and the treatment's buffering interaction
— only a trend in the full sample — reaches significance after excluding
the same 2 non-adopter pairs, a fourth independent confirmation of the
buffering pattern found elsewhere in this analysis. Finally, all three
outcomes are compared simultaneously with a multinomial logit
(`NominalGEE`, cluster-robust on pair), which separates two distinct
mechanisms: overall task difficulty drives pairs toward mutual
independence, while difficulty *mismatch* between partners specifically
drives coordination failure — and the treatment's buffering effect against
mismatch turns out to act specifically on coordination failure, reaching
significance in the full sample without needing the non-adopter exclusion.
Also documents (and sensitivity-checks two fixes for) a payoff anomaly in
task index 19, which its own real payoffs reveal to be mislabeled — see
[analysis/README.md](analysis/README.md) for the full results.

`analysis/outcome_analysis_selected_u.ipynb` is a leaner companion
covering only the joint multinomial model, replacing task-assigned
difficulty with `max_u`/`diff_u` — the risk threshold of the specific
design each participant actually selected (falling back to the task's own
threshold for individual choices). This captures real variation task
difficulty misses (29% of collaborative choices don't pick the
highest-upside design) and fixes the task-19 anomaly automatically with no
manual correction, while reproducing the same mechanistic split and
buffering interaction found with task difficulty — reassurance that the
earlier results reflect a real relationship rather than an artifact of the
coarser covariate.

`analysis/efficiency_analysis.ipynb` runs the same style of analysis on a
continuous efficiency measure (`E`, each round's realized payoff relative
to each partner's own best-possible payoff) instead of the 3-category
outcome, and independently reaches the same conclusions — including using
a proper (non-variational-Bayes) linear mixed model, which agrees closely
with GEE on every `arm`/difficulty term, confirming the earlier VB
discrepancy was specific to the binary-outcome model. Also checks a pair's
average pre-task social closeness (positive but inconclusive trend — the
two models disagree on significance, unlike everywhere else in this
notebook) and a `log_round` trend (no detectable effect, dropped).

`analysis/belief_analysis.ipynb` runs a third outcome analysis on
`collabBelief` (each partner's own stated belief their partner will
collaborate) — reshaped to one row per participant per round, since it's
an individual rather than joint measure. `collabBelief` is submitted
*before* the robot is even accessible each round, and the robot's info
modal shows a participant's belief to their partner — so the clearest
`arm` effect anywhere in this analysis (significant at every level) can't
be read as "the tool changes what people believe" via a within-round
mechanism; it's at least as plausibly a reporting/incentive effect specific
to the belief-sharing mechanism as a genuine shift in private forecasts.
See [analysis/README.md](analysis/README.md) for the full caveat. It also
tests whether belief predicts a participant's own strategy choice that
same round (temporally valid, since belief is submitted before the design
choice): a strong, robust predictor, while `arm` itself adds nothing once
belief and difficulty are controlled — except for an `arm:diff_difficulty`
interaction, a third independent confirmation of the buffering pattern
found for the categorical outcome and for efficiency. It also extends the
model with `payoff_magnitude` — which scales a task's stakes while holding
its relative risk fixed — and finds a real, independent risk-aversion
effect: bigger stakes reduce collaboration even at the same relative risk,
an effect that compounds with task difficulty and isn't touched by `arm`.
Finally, since a participant's belief can only reach their partner via the
robot (a treatment-only mechanism), it tests `partner_belief` interacted
with `arm`: not significant in control (no sharing channel exists),
significant in treatment (effect size comparable to a participant's own
belief) — a clean internal-consistency check on the belief-sharing
mechanism, unaffected by adding the magnitude terms.

`analysis/risk_dominance_analysis.ipynb` plots all three outcome rates
(successful collaboration, mutual independence, coordination failure)
against a game-theoretic risk-dominance measure `R` (derived from each
task's payoffs, binned to average out payoff-rounding noise, with 95% CIs),
by arm — visualizing the same pattern found above: both arms' collaboration
rate declines as risk dominance increases, but treatment declines less
steeply than control.

`analysis/robot_use_analysis.ipynb` explores `usedRobot` (treatment-only):
usage is highly heterogeneous across users, declines steadily over the 30
rounds (a novelty/trust-calibration pattern), and a properly-clustered
model finds that decline is real but a hypothesized "uses the robot more
right after a failed round" effect is directionally present but not
statistically confirmed with only 14 pairs. It also asks the reverse
question — does robot use relate to that round's own outcome, compared
across all three outcomes at once with a multinomial GEE — and finds a
naive association with more coordination failure that turns out, once
decomposed into between-pair and within-pair components, to be almost
entirely a between-pair pattern (struggling pairs use the tool more) with
no evidence the tool itself is harmful in the specific round it's used.

`analysis/belief_manipulation_analysis.ipynb` looks for evidence, within
the treatment arm only, of participants exploiting the belief-sharing
mechanism found in `belief_analysis.ipynb`: reporting a `collabBelief`
high enough to imply they'd collaborate, then choosing `I` anyway — viable
because `V_Y` doesn't depend on the partner's choice, so it's never costly
to the person doing it. Uses each task's risk-dominance threshold `u` (from
`risk_dominance_analysis.ipynb`) as a natural, non-arbitrary cutoff for
"belief implied collaborating was rational," then flags individual
participants whose rate of choosing `I` despite that implication is
significantly above the group baseline (exact binomial test, FDR-corrected
across 28 participants). Three participants are flagged; the behavior is
otherwise rare (18 of 28 participants show none at all). Notably, the three
flagged participants' pairs were independently flagged in two earlier
notebooks using unrelated data — as the non-adopter pair that behaved like
control despite treatment assignment, and as the two heaviest-robot-use,
lowest-success pairs — a convergence across three separate measures that is
stronger evidence than any one result alone. See
[analysis/README.md](analysis/README.md) for the full results and caveats.

## Known issues

- The demographics survey's client-side submit handler had a copy-paste bug
  (`public/index.js`) that caused the `q4` and `q5` answers to be recorded as
  duplicates of the `q3` answer in every session collected so far. This has
  been fixed in the code, but the historical CSVs in `results/` still reflect
  the bug — see [results/README.md](results/README.md#demographics_csv)
  for details before using those two columns.
- A subset of participants were assigned task index `23` twice and never saw
  task index `33`, due to a data-entry error (`33` was mistakenly entered as
  `23`) when the assignment sequences were generated. This is reflected in
  both the raw `task_*.csv` files and the reconstructed `assignments` in
  `data/experiment.json` — see [data/README.md](data/README.md) for details.
- Task index 19's highest-upside design has a downside payoff (-68) that
  matches task index 14's instead of scaling up for its own (higher)
  difficulty tier, most likely a copy-paste error in the original task
  payoff table. This makes that one task's computed risk-dominance
  threshold `u` (in `analysis/risk_dominance_analysis.ipynb`) an outlier
  relative to its tier — see [data/README.md](data/README.md) for details.
