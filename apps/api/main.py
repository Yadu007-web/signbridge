from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api
from dotenv import load_dotenv
from typing import List
import numpy as np
import onnxruntime as ort
import json
import os

load_dotenv()

LIVEKIT_API_KEY    = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

app = FastAPI(title="SignBridge API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model and vocab on startup ──────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "signbridge_model.onnx")
VOCAB_PATH = os.path.join(os.path.dirname(__file__), "model", "vocab.json")

model_session = None
vocab_data     = None
idx_to_gloss   = {}
input_dim      = 21
num_frames     = 60

def load_model():
    global model_session, vocab_data, idx_to_gloss, input_dim, num_frames
    try:
        if not os.path.exists(MODEL_PATH):
            print(f"⚠️  Model not found at {MODEL_PATH}")
            return False
        if not os.path.exists(VOCAB_PATH):
            print(f"⚠️  Vocab not found at {VOCAB_PATH}")
            return False

        model_session = ort.InferenceSession(
            MODEL_PATH,
            providers=['CPUExecutionProvider']
        )
        vocab_data   = json.load(open(VOCAB_PATH))
        idx_to_gloss = {int(k): v for k, v in vocab_data['idx_to_gloss'].items()}
        input_dim    = vocab_data.get('input_dim',  21)
        num_frames   = vocab_data.get('num_frames', 60)

        print(f"✅ Model loaded — {len(idx_to_gloss)} signs")
        print(f"   Input: {num_frames} frames × {input_dim} features")
        print(f"   Signs: {list(idx_to_gloss.values())}")
        return True
    except Exception as e:
        print(f"❌ Model load error: {e}")
        return False

model_ready = load_model()


# ── Schemas ───────────────────────────────────────────────────
class TokenRequest(BaseModel):
    room_name:        str
    participant_name: str

class LandmarkFrame(BaseModel):
    landmarks: List[float]
    confidence: float
    timestamp:  int

class PredictRequest(BaseModel):
    frames:         List[LandmarkFrame]
    participant_id: str


# ── Helpers ───────────────────────────────────────────────────
def pad_or_trim(frames: np.ndarray, target: int) -> np.ndarray:
    """Make sequence exactly target frames long."""
    if len(frames) >= target:
        start = (len(frames) - target) // 2
        return frames[start:start + target]
    pad = np.zeros((target - len(frames), frames.shape[1]), dtype=np.float32)
    return np.vstack([frames, pad])

def prepare_input(frames: List[LandmarkFrame]) -> np.ndarray:
    """
    Convert landmark frames to model input.
    Adapts between different landmark dimensions automatically.
    """
    sequences = []
    for f in frames:
        lm = np.array(f.landmarks, dtype=np.float32)
        # Trim or pad to model's expected input_dim
        if len(lm) > input_dim:
            lm = lm[:input_dim]
        elif len(lm) < input_dim:
            lm = np.pad(lm, (0, input_dim - len(lm)))
        sequences.append(lm)

    arr = np.array(sequences, dtype=np.float32)
    arr = pad_or_trim(arr, num_frames)

    # Normalise
    mean = arr.mean()
    std  = arr.std() + 1e-8
    arr  = (arr - mean) / std

    return arr[np.newaxis, :, :]  # add batch dimension → (1, frames, features)


# ── Routes ────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status":      "SignBridge API running",
        "version":     "0.3.0",
        "model_ready": model_ready,
        "signs":       len(idx_to_gloss),
    }

@app.get("/health")
def health():
    return {
        "status":      "ok",
        "model_ready": model_ready,
        "num_signs":   len(idx_to_gloss),
    }

@app.post("/token")
async def get_token(req: TokenRequest):
    if not req.room_name or not req.participant_name:
        raise HTTPException(400, "room_name and participant_name required")
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(500, "LiveKit credentials not configured")
    token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(req.participant_name)
    token.with_name(req.participant_name)
    token.with_grants(api.VideoGrants(room_join=True, room=req.room_name))
    return {"token": token.to_jwt()}

@app.post("/predict")
async def predict(req: PredictRequest):
    if not req.frames:
        raise HTTPException(400, "No frames provided")

    # If model not loaded — return placeholder
    if not model_ready or model_session is None:
        return {
            "status":         "no_model",
            "predicted_gloss": None,
            "confidence":      0.0,
            "message":        "Model not loaded — place model files in apps/api/model/",
        }

    try:
        # Prepare input
        x = prepare_input(req.frames)

        # Run inference
        input_name  = model_session.get_inputs()[0].name
        output_name = model_session.get_outputs()[0].name
        logits      = model_session.run([output_name], {input_name: x})[0]

        # Softmax to get probabilities
        logits     = logits[0]
        exp_logits = np.exp(logits - logits.max())
        probs      = exp_logits / exp_logits.sum()

        # Top prediction
        top_idx    = int(np.argmax(probs))
        top_prob   = float(probs[top_idx])
        top_gloss  = idx_to_gloss.get(top_idx, "unknown")

        # Top 3 predictions
        top3_idx   = np.argsort(probs)[::-1][:3]
        top3       = [
            {"gloss": idx_to_gloss.get(int(i), "?"), "confidence": float(probs[i])}
            for i in top3_idx
        ]

        # Only return prediction if confidence is high enough
        CONFIDENCE_THRESHOLD = 0.35
        if top_prob < CONFIDENCE_THRESHOLD:
            return {
                "status":          "low_confidence",
                "predicted_gloss": None,
                "confidence":      round(top_prob, 3),
                "top3":            top3,
                "message":         "Confidence too low — keep signing",
            }

        return {
            "status":          "ok",
            "predicted_gloss": top_gloss,
            "confidence":      round(top_prob, 3),
            "top3":            top3,
            "participant_id":  req.participant_id,
        }

    except Exception as e:
        raise HTTPException(500, f"Inference error: {str(e)}")
