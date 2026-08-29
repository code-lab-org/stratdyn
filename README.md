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
