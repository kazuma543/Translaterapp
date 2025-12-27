import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS 
import requests
import uuid
import os
from dotenv import load_dotenv
import random
load_dotenv()

API_KEY = os.getenv("AZURE_API_KEY")
ENDPOINT = os.getenv("AZURE_ENDPOINT")
LOCATION = os.getenv("AZURE_LOCATION")

if not API_KEY or not ENDPOINT or not LOCATION:
    raise ValueError("環境変数が設定されていません。.envファイルを確認してください。")

app = Flask(__name__)
CORS(app)
# DB Setup
DB_NAME = "words.db"

def init_db():
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS words(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_text TEXT,
                translated_text TEXT,
                source_lang TEXT,
                target_lang TEXT,
                known INTEGER DEFAULT 0
            )
        """)
        conn.commit()
        conn.close()

init_db()

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

# Utility: Translate (最新版)
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

# API 1: POST /translate
@app.route("/translate", methods=["POST","OPTIONS"])
def api_translate():
    if request.method == 'OPTIONS':
        return '', 200
    try:
        data = request.json

        text = data.get("text")
        source = data.get("source")  # 任意
        target = data.get("target")  # 任意

        if not text:
         return jsonify({"error": "text is required"}), 400

        result = translate_text(text, source, target)

        return jsonify(result)
    except Exception as e:
        print(f"エラー発生: {str(e)}")  # ← エラーログ
        return jsonify({'error': str(e)}), 500
# API 2: POST /save_word
@app.route('/save_word', methods=['POST'])
def save_word():
    try:
        print("=== save_word called ===")
        data = request.json
        print(f"受信データ: {data}")
        
        source_text = data.get('source_text', '')
        translated_text = data.get('translated_text', '')
        source_lang = data.get('source_lang','')
        target_lang = data.get('target_lang','')
        known = 0
        
        print(f"source_text: '{source_text}'")
        print(f"translated_text: '{translated_text}'")
        print(f"source_lang: '{source_lang}'")
        print(f"target_lang: '{target_lang}'")
        print(f"known:'{known}'")


        
        if not source_text or not translated_text:
            print("エラー: テキストが空です")
            return jsonify({'status': 'error', 'message': 'テキストが空です'}), 400
        
        print("データベース接続開始...")
        conn = sqlite3.connect('words.db')
        cursor = conn.cursor()
        
        print("テーブル作成/確認...")
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                source_lang TEXT,
                target_lang TEXT,
                known INTEGER DEFAULT 0
            )
        ''')
        
        print("データ挿入中...")
        cursor.execute('''
            INSERT INTO words (source_text, translated_text, source_lang, target_lang, known)
        VALUES (?, ?, ?, ?,?)
        ''', (source_text, translated_text,source_lang,target_lang,known))
        
        conn.commit()
        word_id = cursor.lastrowid
        conn.close()
        
        print(f"保存成功 ID: {word_id}")
        
        response_data = {
            'status': 'success',
            'message': '保存しました',
            'id': word_id
        }
        print(f"返すデータ: {response_data}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"例外エラー: {str(e)}")
        print(f"エラータイプ: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# 重要: この関数の後に何もない(インデントが正しい)ことを確認
# API 3: GET /words
@app.route("/words", methods=["GET"])
def get_words():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT id, source_text, translated_text, source_lang, target_lang FROM words")
    rows = c.fetchall()
    conn.close()

    words = [{
        "id": row[0],
        "source_text": row[1],
        "translated_text": row[2],
        "source_lang": row[3],
        "target_lang": row[4]
    } for row in rows]

    return jsonify(words)

#Random words API
@app.route("/word_random", methods=["GET"])
def get_random_word():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""
        SELECT id, source_text, tranlated_text, know 
        FROM words 
        ORDER BY 
            CASE WHEN known = '0' THEN 0 ELES 1 END, 
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
        
    


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)

