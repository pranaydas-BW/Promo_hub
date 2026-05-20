"""
Run this from your Mac terminal:

    python3 update_key_size.py Size_mapping_master_-_Sheet1__1_.csv

It will:
  1. Clean the CSV (drop nulls + duplicates)
  2. Delete all existing key_size_map rows
  3. Insert the cleaned new rules
"""

import sys
import pandas as pd
import psycopg2

DB_URL = "postgresql://postgres.rcskopbekgfyqrgaiatv:Style_Broadway%402026@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"

if len(sys.argv) < 2:
    print("Usage: python3 update_key_size.py <path_to_csv>")
    sys.exit(1)

csv_path = sys.argv[1]

# ── Load & clean ──────────────────────────────────────────────────────────────
df = pd.read_csv(csv_path)
df.columns = [c.strip() for c in df.columns]
df = df.rename(columns={'Key Size = 1': 'key_size'})

before = len(df)

# Drop rows with null Node or Size
df = df.dropna(subset=['Node', 'Size'])
after_nulls = len(df)
print(f"Dropped {before - after_nulls} null rows")

# Remove duplicates — keep last occurrence
df = df.drop_duplicates(subset=['Division', 'Section', 'Department', 'Node', 'Size'], keep='last')
after_dupes = len(df)
print(f"Dropped {after_nulls - after_dupes} duplicate rows")
print(f"Clean rows to load: {after_dupes}")

# ── Connect ───────────────────────────────────────────────────────────────────
print("\nConnecting to database...")
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM key_size_map")
old_count = cur.fetchone()[0]
print(f"Existing rows in DB: {old_count}")

# ── Replace ───────────────────────────────────────────────────────────────────
cur.execute("DELETE FROM key_size_map")
print(f"Deleted {old_count} old rows")

rows = []
for _, row in df.iterrows():
    ks_val = None if pd.isna(row['key_size']) else int(row['key_size'])
    rows.append((
        str(row['Division']).strip(),
        str(row['Section']).strip(),
        str(row['Department']).strip(),
        str(row['Node']).strip(),
        str(row['Size']).strip(),
        ks_val
    ))

cur.executemany(
    """INSERT INTO key_size_map (division, section, department, node, size, key_size)
       VALUES (%s, %s, %s, %s, %s, %s)
       ON CONFLICT DO NOTHING""",
    rows
)
conn.commit()

# ── Verify ────────────────────────────────────────────────────────────────────
cur.execute("SELECT COUNT(*) FROM key_size_map")
new_count = cur.fetchone()[0]
print(f"New rows in DB: {new_count}")

cur.close()
conn.close()
print("\nDone ✅")
