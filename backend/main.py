from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os
import json
from typing import List, Optional
from pydantic import BaseModel
import sqlite3
import base64

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
if not os.path.exists("uploads"):
    os.makedirs("uploads")

# Database setup
def init_db():
    conn = sqlite3.connect('recordings.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            transcription TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# Models
class Recording(BaseModel):
    id: int
    filename: str
    transcription: Optional[str]
    created_at: str

class TranscriptionUpdate(BaseModel):
    transcription: str

@app.get("/")
def read_root():
    return {"message": "German Learning App API"}

@app.post("/api/recordings")
async def upload_recording(file: UploadFile = File(...)):
    # Save the audio file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"recording_{timestamp}.webm"
    filepath = os.path.join("uploads", filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    # Save to database
    conn = sqlite3.connect('recordings.db')
    c = conn.cursor()
    c.execute("INSERT INTO recordings (filename) VALUES (?)", (filename,))
    recording_id = c.lastrowid
    conn.commit()
    conn.close()

    return {"id": recording_id, "filename": filename}

@app.get("/api/recordings", response_model=List[Recording])
def get_recordings():
    conn = sqlite3.connect('recordings.db')
    c = conn.cursor()
    c.execute("SELECT * FROM recordings ORDER BY created_at DESC")
    recordings = []
    for row in c.fetchall():
        recordings.append({
            "id": row[0],
            "filename": row[1],
            "transcription": row[2],
            "created_at": row[3]
        })
    conn.close()
    return recordings

@app.get("/api/recordings/{recording_id}/audio")
def get_audio(recording_id: int):
    conn = sqlite3.connect('recordings.db')
    c = conn.cursor()
    c.execute("SELECT filename FROM recordings WHERE id = ?", (recording_id,))
    result = c.fetchone()
    conn.close()

    if not result:
        raise HTTPException(status_code=404, detail="Recording not found")

    filepath = os.path.join("uploads", result[0])
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Audio file not found")

    with open(filepath, "rb") as f:
        audio_data = f.read()

    # Return base64 encoded audio
    return {"audio": base64.b64encode(audio_data).decode('utf-8')}

@app.put("/api/recordings/{recording_id}/transcription")
def update_transcription(recording_id: int, data: TranscriptionUpdate):
    conn = sqlite3.connect('recordings.db')
    c = conn.cursor()
    c.execute("UPDATE recordings SET transcription = ? WHERE id = ?",
              (data.transcription, recording_id))
    conn.commit()
    conn.close()
    return {"message": "Transcription updated"}

@app.delete("/api/recordings/{recording_id}")
def delete_recording(recording_id: int):
    conn = sqlite3.connect('recordings.db')
    c = conn.cursor()

    # Get filename first
    c.execute("SELECT filename FROM recordings WHERE id = ?", (recording_id,))
    result = c.fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Delete file
    filepath = os.path.join("uploads", result[0])
    if os.path.exists(filepath):
        os.remove(filepath)

    # Delete from database
    c.execute("DELETE FROM recordings WHERE id = ?", (recording_id,))
    conn.commit()
    conn.close()

    return {"message": "Recording deleted"}
