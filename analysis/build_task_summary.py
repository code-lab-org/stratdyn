"""Build a task summary datatable from data/experiment.json.

One row per task (index 0-35; the four Training Task rounds, indices
36-39, are excluded): the payoff structure of its three collaborative
design options (K/L/M, ranked A/B/C by upside, largest first) and its
individual option (Y), the task index shown to a partner at the same
round, and two derived grouping columns (task_difficulty,
payoff_magnitude). Writes the result to task_summary.csv in this
directory.

Column naming follows the payoff-matrix notation V_{tier}^{outcome}:
tier is A/B/C for the collaborative options (ranked by upside) or Y for
the individual option; outcome is CC (both collaborative -- the upside),
CI (this option collaborative, partner individual -- the downside), IC
(this option individual, partner collaborative -- Y's upside), or II
(both individual -- Y's downside). CSV columns use underscores in place of
the LaTeX-style ^/_ (e.g. V_A_CC).

Usage: python build_task_summary.py
"""

import csv
import json
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPERIMENT_PATH = REPO_ROOT / "data" / "experiment.json"
OUTPUT_PATH = Path(__file__).resolve().parent / "task_summary.csv"

FIELDNAMES = [
    "task_index", "paired_task_index",
    "V_A_CC", "V_A_CI", "V_B_CC", "V_B_CI", "V_C_CC", "V_C_CI",
    "V_Y_IC", "V_Y_II",
    "task_difficulty", "payoff_magnitude",
]

PAYOFF_MAGNITUDE_BY_V_A_CC = {130: 5, 122: 4, 114: 3, 106: 2, 100: 1}


def load_experiment():
    with EXPERIMENT_PATH.open(encoding="utf-8") as f:
        return json.load(f)



# Distraction tasks (30-35) and training tasks (36-39) are self-paired by
# design -- both partners always see the identical task index at these
# rounds. This is confirmed by the assignment data itself: every one of
# these indices shows unanimous self-pairing (52/52 observations) *except*
# 33, which is the one known data-entry error (see data/README.md: index 33
# was mistakenly logged as 23 for half of all participants). Trusting a
# majority vote for 33 would get it wrong 100% of the time, since the
# corruption always hits the same side of the pairing -- so self-pairing is
# asserted outright here rather than inferred, for the full 30-39 range.
SELF_PAIRED_TASK_INDICES = range(30, 40)


def paired_task_indices(experiment):
    """For each real task index (0-29), find the task index a partner is
    shown at the same round, by scanning every participant's assignment
    sequence alongside their partner's. This is expected to be the same
    value everywhere a given task index appears; take the most common
    observation as canonical in case of any disagreement."""
    observations = {}  # task_index -> Counter of observed paired indices
    assignments = experiment["assignments"]
    partners = experiment["partners"]
    for user, sequence in assignments.items():
        partner = partners.get(user)
        if partner is None or partner not in assignments:
            continue
        partner_sequence = assignments[partner]
        for position, task_index in enumerate(sequence):
            if task_index in SELF_PAIRED_TASK_INDICES:
                continue
            paired_index = partner_sequence[position]
            observations.setdefault(task_index, Counter())[paired_index] += 1

    paired = {
        task_index: counts.most_common(1)[0][0]
        for task_index, counts in observations.items()
    }
    for task_index in SELF_PAIRED_TASK_INDICES:
        paired[task_index] = task_index
    return paired


def task_difficulty(task_index):
    if 0 <= task_index <= 29:
        return (task_index // 5) + 1
    return "n/a"


def payoff_magnitude(v_a_cc):
    return PAYOFF_MAGNITUDE_BY_V_A_CC.get(v_a_cc, "n/a")


def summarize_task(task):
    options_by_label = {option["label"]: option for option in task["options"]}
    collaborative_labels = ["Design K", "Design L", "Design M"]
    ranked = sorted(
        collaborative_labels,
        key=lambda label: int(options_by_label[label]["upside"]),
        reverse=True,
    )
    label_a, label_b, label_c = ranked
    option_y = options_by_label["Design Y"]

    return {
        "V_A_CC": int(options_by_label[label_a]["upside"]),
        "V_A_CI": int(options_by_label[label_a]["downside"]),
        "V_B_CC": int(options_by_label[label_b]["upside"]),
        "V_B_CI": int(options_by_label[label_b]["downside"]),
        "V_C_CC": int(options_by_label[label_c]["upside"]),
        "V_C_CI": int(options_by_label[label_c]["downside"]),
        "V_Y_IC": int(option_y["upside"]),
        "V_Y_II": int(option_y["downside"]),
    }


TRAINING_TASK_INDICES = range(36, 40)


def main():
    experiment = load_experiment()
    paired = paired_task_indices(experiment)

    records = []
    for task_index, task in enumerate(experiment["tasks"]):
        if task_index in TRAINING_TASK_INDICES:
            continue
        record = {
            "task_index": task_index,
            "paired_task_index": paired.get(task_index, ""),
            "task_difficulty": task_difficulty(task_index),
        }
        record.update(summarize_task(task))
        record["payoff_magnitude"] = payoff_magnitude(record["V_A_CC"])
        records.append(record)

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)

    print(f"Wrote {len(records)} tasks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
