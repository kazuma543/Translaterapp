import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import uuid
import os
from functools import wraps
from dotenv import load_dotenv
from datetime import datetime
from supabase import create_client

load_dotenv()

API_KEY      = os.getenv("AZURE_API_KEY")
ENDPOINT     = os.getenv("AZURE_ENDPOINT")
LOCATION     = os.getenv("AZURE_LOCATION")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not all([API_KEY, ENDPOINT, LOCATION]):
    raise ValueError("Azure 環境変数が設定されていません。")
if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("Supabase 環境変数が設定されていません。")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

DB_NAME = "words.db"

# ── Auth ──────────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Unauthorized"}), 401
        try:
            user = supabase.auth.get_user(token)
            request.user_id = user.user.id
        except Exception:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated

# ── DB init ───────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    # Create tables with user_id from the start
    c.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name    TEXT NOT NULL,
            color   TEXT DEFAULT 'blue'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS words (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         TEXT NOT NULL,
            source_text     TEXT,
            translated_text TEXT,
            source_lang     TEXT,
            target_lang     TEXT,
            phonetic        TEXT,
            example         TEXT,
            known           INTEGER DEFAULT 0,
            folder_id       INTEGER REFERENCES folders(id) ON DELETE SET NULL,
            ease_factor     REAL    DEFAULT 2.5,
            interval        INTEGER DEFAULT 1,
            repetition      INTEGER DEFAULT 0,
            next_review     DATE
        )
    """)

    # Migrations for existing databases
    migrations = [
        "ALTER TABLE words ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE folders ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE words ADD COLUMN ease_factor REAL DEFAULT 2.5",
        "ALTER TABLE words ADD COLUMN interval INTEGER DEFAULT 1",
        "ALTER TABLE words ADD COLUMN repetition INTEGER DEFAULT 0",
        "ALTER TABLE words ADD COLUMN next_review DATE",
    ]
    for sql in migrations:
        try:
            c.execute(sql)
        except Exception:
            pass  # Column already exists

    conn.commit()
    conn.close()

init_db()

# ── Helpers ───────────────────────────────────────────────
def detect_language(text):
    url = f"{ENDPOINT}/detect?api-version=3.0"
    headers = {
        "Ocp-Apim-Subscription-Key":    API_KEY,
        "Ocp-Apim-Subscription-Region": LOCATION,
        "Content-type":                 "application/json"
    }
    response = requests.post(url, headers=headers, json=[{"text": text}])
    return response.json()[0]["language"]

def translate_text(text, source=None, target=None):
    if not source:
        source = detect_language(text) or "en"
    if not target or target == "auto":
        target = "en" if source == "ja" else "ja"

    url = f"{ENDPOINT}/translate?api-version=3.0&from={source}&to={target}"
    headers = {
        "Ocp-Apim-Subscription-Key":    API_KEY,
        "Ocp-Apim-Subscription-Region": LOCATION,
        "Content-type":                 "application/json",
        "X-ClientTraceId":              str(uuid.uuid4())
    }
    result = requests.post(url, headers=headers, json=[{"text": text}]).json()
    return {
        "source_language": source,
        "target_language": target,
        "translated_text": result[0]["translations"][0]["text"]
    }

# ════════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════════

@app.route("/signup", methods=["POST"])
def signup():
    try:
        data     = request.json
        email    = data.get("email", "").strip()
        password = data.get("password", "")
        if not email or not password:
            return jsonify({"status": "error", "message": "Email and password required"}), 400
        if len(password) < 6:
            return jsonify({"status": "error", "message": "Password must be 6+ characters"}), 400
        res = supabase.auth.sign_up({"email": email, "password": password})
        return jsonify({"status": "success", "user": res.user.email})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/login", methods=["POST"])
def login():
    try:
        data     = request.json
        email    = data.get("email", "").strip()
        password = data.get("password", "")
        if not email or not password:
            return jsonify({"status": "error", "message": "Email and password required"}), 400
        res   = supabase.auth.sign_in_with_password({"email": email, "password": password})
        token = res.session.access_token
        return jsonify({"status": "success", "token": token, "user": res.user.email})
    except Exception:
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

@app.route("/logout", methods=["POST"])
@require_auth
def logout():
    try:
        supabase.auth.sign_out()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ════════════════════════════════════════════════════════════
# TRANSLATE — OPTIONS handled before auth
# ════════════════════════════════════════════════════════════

@app.route("/translate", methods=["POST", "OPTIONS"])
def api_translate():
    if request.method == "OPTIONS":
        return "", 200
    # Manual auth check so OPTIONS bypass works
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        user = supabase.auth.get_user(token)
    except Exception:
        return jsonify({"error": "Invalid token"}), 401

    try:
        data   = request.json
        text   = data.get("text", "")
        if not text or len(text) > 1000:
            return jsonify({"error": "text is required and must be under 1000 chars"}), 400
        result = translate_text(text, data.get("source"), data.get("target"))
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ════════════════════════════════════════════════════════════
# WORDS
# ════════════════════════════════════════════════════════════

@app.route("/save_word", methods=["POST"])
@require_auth
def save_word():
    try:
        data            = request.json
        source_text     = data.get("source_text", "").strip()
        translated_text = data.get("translated_text", "").strip()
        source_lang     = data.get("source_lang", "")
        target_lang     = data.get("target_lang", "")
        phonetic        = data.get("phonetic", "")
        example         = data.get("example", "")
        folder_id       = data.get("folder_id", None)

        if not source_text or not translated_text:
            return jsonify({"status": "error", "message": "Text is required"}), 400
        if len(source_text) > 500 or len(translated_text) > 500:
            return jsonify({"status": "error", "message": "Text too long"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            INSERT INTO words
              (user_id, source_text, translated_text, source_lang, target_lang,
               phonetic, example, known, folder_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        """, (request.user_id, source_text, translated_text, source_lang,
              target_lang, phonetic, example, folder_id))
        conn.commit()
        word_id = c.lastrowid
        conn.close()
        return jsonify({"status": "success", "id": word_id}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/words", methods=["GET"])
@require_auth
def get_words():
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            SELECT w.id, w.source_text, w.translated_text, w.source_lang,
                   w.target_lang, w.phonetic, w.example, w.known,
                   w.folder_id, f.name as folder_name
            FROM words w
            LEFT JOIN folders f ON f.id = w.folder_id
            WHERE w.user_id = ?
        """, (request.user_id,))
        columns = [col[0] for col in c.description]
        rows    = c.fetchall()
        conn.close()
        return jsonify([dict(zip(columns, row)) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/update_word", methods=["POST"])
@require_auth
def update_word():
    try:
        data            = request.json
        word_id         = data.get("id")
        source_text     = data.get("source_text", "").strip()
        translated_text = data.get("translated_text", "").strip()
        phonetic        = data.get("phonetic", "")
        example         = data.get("example", "")

        if not word_id:
            return jsonify({"status": "error", "message": "id is required"}), 400
        if not source_text or not translated_text:
            return jsonify({"status": "error", "message": "Text is required"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            UPDATE words
            SET source_text=?, translated_text=?, phonetic=?, example=?
            WHERE id=? AND user_id=?
        """, (source_text, translated_text, phonetic, example,
              word_id, request.user_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/update_known", methods=["POST"])
@require_auth
def update_known():
    try:
        data    = request.json
        word_id = data.get("id")
        known   = data.get("known")
        if word_id is None or known is None:
            return jsonify({"status": "error", "message": "id and known are required"}), 400
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "UPDATE words SET known=? WHERE id=? AND user_id=?",
            (known, word_id, request.user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/delete_word", methods=["POST"])
@require_auth
def delete_word():
    try:
        word_id = request.json.get("id")
        if not word_id:
            return jsonify({"status": "error", "message": "id is required"}), 400
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "DELETE FROM words WHERE id=? AND user_id=?",
            (word_id, request.user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/word_random", methods=["GET"])
@require_auth
def get_random_word():
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            SELECT id, source_text, translated_text, known
            FROM words
            WHERE user_id = ?
            ORDER BY CASE WHEN known = 0 THEN 0 ELSE 1 END, RANDOM()
            LIMIT 1
        """, (request.user_id,))
        row = c.fetchone()
        conn.close()
        if row:
            return jsonify({
                "id": row[0], "source_text": row[1],
                "translated_text": row[2], "known": row[3]
            })
        return jsonify({"error": "No words found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ════════════════════════════════════════════════════════════
# SRS
# ════════════════════════════════════════════════════════════

@app.route("/review_word", methods=["POST"])
@require_auth
def review_word():
    try:
        data    = request.json
        word_id = data.get("id")
        quality = data.get("quality")  # 0–5

        if word_id is None or quality is None:
            return jsonify({"status": "error", "message": "id and quality are required"}), 400
        if not (0 <= quality <= 5):
            return jsonify({"status": "error", "message": "quality must be 0–5"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()

        # Verify ownership and get current SRS state
        c.execute("""
            SELECT repetition, interval, ease_factor
            FROM words WHERE id=? AND user_id=?
        """, (word_id, request.user_id))
        row = c.fetchone()
        if not row:
            conn.close()
            return jsonify({"status": "error", "message": "Word not found"}), 404

        repetition = row[0] or 0
        interval   = row[1] or 1
        ease       = row[2] or 2.5

        # SM-2 algorithm
        if quality < 3:
            repetition = 0
            interval   = 1
        else:
            if repetition == 0:
                interval = 1
            elif repetition == 1:
                interval = 6
            else:
                interval = round(interval * ease)
            repetition += 1

        ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        if ease < 1.3:
            ease = 1.3

        from datetime import timedelta
        next_review = (datetime.now() + timedelta(days=interval)).date()
        known       = 1 if quality >= 3 else 0

        c.execute("""
            UPDATE words
            SET ease_factor=?, interval=?, repetition=?, next_review=?, known=?
            WHERE id=? AND user_id=?
        """, (ease, interval, repetition, str(next_review), known,
              word_id, request.user_id))
        conn.commit()
        conn.close()

        return jsonify({
            "status":      "success",
            "next_review": str(next_review),
            "interval":    interval
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/due_words", methods=["GET"])
@require_auth
def due_words():
    try:
        today = datetime.now().date()
        conn  = sqlite3.connect(DB_NAME)
        c     = conn.cursor()
        c.execute("""
            SELECT id, source_text, translated_text, source_lang, target_lang,
                   phonetic, example, known, folder_id, ease_factor,
                   interval, repetition, next_review
            FROM words
            WHERE user_id = ?
              AND (next_review IS NULL OR next_review <= ?)
        """, (request.user_id, str(today)))
        columns = [col[0] for col in c.description]
        rows    = c.fetchall()
        conn.close()
        return jsonify([dict(zip(columns, row)) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ════════════════════════════════════════════════════════════
# FOLDERS
# ════════════════════════════════════════════════════════════

@app.route("/folders", methods=["GET"])
@require_auth
def get_folders():
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            SELECT f.id, f.name, f.color, COUNT(w.id) as word_count
            FROM folders f
            LEFT JOIN words w ON w.folder_id = f.id
            WHERE f.user_id = ?
            GROUP BY f.id
        """, (request.user_id,))
        rows = c.fetchall()
        conn.close()
        return jsonify([{
            "id": row[0], "name": row[1],
            "color": row[2], "word_count": row[3]
        } for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/create_folder", methods=["POST"])
@require_auth
def create_folder():
    try:
        data  = request.json
        name  = data.get("name", "").strip()
        color = data.get("color", "blue")
        if not name:
            return jsonify({"status": "error", "message": "Name is required"}), 400
        if len(name) > 100:
            return jsonify({"status": "error", "message": "Name too long"}), 400
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "INSERT INTO folders (user_id, name, color) VALUES (?, ?, ?)",
            (request.user_id, name, color)
        )
        conn.commit()
        folder_id = c.lastrowid
        conn.close()
        return jsonify({"status": "success", "id": folder_id, "name": name, "color": color})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/delete_folder", methods=["POST"])
@require_auth
def delete_folder():
    try:
        folder_id = request.json.get("id")
        if not folder_id:
            return jsonify({"status": "error", "message": "id is required"}), 400
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        # Verify ownership before deleting
        c.execute("SELECT id FROM folders WHERE id=? AND user_id=?",
                  (folder_id, request.user_id))
        if not c.fetchone():
            conn.close()
            return jsonify({"status": "error", "message": "Folder not found"}), 404
        c.execute("UPDATE words SET folder_id=NULL WHERE folder_id=?", (folder_id,))
        c.execute("DELETE FROM folders WHERE id=?", (folder_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/rename_folder", methods=["POST"])
@require_auth
def rename_folder():
    try:
        data      = request.json
        folder_id = data.get("id")
        new_name  = data.get("name", "").strip()
        if not folder_id or not new_name:
            return jsonify({"status": "error", "message": "id and name required"}), 400
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "UPDATE folders SET name=? WHERE id=? AND user_id=?",
            (new_name, folder_id, request.user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/words_in_folder/<int:folder_id>", methods=["GET"])
@require_auth
def words_in_folder(folder_id):
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            SELECT id, source_text, translated_text, source_lang,
                   target_lang, phonetic, example, known
            FROM words
            WHERE folder_id=? AND user_id=?
        """, (folder_id, request.user_id))
        columns = [col[0] for col in c.description]
        rows    = c.fetchall()
        conn.close()
        return jsonify([dict(zip(columns, row)) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/move_word", methods=["POST"])
@require_auth
def move_word():
    try:
        data      = request.json
        word_id   = data.get("word_id")
        folder_id = data.get("folder_id")
        if not word_id:
            return jsonify({"status": "error", "message": "word_id is required"}), 400
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute(
            "UPDATE words SET folder_id=? WHERE id=? AND user_id=?",
            (folder_id, word_id, request.user_id)
        )
        conn.commit()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)