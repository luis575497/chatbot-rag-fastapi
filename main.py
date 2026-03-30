from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from rag import preguntar_stream  # tu función de RAG

app = FastAPI()

# ─── CORS ────────────────────────────────────────────────────────────────────
# Para desarrollo local, permitir cualquier origen evita errores de preflight
# cuando el frontend corre en puertos dinámicos (por ejemplo :5173, :4173, etc.).
# Como este endpoint no usa cookies/sesión, dejamos credenciales en False.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
