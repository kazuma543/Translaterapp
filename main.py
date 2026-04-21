import os
import uuid
from functools import wraps
from datetime import datetime, timedelta

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
import requests

load_dotenv()

API_KEY      = os.getenv("AZURE_API_KEY")
ENDPOINT     = os.getenv("AZURE_ENDPOINT")
LOCATION     = os.getenv("AZURE_LOCATION")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not all([API_KEY, ENDPOINT, LOCATION]):
    raise ValueError("Azure env vars missing")
if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("Supabase env vars missing")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

# ── Auth decorator ────────────────────────────────────────
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

# ── Translation helpers ───────────────────────────────────
# ── Translation helpers ───────────────────────────────────
def detect_language(text):
    url = f"{ENDPOINT}/detect?api-version=3.0"
    headers = {
        "Ocp-Apim-Subscription-Key":    API_KEY,
        "Ocp-Apim-Subscription-Region": LOCATION,
        "Content-type":                 "application/json",
    }
    res  = requests.post(url, headers=headers, json=[{"text": text}])
    data = res.json()
    return data[0]["language"]

def translate_text(text, source=None, target=None):
    if not source or source == "auto":
        source = detect_language(text) or "en"
    if not target or target == "auto":
        target = "en" if source == "ja" else "ja"
    url     = f"{ENDPOINT}/translate?api-version=3.0&from={source}&to={target}"
    headers = {
        "Ocp-Apim-Subscription-Key":    API_KEY,
        "Ocp-Apim-Subscription-Region": LOCATION,
        "Content-type":                 "application/json",
        "X-ClientTraceId":              str(uuid.uuid4()),
    }
    res = requests.post(url, headers=headers, json=[{"text": text}])
    return {
        "source_language": source,
        "target_language": target,
        "translated_text": res.json()[0]["translations"][0]["text"],
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
# TRANSLATE
# ════════════════════════════════════════════════════════════
# ── /translate エンドポイント ─────────────────────────────
@app.route("/translate", methods=["POST", "OPTIONS"])
def api_translate():
    if request.method == "OPTIONS":
        return "", 200
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        supabase.auth.get_user(token)
    except Exception:
        return jsonify({"error": "Invalid token"}), 401
    try:
        data   = request.json
        text   = data.get("text", "")
        source = data.get("source", "auto")  # フロントから"source"で来る
        target = data.get("target", "ja")    # フロントから"target"で来る
        if not text or len(text) > 1000:
            return jsonify({"error": "text required, max 1000 chars"}), 400
        result = translate_text(text, source, target)  # ← sourceとtargetを渡す
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ════════════════════════════════════════════════════════════
# FOLDERS
# ════════════════════════════════════════════════════════════

@app.route("/folders", methods=["GET"])
@require_auth
def get_folders():
    try:
        # Get folders with word count using Supabase
        res = supabase.table("folders") \
            .select("id, name, color, words(count)") \
            .eq("user_id", request.user_id) \
            .execute()

        folders = []
        for f in res.data:
            folders.append({
                "id":         f["id"],
                "name":       f["name"],
                "color":      f["color"],
                "word_count": f["words"][0]["count"] if f.get("words") else 0,
            })
        return jsonify(folders)
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
            return jsonify({"status": "error", "message": "Name required"}), 400
        if len(name) > 100:
            return jsonify({"status": "error", "message": "Name too long"}), 400
        res = supabase.table("folders").insert({
            "user_id": request.user_id,
            "name":    name,
            "color":   color,
        }).execute()
        folder = res.data[0]
        return jsonify({"status": "success", "id": folder["id"], "name": folder["name"], "color": folder["color"]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/delete_folder", methods=["POST"])
@require_auth
def delete_folder():
    try:
        folder_id = request.json.get("id")
        if not folder_id:
            return jsonify({"status": "error", "message": "id required"}), 400
        # Ownership enforced by RLS — only deletes if user_id matches
        supabase.table("words") \
            .update({"folder_id": None}) \
            .eq("folder_id", folder_id) \
            .eq("user_id", request.user_id) \
            .execute()
        supabase.table("folders") \
            .delete() \
            .eq("id", folder_id) \
            .eq("user_id", request.user_id) \
            .execute()
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
        supabase.table("folders") \
            .update({"name": new_name}) \
            .eq("id", folder_id) \
            .eq("user_id", request.user_id) \
            .execute()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/words_in_folder/<folder_id>", methods=["GET"])
@require_auth
def words_in_folder(folder_id):
    try:
        res = supabase.table("words") \
            .select("id, source_text, translated_text, source_lang, target_lang, phonetic, example, known") \
            .eq("folder_id", folder_id) \
            .eq("user_id", request.user_id) \
            .execute()
        return jsonify(res.data)
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
            return jsonify({"status": "error", "message": "word_id required"}), 400
        supabase.table("words") \
            .update({"folder_id": folder_id}) \
            .eq("id", word_id) \
            .eq("user_id", request.user_id) \
            .execute()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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
        if not source_text or not translated_text:
            return jsonify({"status": "error", "message": "Text required"}), 400
        if len(source_text) > 500 or len(translated_text) > 500:
            return jsonify({"status": "error", "message": "Text too long"}), 400
        res = supabase.table("words").insert({
            "user_id":         request.user_id,
            "source_text":     source_text,
            "translated_text": translated_text,
            "source_lang":     data.get("source_lang", ""),
            "target_lang":     data.get("target_lang", ""),
            "phonetic":        data.get("phonetic", ""),
            "example":         data.get("example", ""),
            "folder_id":       data.get("folder_id"),
            "known":           0,
        }).execute()
        return jsonify({"status": "success", "id": res.data[0]["id"]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/words", methods=["GET"])
@require_auth
def get_words():
    try:
        res = supabase.table("words") \
            .select("*, folders(name)") \
            .eq("user_id", request.user_id) \
            .order("id", desc=True) \
            .execute()
        words = []
        for w in res.data:
            words.append({
                **{k: v for k, v in w.items() if k != "folders"},
                "folder_name": w["folders"]["name"] if w.get("folders") else None,
                "quality": w.get("quality", 0) if w.get("quality") is not None else 0
            })
        return jsonify(words)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/update_word", methods=["POST"])
@require_auth
def update_word():
    try:
        data    = request.json
        word_id = data.get("id")
        if not word_id:
            return jsonify({"status": "error", "message": "id required"}), 400
        supabase.table("words") \
            .update({
                "source_text":     data.get("source_text", "").strip(),
                "translated_text": data.get("translated_text", "").strip(),
                "phonetic":        data.get("phonetic", ""),
                "example":         data.get("example", ""),
            }) \
            .eq("id", word_id) \
            .eq("user_id", request.user_id) \
            .execute()
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
            return jsonify({"status": "error", "message": "id and known required"}), 400
        supabase.table("words") \
            .update({"known": known}) \
            .eq("id", word_id) \
            .eq("user_id", request.user_id) \
            .execute()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/delete_word", methods=["POST"])
@require_auth
def delete_word():
    try:
        word_id = request.json.get("id")
        if not word_id:
            return jsonify({"status": "error", "message": "id required"}), 400
        supabase.table("words") \
            .delete() \
            .eq("id", word_id) \
            .eq("user_id", request.user_id) \
            .execute()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ════════════════════════════════════════════════════════════
# SRS
# ════════════════════════════════════════════════════════════

@app.route("/review_word", methods=["POST"])
@require_auth
def review_word():
    try:
        data    = request.json
        word_id = data.get("id")
        quality = data.get("quality")   # 1=Again, 3=Good, 5=Easy
        if word_id is None or quality is None:
            return jsonify({"status": "error", "message": "id and quality required"}), 400
        if not (0 <= int(quality) <= 5):
            return jsonify({"status": "error", "message": "quality must be 0–5"}), 400

        res  = supabase.table("words") \
            .select("repetition, interval, ease_factor") \
            .eq("id", word_id) \
            .eq("user_id", request.user_id) \
            .single() \
            .execute()
        word = res.data
        if not word:
            return jsonify({"status": "error", "message": "Word not found"}), 404

        repetition = word["repetition"] or 0
        interval   = word["interval"]   or 1
        ease       = word["ease_factor"] or 2.5
        quality    = int(quality)

        # SM-2
        if quality < 3:
            repetition = 0
            interval   = 1
        else:
            if repetition == 0:   interval = 1
            elif repetition == 1: interval = 6
            else:                 interval = round(interval * ease)
            repetition += 1

        ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        ease = max(1.3, ease)

        next_review = (datetime.now() + timedelta(days=interval)).strftime("%Y-%m-%d")

        # 3段階で保存: 0=Again, 1=Good, 2=Easy
        if quality >= 5:
            known = 2   # Easy ✔
        elif quality >= 3:
            known = 1   # Good ▲
        else:
            known = 0   # Again ✖

        supabase.table("words") \
            .update({
                "ease_factor": ease,
                "interval":    interval,
                "repetition":  repetition,
                "next_review": next_review,
                "known":       known,
                "quality":     quality,
            }) \
            .eq("id", word_id) \
            .eq("user_id", request.user_id) \
            .execute()

        return jsonify({"status": "success", "next_review": next_review, "interval": interval})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/due_words", methods=["GET"])
@require_auth
def due_words():
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        res   = supabase.table("words") \
            .select("*") \
            .eq("user_id", request.user_id) \
            .or_(f"next_review.is.null,next_review.lte.{today}") \
            .execute()
        return jsonify(res.data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)