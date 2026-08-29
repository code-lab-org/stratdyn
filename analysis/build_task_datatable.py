"""Build a unified per-round task datatable from results/task_*.csv files.

Each design-task round produces two raw rows in task_{arm}_{N}.csv -- one
submitted by each partner. This script pairs those two rows back into a
single record per round, with each partner's task, design, strategy,
stated collaboration belief, robot usage, and score in separate columns,
and writes the result to task_data.csv in this directory. The four
"Training Task" rounds every pair starts with, and six "distraction" tasks
that lacked the study's target payoff dynamic (see EXCLUDED_TASK_LABELS),
are left out entirely; `round` is renumbered to count only the remaining
tasks, and `task_1`/`task_2` hold the task's index into
data/experiment.json's `tasks` array rather than its label.

Usage: python build_task_datatable.py
"""

import csv
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "results"
EXPERIMENT_PATH = REPO_ROOT / "data" / "experiment.json"
OUTPUT_PATH = Path(__file__).resolve().parent / "task_data.csv"

ARMS = ["control", "treatment"]

FILENAME_RE = re.compile(r"^task_(control|treatment)_(\d{2})\.csv$")

# These six were distraction tasks: they didn't have the payoff dynamic
# the study is about, so they're excluded from analysis. Note "Task
# Montana" and "Task  Mississippi" have a double space between "Task" and
# the name in data/experiment.json -- kept verbatim here so the exclusion
# actually matches.
EXCLUDED_TASK_LABELS = {
    "Task Idoha",
    "Task Florida",
    "Task Utah",
    "Task Massachusetts",
    "Task  Montana",
    "Task  Mississippi",
}

FIELDNAMES = [
    "arm", "session", "round", "username_1", "username_2",
    "task_1", "task_2", "design_1", "design_2", "strategy_1", "strategy_2",
    "collabBelief_1", "collabBelief_2", "usedRobot_1", "usedRobot_2",
    "score_1", "score_2",
]


def load_label_to_index():
    with EXPERIMENT_PATH.open(encoding="utf-8") as f:
        experiment = json.load(f)
    return {task["label"]: index for index, task in enumerate(experiment["tasks"])}


def find_task_files():
    for arm in ARMS:
        arm_dir = RESULTS_DIR / arm
        if not arm_dir.is_dir():
            continue
        for path in sorted(arm_dir.glob("task_*.csv")):
            match = FILENAME_RE.match(path.name)
            if match:
                yield arm, match.group(2), path


def clean_value(value):
    """Strip whitespace, and normalize the non-breaking space (U+00A0) that
    every `design` value contains between "Design" and its letter (e.g.
    "Design\\xa0M") into a regular space. `stratdyn.js` only strips that
    character from the copy it uses for scoring, not the copy it logs, so
    the raw CSV's `design` column never matches the plain-space labels used
    everywhere else (e.g. data/experiment.json)."""
    return value.replace("\xa0", " ").strip()


def read_task_rows(path):
    """Read a task_*.csv, cleaning header names and values (the server's log
    writer leaves stray spaces around several fields, e.g. the header has
    " score" with a leading space)."""
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = [clean_value(h) for h in next(reader)]
        for raw_row in reader:
            if not raw_row:
                continue
            yield {key: clean_value(value) for key, value in zip(header, raw_row)}


def group_by_pair(rows):
    """Group rows by the unordered {username, partner} pair, preserving each
    pair's original (chronological, append-order) row sequence."""
    groups = {}
    for row in rows:
        pair = tuple(sorted([row["username"], row["partner"]]))
        groups.setdefault(pair, []).append(row)
    return groups


def build_rounds(arm, session, path, label_to_index):
    """Yield one merged record per task round for every pair in this file.

    Every round is logged as two rows, one per partner. Both rows carry
    that partner's own collabBelief; only the row submitted *second* (once
    both partners have decided) carries real score/partnerScore values --
    the first row always logs score/partnerScore as the literal string
    "null". Occasionally (see results/README.md) a partner's design fails
    to register and *both* rows end up with "null" scores; those rounds are
    written out with score_1/score_2 left blank rather than guessed at.
    """
    rows = list(read_task_rows(path))
    for pair, pair_rows in group_by_pair(rows).items():
        username_1, username_2 = pair
        if len(pair_rows) % 2 != 0:
            raise ValueError(
                f"{path.name}: pair {pair} has an odd number of rows "
                f"({len(pair_rows)}); expected exactly two rows per round"
            )

        round_number = 0
        for raw_round, i in enumerate(range(0, len(pair_rows), 2), start=1):
            row_a, row_b = pair_rows[i], pair_rows[i + 1]
            by_user = {row_a["username"]: row_a, row_b["username"]: row_b}
            if set(by_user) != {username_1, username_2}:
                raise ValueError(
                    f"{path.name}: raw round {raw_round} for pair {pair} does not "
                    f"have one row from each partner (got {set(by_user)})"
                )

            task_label_1 = by_user[username_1]["task"]
            task_label_2 = by_user[username_2]["task"]
            if task_label_1.startswith("Training Task") or task_label_2.startswith("Training Task"):
                continue
            if task_label_1 in EXCLUDED_TASK_LABELS or task_label_2 in EXCLUDED_TASK_LABELS:
                continue
            round_number += 1

            record = {
                "arm": arm,
                "session": session,
                "round": round_number,
                "username_1": username_1,
                "username_2": username_2,
                "task_1": label_to_index[task_label_1],
                "task_2": label_to_index[task_label_2],
                "design_1": by_user[username_1]["design"],
                "design_2": by_user[username_2]["design"],
                "strategy_1": by_user[username_1]["strategy"],
                "strategy_2": by_user[username_2]["strategy"],
                "collabBelief_1": by_user[username_1]["collabBelief"],
                "collabBelief_2": by_user[username_2]["collabBelief"],
                "usedRobot_1": by_user[username_1]["usedRobot"],
                "usedRobot_2": by_user[username_2]["usedRobot"],
                "score_1": "",
                "score_2": "",
            }

            scored_rows = [r for r in (row_a, row_b) if r["score"] not in ("null", "")]
            if len(scored_rows) > 1:
                raise ValueError(
                    f"{path.name}: round {round_number} for pair {pair} has more "
                    "than one row reporting a score"
                )
            if scored_rows:
                scored_row = scored_rows[0]
                scorer, partner = scored_row["username"], scored_row["partner"]
                record[f"score_{1 if scorer == username_1 else 2}"] = scored_row["score"]
                record[f"score_{1 if partner == username_1 else 2}"] = scored_row["partnerScore"]

            yield record


def main():
    label_to_index = load_label_to_index()

    records = []
    for arm, session, path in find_task_files():
        records.extend(build_rounds(arm, session, path, label_to_index))

    records.sort(key=lambda r: (r["arm"], r["session"], r["username_1"], r["round"]))

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)

    print(f"Wrote {len(records)} task rounds to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
