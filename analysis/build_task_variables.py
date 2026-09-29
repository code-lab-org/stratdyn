"""Build derived analysis variables for every real task round per pair.

Reads task_data.csv (one row per round per pair) and the per-option
payoffs in data/experiment.json, and computes the derived task attributes,
individual observations, and paired observations defined in Section 4.1 of
the accompanying paper. Writes the result to task_variables.csv in this
directory, keyed identically to task_data.csv (arm, session, round,
username_1/_2, task_1/_2), with per-partner values suffixed _1/_2.

Derived task attributes:
  u_i      Normalized deviation loss (Eq. 1) for the selected collaborative
           design X:  (V_Y^II - V_X^CI) / ((V_Y^II - V_X^CI) + (V_X^CC - V_Y^IC)),
           or the mean over all three collaborative designs if the
           individual design Y was selected.
  R        Risk dominance (Eq. 3): sum over i of 0.5 * ln(u_i / (1 - u_i)).
  delta_u  Risk threshold asymmetry: |u_1 - u_2|.

Individual observations:
  P_i      Reported collaboration belief (0-100 slider).
  N_i      Collaborative intention: P_i - 100 * u_i.
  N_ij     Partner collaborative intention: P_j - 100 * u_i.
  S_i      Strategy inferred from the selected design: C (K/L/M) or I (Y).
  V_i      Realized payoff (score).

Paired observations:
  O        Joint outcome: S (both C, successful collaboration), I (both I,
           mutual independence), or F (S_1 != S_2, coordination failure).
  E        Payoff efficiency (Eq. 6): sum over i of
           0.5 * (V_i - V_{i,Y}^II) / (V_{i,A}^CC - V_{i,Y}^II).

Values are left blank where their inputs are missing: two control rounds
have one partner whose design failed to register (no S_i, u_i, V_i for
that partner, and no V_i for the other partner either), so R, delta_u, O,
and E are blank for those rounds too.

Usage: python build_task_variables.py
"""

import csv
import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPERIMENT_PATH = REPO_ROOT / "data" / "experiment.json"
TASK_DATA_PATH = Path(__file__).resolve().parent / "task_data.csv"
OUTPUT_PATH = Path(__file__).resolve().parent / "task_variables.csv"

COLLABORATIVE_LABELS = ["Design K", "Design L", "Design M"]
INDIVIDUAL_LABEL = "Design Y"

KEY_FIELDS = [
    "arm", "session", "round", "username_1", "username_2", "task_1", "task_2",
]
FIELDNAMES = KEY_FIELDS + [
    "u_1", "u_2", "R", "delta_u",
    "P_1", "P_2", "N_1", "N_2", "N_12", "N_21",
    "S_1", "S_2", "V_1", "V_2",
    "O", "E",
]


def load_tasks():
    with EXPERIMENT_PATH.open(encoding="utf-8") as f:
        experiment = json.load(f)
    return [
        {
            option["label"]: (int(option["upside"]), int(option["downside"]))
            for option in task["options"]
        }
        for task in experiment["tasks"]
    ]


def deviation_loss(options, label):
    """Normalized deviation loss u (Eq. 1) for one collaborative design."""
    v_cc, v_ci = options[label]
    v_ic, v_ii = options[INDIVIDUAL_LABEL]
    return (v_ii - v_ci) / ((v_ii - v_ci) + (v_cc - v_ic))


def participant_u(options, design):
    if design in COLLABORATIVE_LABELS:
        return deviation_loss(options, design)
    if design == INDIVIDUAL_LABEL:
        return sum(
            deviation_loss(options, label) for label in COLLABORATIVE_LABELS
        ) / len(COLLABORATIVE_LABELS)
    return None


def strategy(design):
    if design in COLLABORATIVE_LABELS:
        return "C"
    if design == INDIVIDUAL_LABEL:
        return "I"
    return None


def realized_payoff(options, design, partner_design):
    """The payoff implied by both partners' designs, used to cross-check
    the recorded score. Every design pays its upside (CC, or IC for Y) if
    the partner collaborates and its downside (CI, or II for Y) otherwise."""
    upside, downside = options[design]
    return upside if strategy(partner_design) == "C" else downside


def efficiency_term(options, payoff):
    v_a_cc = max(options[label][0] for label in COLLABORATIVE_LABELS)
    v_y_ii = options[INDIVIDUAL_LABEL][1]
    return 0.5 * (payoff - v_y_ii) / (v_a_cc - v_y_ii)


def logit_half(u):
    return 0.5 * math.log(u / (1 - u))


def outcome(s_1, s_2):
    if s_1 is None or s_2 is None:
        return None
    if s_1 != s_2:
        return "F"
    return "S" if s_1 == "C" else "I"


def int_or_none(value):
    return int(value) if value != "" else None


def build_record(row, tasks):
    options = {k: tasks[int(row[f"task_{k}"])] for k in "12"}
    design = {k: row[f"design_{k}"] for k in "12"}
    u = {k: participant_u(options[k], design[k]) for k in "12"}
    s = {k: strategy(design[k]) for k in "12"}
    p = {k: int(row[f"collabBelief_{k}"]) for k in "12"}
    v = {k: int_or_none(row[f"score_{k}"]) for k in "12"}

    for k, other in (("1", "2"), ("2", "1")):
        if v[k] is not None:
            expected = realized_payoff(options[k], design[k], design[other])
            if v[k] != expected:
                raise ValueError(
                    f"Score mismatch for {row[f'username_{k}']} round "
                    f"{row['round']}: recorded {v[k]}, expected {expected}"
                )

    both_u = u["1"] is not None and u["2"] is not None
    both_v = v["1"] is not None and v["2"] is not None

    record = {field: row[field] for field in KEY_FIELDS}
    record.update({
        "u_1": u["1"],
        "u_2": u["2"],
        "R": logit_half(u["1"]) + logit_half(u["2"]) if both_u else None,
        "delta_u": abs(u["1"] - u["2"]) if both_u else None,
        "P_1": p["1"],
        "P_2": p["2"],
        "N_1": p["1"] - 100 * u["1"] if u["1"] is not None else None,
        "N_2": p["2"] - 100 * u["2"] if u["2"] is not None else None,
        "N_12": p["2"] - 100 * u["1"] if u["1"] is not None else None,
        "N_21": p["1"] - 100 * u["2"] if u["2"] is not None else None,
        "S_1": s["1"],
        "S_2": s["2"],
        "V_1": v["1"],
        "V_2": v["2"],
        "O": outcome(s["1"], s["2"]),
        "E": (
            efficiency_term(options["1"], v["1"])
            + efficiency_term(options["2"], v["2"])
            if both_v else None
        ),
    })
    return {key: "" if value is None else value for key, value in record.items()}


def main():
    tasks = load_tasks()
    with TASK_DATA_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    records = [build_record(row, tasks) for row in rows]

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)

    print(f"Wrote {len(records)} rounds to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
