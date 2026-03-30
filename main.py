from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from rag import preguntar_stream  # tu función de RAG

app = FastAPI()

# ─── CORS ────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # puerto de tu frontend
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],  # permite POST, GET, OPTIONS
    allow_headers=["*"],
)
# ─────────────────────────────────────────────────────────────────────────────

class Pregunta(BaseModel):
    query: str


def generar_sse(pregunta: str):
    """Genera tokens en formato SSE."""
    for token in preguntar_stream(pregunta):
        yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"


# ─── Preflight OPTIONS para CORS ─────────────────────────────────────────────
@app.options("/chat")
async def preflight_chat():
    """Responde al preflight para que el navegador permita el POST."""
    return JSONResponse(content={"status": "ok"})


# ─── Endpoint principal para chat ────────────────────────────────────────────
@app.post("/chat")
async def chat(p: Pregunta):
    return StreamingResponse(
        generar_sse(p.query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # importante para nginx
        },
    )


# ─── Endpoint de salud ───────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}
