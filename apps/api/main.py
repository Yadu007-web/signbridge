from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
from dotenv import load_dotenv
import os

load_dotenv()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

app = FastAPI(title="SignBridge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class TokenRequest(BaseModel):
    room_name: str
    participant_name: str

@app.get("/")
def root():
    return {"status": "SignBridge API is running"}

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}

@app.post("/token")
async def get_token(req: TokenRequest):
    if not req.room_name or not req.participant_name:
        raise HTTPException(status_code=400, detail="room_name and participant_name required")
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(req.participant_name)
    token.with_name(req.participant_name)
    token.with_grants(api.VideoGrants(room_join=True, room=req.room_name))
    return {"token": token.to_jwt()}
