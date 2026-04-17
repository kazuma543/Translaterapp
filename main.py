import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS 
import requests
import uuid
import os
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta
from supabase import create_client
import os
load_dotenv()

API_KEY = os.getenv("AZURE_API_KEY")
ENDPOINT = os.getenv("AZURE_ENDPOINT")
LOCATION = os.getenv("AZURE_LOCATION")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # service key — never expose this
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


if not API_KEY or not ENDPOINT or not LOCATION:
    raise ValueError("環境変数が設定されていません。.envファイルを確認してください。")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase 環境変数が設定されていません。.envファイルを確認してください。")


app = Flask(__name__)
CORS(app)
# DB Setup
DB_NAME = "words.db"

from functools import wraps

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

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id    INTEGER PRIMARY KEY AUTOINCREMENT,
            name  TEXT NOT NULL,
            color TEXT DEFAULT 'blue'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS words (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            source_text     TEXT,
            translated_text TEXT,
            source_lang     TEXT,
            target_lang     TEXT,
            phonetic        TEXT,
            example         TEXT,
            known           INTEGER DEFAULT 0,
            folder_id       INTEGER REFERENCES folders(id) ON DELETE SET NULL
        )
    """)
    try:
        c.execute("ALTER TABLE words ADD COLUMN ease_factor REAL DEFAULT 2.5")
    except: pass

    try:
        c.execute("ALTER TABLE words ADD COLUMN interval INTEGER DEFAULT 1")
    except: pass

    try:
        c.execute("ALTER TABLE words ADD COLUMN repetition INTEGER DEFAULT 0")
    except: pass

    try:
        c.execute("ALTER TABLE words ADD COLUMN next_review DATE")
    except: pass

    # Seed default folders if none exist
    c.execute("SELECT COUNT(*) FROM folders")
    if c.fetchone()[0] == 0:
        c.executemany("INSERT INTO folders (name, color) VALUES (?, ?)", [
            ('Daily vocab', 'blue'),
            ('Business',    'green'),
            ('JLPT N2',     'amber'),
        ])

    conn.commit()
    conn.close()

init_db()

# 
# Utility: Detect language
def detect_language(text):
    url = f"{ENDPOINT}/detect?api-version=3.0"

    headers = {
        "Ocp-Apim-Subscription-Key": API_KEY,
        "Ocp-Apim-Subscription-Region": LOCATION,
        "Content-type": "application/json"
    }

    response = requests.post(url, headers=headers, json=[{"text": text}])
    data = response.json()
    return data[0]["language"]

# Utility: Translate (Latest)
def translate_text(text, source=None, target=None):
    # 
    if not source:
        source = detect_language(text) or "en"

    if not target or target =="auto":
        if source == "ja":
            target = "en"
        else:
            target = "ja"

    # 
    url = f"{ENDPOINT}/translate?api-version=3.0&from={source}&to={target}"

    headers = {
        "Ocp-Apim-Subscription-Key": API_KEY,
        "Ocp-Apim-Subscription-Region": LOCATION,
        "Content-type": "application/json",
        "X-ClientTraceId": str(uuid.uuid4())
    }

    body = [{"text": text}]

    response = requests.post(url, headers=headers, json=body)
    result = response.json()

    translated = result[0]["translations"][0]["text"]

    return {
        "source_language": source,
        "target_language": target,
        "translated_text": translated
    }

@app.route("/signup", methods=["POST"])
@require_auth
def signup():
    try:
        data     = request.json
        email    = data.get("email", "").strip()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"status": "error", "message": "Email and password are required"}), 400
        if len(password) < 6:
            return jsonify({"status": "error", "message": "Password must be at least 6 characters"}), 400

        res = supabase.auth.sign_up({"email": email, "password": password})
        return jsonify({
            "status": "success",
            "message": "Account created! Please check your email to confirm.",
            "user": res.user.email
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/login", methods=["POST"])
@require_auth
def login():
    try:
        data     = request.json
        email    = data.get("email", "").strip()
        password = data.get("password", "")

        if not email or not password:
            return jsonify({"status": "error", "message": "Email and password are required"}), 400

        res   = supabase.auth.sign_in_with_password({"email": email, "password": password})
        token = res.session.access_token
        return jsonify({
            "status": "success",
            "token":  token,
            "user":   res.user.email
        })
    except Exception as e:
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

@app.route("/logout", methods=["POST"])
@require_auth
def logout():
    try:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        supabase.auth.sign_out()
        return jsonify({"status": "success", "message": "Logged out"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    

# API 1: POST /translate
@app.route("/translate", methods=["POST","OPTIONS"])
@require_auth
def api_translate():
    print('a')
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.json

        text = data.get("text")
        source = data.get("source")  
        target = data.get("target")  
        if not text:
         return jsonify({"error": "text is required"}), 400

        result = translate_text(text, source, target)

        return jsonify(result)
    except Exception as e:
        print(f"Error: {str(e)}")  
        return jsonify({'error': str(e)}), 500
# API 2: POST /save_word
@app.route('/save_word', methods=['POST'])
@require_auth
def save_word():
    try:
        data            = request.json
        source_text     = data.get('source_text', '')
        translated_text = data.get('translated_text', '')
        source_lang     = data.get('source_lang', '')
        target_lang     = data.get('target_lang', '')
        phonetic        = data.get('phonetic', '')
        example         = data.get('example', '')
        folder_id       = data.get('folder_id', None)  # NEW
        known           = 0

        if not source_text or not translated_text:
            return jsonify({'status': 'error', 'message': 'Text is required'}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            INSERT INTO words
              (source_text, translated_text, source_lang, target_lang, phonetic, example, known, folder_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (source_text, translated_text, source_lang, target_lang, phonetic, example, known, folder_id))
        conn.commit()
        word_id = c.lastrowid
        conn.close()

        return jsonify({"status": "success", "id": word_id}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 重要: この関数の後に何もない(インデントが正しい)ことを確認
# API 3: GET /words
@app.route("/words", methods=["GET"])
@require_auth
def get_words():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
        SELECT w.id, w.source_text, w.translated_text, w.source_lang, w.target_lang, w.phonetic, w.example, w.known, w.folder_id, f.name as folder_name
        FROM words w
        LEFT JOIN folders f ON f.id = w.folder_id
    """)

    columns = [col[0] for col in c.description]
    rows = c.fetchall()

    result = []
    for row in rows:
        result.append(dict(zip(columns, row)))
    return jsonify(result)

#Random words API
@app.route("/word_random", methods=["GET"])
@require_auth
def get_random_word():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
        SELECT id, source_text, tranlated_text, know 
        FROM words 
        ORDER BY 
            CASE WHEN known = 0 THEN 0 ELES 1 END, 
            RAND() 
    LIMIT 1""")
    row = c.fetchone()
    conn.close()

    if row:
        return jsonify({
            "id":row[0],
            "source_text": row[1],
            "translated_text":row[2],
            "known":row[3],
        })
    else:
        return jsonify({"error": "No words found"}), 404
    


@app.route("/update_known", methods=["POST"])
@require_auth
def update_known():
    try:
        data = request.json
        word_id = data.get("id")
        known = data.get("known")  
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("UPDATE words SET known=? WHERE id=?", (known, word_id))
        conn.commit()
        conn.close()

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    
@app.route("/delete_word", methods=["POST"])
@require_auth
def flashcards_delete():
    try:
        data = request.json
        word_id = data.get("id")
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("DELETE FROM words WHERE id = ? ", (word_id,))
        conn.commit()
        conn.close()
    except sqlite3.Error as error:
        print(f"Falied to delete record from sqlite table:{error}")
    return jsonify({"success": True, "message": "Deleted successfully"}), 200

@app.route("/update_word", methods=["POST"])
@require_auth
def update_word():
    try:
        data = request.json
        word_id         = data.get("id")
        source_text     = data.get("source_text", "")
        translated_text = data.get("translated_text", "")
        phonetic        = data.get("phonetic", "")
        example         = data.get("example", "")

        if not word_id:
            return jsonify({"status": "error", "message": "id is required"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            UPDATE words
            SET source_text=?, translated_text=?, phonetic=?, example=?
            WHERE id=?
        """, (source_text, translated_text, phonetic, example, word_id))
        conn.commit()
        conn.close()

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# GET /folders — fetch all folders with word count
@app.route("/folders", methods=["GET"])
@require_auth
def get_folders():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
        SELECT f.id, f.name, f.color, COUNT(w.id) as word_count
        FROM folders f
        LEFT JOIN words w ON w.folder_id = f.id
        GROUP BY f.id
    """)
    rows = c.fetchall()
    conn.close()
    return jsonify([{
        "id":         row[0],
        "name":       row[1],
        "color":      row[2],
        "word_count": row[3]
    } for row in rows])


# POST /create_folder — create a new folder
@app.route("/create_folder", methods=["POST"])
@require_auth
def create_folder():
    try:
        data  = request.json
        name  = data.get("name", "").strip()
        color = data.get("color", "blue")

        if not name:
            return jsonify({"status": "error", "message": "Folder name is required"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("INSERT INTO folders (name, color) VALUES (?, ?)", (name, color))
        conn.commit()
        folder_id = c.lastrowid
        conn.close()

        return jsonify({"status": "success", "id": folder_id, "name": name, "color": color})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# POST /delete_folder — delete a folder (words become unassigned)
@app.route("/delete_folder", methods=["POST"])
@require_auth
def delete_folder():
    try:
        data      = request.json
        folder_id = data.get("id")

        if not folder_id:
            return jsonify({"status": "error", "message": "Folder id is required"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        # Unassign words first
        c.execute("UPDATE words SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
        c.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
        conn.commit()
        conn.close()

        return jsonify({"status": "success", "message": "Folder deleted"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# POST /rename_folder — rename an existing folder
@app.route("/rename_folder", methods=["POST"])
@require_auth
def rename_folder():
    try:
        data      = request.json
        folder_id = data.get("id")
        new_name  = data.get("name", "").strip()

        if not folder_id or not new_name:
            return jsonify({"status": "error", "message": "id and name are required"}), 400

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("UPDATE folders SET name = ? WHERE id = ?", (new_name, folder_id))
        conn.commit()
        conn.close()

        return jsonify({"status": "success", "message": "Folder renamed"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# GET /words_in_folder/<folder_id> — fetch words for a specific folder
@app.route("/words_in_folder/<int:folder_id>", methods=["GET"])
@require_auth
def words_in_folder(folder_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
        SELECT id, source_text, translated_text, source_lang, target_lang, phonetic, example, known
        FROM words
        WHERE folder_id = ?
    """, (folder_id,))
    rows = c.fetchall()
    conn.close()
    return jsonify([{
        "id":             row[0],
        "source_text":    row[1],
        "translated_text":row[2],
        "source_lang":    row[3],
        "target_lang":    row[4],
        "phonetic":       row[5],
        "example":        row[6],
        "known":          row[7]
    } for row in rows])


# POST /move_word — move a word to a different folder
@app.route("/move_word", methods=["POST"])
@require_auth
def move_word():
    try:
        data      = request.json
        word_id   = data.get("word_id")
        folder_id = data.get("folder_id")  # pass null to unassign

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("UPDATE words SET folder_id = ? WHERE id = ?", (folder_id, word_id))
        conn.commit()
        conn.close()

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/review_word", methods=["POST"])
@require_auth
def review_word():
    try:
        data = request.json
        word_id = data.get("id")
        quality = data.get("quality")  # 0〜5

        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()

        c.execute("""
            SELECT repetition, interval, ease_factor
            FROM words WHERE id=?
        """, (word_id,))
        row = c.fetchone()

        repetition = row[0] or 0
        interval   = row[1] or 1
        ease       = row[2] or 2.5

        # SM-2
        if quality < 3:
            repetition = 0
            interval = 1
        else:
            if repetition == 0:
                interval = 1
            elif repetition == 1:
                interval = 6
            else:
                interval = round(interval * ease)

            repetition += 1

        # ease factor更新
        ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        if ease < 1.3:
            ease = 1.3

        next_review = datetime.now().date()

        c.execute("""
        INSERT INTO words
        (source_text, translated_text, source_lang, target_lang,
        phonetic, example, known, folder_id,
        ease_factor, interval, repetition, next_review)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            2.5, 1, 0, next_review
        ))

        conn.commit()
        conn.close()

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})
    
@app.route("/due_words", methods=["GET"])
@require_auth
def due_words():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    today = datetime.now().date()

    c.execute("""
        SELECT *
        FROM words
        WHERE next_review IS NULL
           OR next_review <= ?
    """, (today,))

    rows = c.fetchall()
    conn.close()

    columns = [col[0] for col in c.description]

    result = []
    for row in rows:
        result.append(dict(zip(columns, row)))
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)

