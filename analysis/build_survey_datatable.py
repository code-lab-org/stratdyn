"""Build a unified per-participant survey datatable from results/ CSVs.

Reads every demographics_*.csv, presurvey_*.csv, and postsurvey_*.csv file
under results/{control,treatment}/, joins them on username (one row per
participant), adds `arm` and `session` columns, renames each survey column
to something descriptive (see descriptive_column), and writes the result
to survey_data.csv in this directory.

Usage: python build_survey_datatable.py
"""

import csv
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = REPO_ROOT / "results"
OUTPUT_PATH = Path(__file__).resolve().parent / "survey_data.csv"

ARMS = ["control", "treatment"]
SURVEY_TYPES = ["demographics", "presurvey", "postsurvey"]

FILENAME_RE = re.compile(r"^(demographics|presurvey|postsurvey)_(control|treatment)_(\d{2})\.csv$")


def find_survey_files():
    """Yield (survey_type, arm, session, path), grouped by arm/session, in
    demographics -> presurvey -> postsurvey order so columns come out in a
    predictable order in the merged table."""
    for arm in ARMS:
        arm_dir = RESULTS_DIR / arm
        if not arm_dir.is_dir():
            continue
        sessions = sorted(
            match.group(3)
            for path in arm_dir.glob("*.csv")
            if (match := FILENAME_RE.match(path.name))
        )
        for session in sorted(set(sessions)):
            for survey_type in SURVEY_TYPES:
                path = arm_dir / f"{survey_type}_{arm}_{session}.csv"
                if path.exists():
                    yield survey_type, arm, session, path


def read_survey_rows(path):
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if any(row.values()):
                yield row


CONSTRUCT_NAMES = {"t": "trust", "r": "risk", "c": "control"}
SURVEY_ITEM_RE = re.compile(r"^q\d(?P<construct>[trc])(?P<item>\d)$")

# See results/README.md for the source of each of these names/caveats.
# q4/q5 are a known bug (public/index.js submitted the q3 input for all
# three fields) that duplicates stem_education_years rather than capturing
# professional experience / native language as intended -- mapped to None
# to drop them entirely rather than keep a column that just repeats
# stem_education_years under a different name.
DEMOGRAPHICS_COLUMN_NAMES = {
    "demographics-survey-q1": "gender",
    "demographics-survey-q2": "age",
    "demographics-survey-q3": "stem_education_years",
    "demographics-survey-q4": None,
    "demographics-survey-q5": None,
    "demographics-survey-q63": "english_proficiency",
    "demographics-survey-q7": "social_closeness",
}


def descriptive_column(survey_type, column):
    """Rename a raw survey column to something descriptive, or return None
    if the column should be dropped entirely (see DEMOGRAPHICS_COLUMN_NAMES).

    presurvey/postsurvey columns share the same 9 underlying constructs
    (t=Trust, r=Risk, c=Control, each with 3 items) but in a different
    on-screen order with different raw names per survey (e.g. presurvey's
    q1t2 and postsurvey's q7t2 are both "Trust item 2") -- renamed to
    <construct>_<item> and prefixed by survey type, both to normalize this
    and because presurvey/postsurvey happen to share two raw names (q4r2,
    q5t1) that a merge could otherwise silently overwrite.
    """
    if column == "timestamp":
        return None
    if survey_type == "demographics":
        return DEMOGRAPHICS_COLUMN_NAMES[column]
    match = SURVEY_ITEM_RE.match(column)
    if not match:
        raise ValueError(f"unrecognized {survey_type} column: {column!r}")
    construct = CONSTRUCT_NAMES[match.group("construct")]
    return f"{survey_type}_{construct}_{match.group('item')}"


def main():
    participants = {}  # username -> {"username", "arm", "session", ...survey columns}
    columns = []  # preserves first-seen column order across all survey types
    skipped_duplicates = []

    for survey_type, arm, session, path in find_survey_files():
        seen_in_file = set()
        for row in read_survey_rows(path):
            username = row["username"]
            if username in seen_in_file:
                skipped_duplicates.append((path.name, username))
                continue
            seen_in_file.add(username)

            participant = participants.setdefault(
                username, {"username": username, "arm": arm, "session": session}
            )

            for column, value in row.items():
                if column == "username":
                    continue
                key = descriptive_column(survey_type, column)
                if key is None:
                    continue
                if key not in columns:
                    columns.append(key)
                participant[key] = value

    fieldnames = ["username", "arm", "session"] + columns

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, restval="")
        writer.writeheader()
        for username in sorted(participants):
            writer.writerow(participants[username])

    print(f"Wrote {len(participants)} participants to {OUTPUT_PATH}")
    for filename, username in skipped_duplicates:
        print(f"Skipped duplicate submission: {username} in {filename}")


if __name__ == "__main__":
    main()
