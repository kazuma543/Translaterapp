# migrate.py — run once to move existing data to Supabase
import sqlite3
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
conn     = sqlite3.connect("words.db")
c        = conn.cursor()

# You need to provide the user_id of the account to migrate data to
# Get this from Supabase dashboard → Authentication → Users
TARGET_USER_ID = "paste-your-user-uuid-here"

# Migrate folders
c.execute("SELECT id, name, color FROM folders")
old_folders = c.fetchall()

folder_id_map = {}  # old SQLite int id → new Supabase UUID

for old_id, name, color in old_folders:
    res = supabase.table("folders").insert({
        "user_id": TARGET_USER_ID,
        "name":    name,
        "color":   color or "blue",
    }).execute()
    new_id = res.data[0]["id"]
    folder_id_map[old_id] = new_id
    print(f"Folder: {name} → {new_id}")

# Migrate words
c.execute("""
    SELECT id, source_text, translated_text, source_lang, target_lang,
           phonetic, example, known, folder_id,
           ease_factor, interval, repetition, next_review
    FROM words
""")
old_words = c.fetchall()

for row in old_words:
    (old_id, source_text, translated_text, source_lang, target_lang,
     phonetic, example, known, old_folder_id,
     ease_factor, interval, repetition, next_review) = row

    new_folder_id = folder_id_map.get(old_folder_id) if old_folder_id else None

    supabase.table("words").insert({
        "user_id":         TARGET_USER_ID,
        "source_text":     source_text or "",
        "translated_text": translated_text or "",
        "source_lang":     source_lang or "",
        "target_lang":     target_lang or "",
        "phonetic":        phonetic or "",
        "example":         example or "",
        "known":           known or 0,
        "folder_id":       new_folder_id,
        "ease_factor":     ease_factor or 2.5,
        "interval":        interval or 1,
        "repetition":      repetition or 0,
        "next_review":     next_review,
    }).execute()
    print(f"Word: {source_text}")

conn.close()
print("Migration complete!")