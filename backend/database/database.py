import os
import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__)))
DB_PATH = os.path.join(DB_DIR, "copilot.db")

def get_db_connection():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resume_filename TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            ats_score INTEGER NOT NULL,
            job_role TEXT NOT NULL,
            report_data TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def save_analysis(resume_filename: str, ats_score: int, job_role: str, report_data: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO analyses (resume_filename, timestamp, ats_score, job_role, report_data)
        VALUES (?, ?, ?, ?, ?)
    """, (resume_filename, timestamp, ats_score, job_role, json.dumps(report_data)))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()
    return inserted_id

def get_all_analyses() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, resume_filename, timestamp, ats_score, job_role FROM analyses ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_analysis_by_id(analysis_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        data = dict(row)
        data["report_data"] = json.loads(data["report_data"])
        return data
    return None

def get_latest_analysis_by_name_or_file(candidate_name: str, base_filename: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    
    import re
    def get_clean_basename(fname):
        name_part, _ = os.path.splitext(fname)
        # remove timestamp suffix like _1234567890
        name_part = re.sub(r'_\d{10,}$', '', name_part)
        return name_part.lower().strip()
        
    clean_target_basename = get_clean_basename(base_filename)
    
    for row in rows:
        data = dict(row)
        try:
            report_data = json.loads(data["report_data"])
            resume_info = report_data.get("resume_info", {})
            name_in_db = resume_info.get("name", "")
            
            # Check candidate name match
            if name_in_db and candidate_name and name_in_db.lower().strip() == candidate_name.lower().strip():
                data["report_data"] = report_data
                return data
                
            # Check filename match
            db_filename = data.get("resume_filename", "")
            if db_filename:
                clean_db_basename = get_clean_basename(db_filename)
                if clean_db_basename == clean_target_basename:
                    data["report_data"] = report_data
                    return data
        except Exception:
            continue
    return None

def delete_analysis_by_id(analysis_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
    conn.commit()
    conn.close()

# Initialize on import
init_db()
