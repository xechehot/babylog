"""Tag `food` entries that were recognized before allergen tagging existed.

New uploads get `allergens` / `food_groups` straight from the vision prompt. This script
does the same job for history: it feeds the already-transcribed product lists from
`entries.notes` to a text-only LLM call and writes the tags back, so the allergen panel and
the food-group grid cover the whole log rather than only uploads made after the feature.

Run from the backend directory:

    uv run python scripts/backfill_food_tags.py --dry-run
    uv run python scripts/backfill_food_tags.py

Re-runs are cheap: by default only untagged entries are sent. Use --all to retag everything,
for instance after changing the tagging reference in app/food_tags.py.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import get_db, init_db  # noqa: E402
from app.services.llm import LLMService  # noqa: E402

BATCH_SIZE = 40


async def fetch_rows(retag_all: bool, limit: int | None) -> list[dict]:
    where = "entry_type = 'food'"
    if not retag_all:
        where += " AND allergens IS NULL"

    query = f"SELECT id, date, notes FROM entries WHERE {where} ORDER BY date ASC, occurred_at ASC"
    if limit:
        query += f" LIMIT {int(limit)}"

    async with get_db() as db:
        cursor = await db.execute(query)
        return [dict(row) for row in await cursor.fetchall()]


async def write_tags(entry_id: int, allergens: list[str], food_groups: list[str]) -> None:
    async with get_db() as db:
        await db.execute(
            """UPDATE entries
               SET allergens = ?, food_groups = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (json.dumps(allergens), json.dumps(food_groups), entry_id),
        )
        await db.commit()


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="call the LLM and print the proposed tags without writing to the database",
    )
    parser.add_argument(
        "--all",
        dest="retag_all",
        action="store_true",
        help="retag every food entry, not just the untagged ones",
    )
    parser.add_argument("--limit", type=int, default=None, help="process at most N entries")
    parser.add_argument("--batch", type=int, default=BATCH_SIZE, help="entries per LLM call")
    args = parser.parse_args()

    await init_db()
    rows = await fetch_rows(args.retag_all, args.limit)

    # A food entry whose products were never transcribed has nothing to classify. It still
    # gets empty tags rather than staying NULL, so the dashboard stops counting it as
    # untagged work waiting for a backfill run that could never resolve it.
    empty = [row for row in rows if not (row["notes"] or "").strip()]
    rows = [row for row in rows if (row["notes"] or "").strip()]

    print(f"database: {settings.database_path}")
    print(f"food entries to tag: {len(rows)}")
    if empty:
        print(f"food entries with no products (tagged empty locally): {len(empty)}")
        if not args.dry_run:
            for row in empty:
                await write_tags(row["id"], [], [])
    if not rows:
        return 0

    llm = LLMService()
    tagged = 0
    skipped = 0

    for start in range(0, len(rows), args.batch):
        batch = rows[start : start + args.batch]
        print(f"\n--- batch {start // args.batch + 1}: {len(batch)} entries ---")
        results = await llm.tag_food_notes([row["notes"] for row in batch])

        for row, result in zip(batch, results, strict=True):
            allergens = result["allergens"]
            food_groups = result["food_groups"]
            if not result["tagged"]:
                # The model dropped this line; leave it NULL so a later run retries it.
                print(f"  !! {row['date']} #{row['id']} NOT TAGGED: {row['notes']}")
                skipped += 1
                continue

            marks = ",".join(allergens) or "—"
            groups = ",".join(food_groups)
            print(f"  {row['date']} #{row['id']:<5} [{marks}] ({groups}) {row['notes']}")
            if not args.dry_run:
                await write_tags(row["id"], allergens, food_groups)
            tagged += 1

    verb = "would tag" if args.dry_run else "tagged"
    print(f"\n{verb} {tagged} entries, {skipped} skipped by the model")
    if args.dry_run:
        print("dry run: nothing written")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
