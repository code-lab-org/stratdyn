"""Build a unified per-participant survey datatable from results/ CSVs.

Reads every demographics_*.csv, presurvey_*.csv, and postsurvey_*.csv file
under results/{control,treatment}/, joins them on username (one row per
participant), adds `arm` and `session` columns, and writes the result to
survey_data.csv in this directory.

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


def prefixed_column(survey_type, column):
    """presurvey and postsurvey happen to share two raw column names
    (q4r2, q5t1) -- prefix every survey-specific column by its survey type
    so a merge can never silently overwrite one survey's answer with
    another's. demographics columns are already uniquely named."""
    if column == "timestamp":
        return f"{survey_type}_timestamp"
    if survey_type == "demographics":
        return column
    return f"{survey_type}_{column}"


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
                key = prefixed_column(survey_type, column)
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
