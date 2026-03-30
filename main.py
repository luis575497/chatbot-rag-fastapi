from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from uuid import uuid4

from config import settings
from rag import preguntar_stream, reset_session

app = FastAPI(title=f"Chatbot RAG — {settings.nombre_institucion}")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────────────
class Pregunta(BaseModel):
    query:      str      = Field(..., min_length=1)
    session_id: str | None = None


# ── SSE generator ─────────────────────────────────────────────────────────────
def generar_sse(pregunta: str, session_id: str):
    for token in preguntar_stream(pregunta, session_id):
        yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(p: Pregunta):
    session_id = p.session_id or str(uuid4())
    return StreamingResponse(
        generar_sse(p.query, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "X-Session-Id":      session_id,
        },
    )


@app.post("/session/reset")
async def session_reset(p: Pregunta):
    if p.session_id:
        reset_session(p.session_id)
    return {"status": "ok", "session_id": p.session_id}


@app.get("/widget-config")
async def widget_config():
    """
    El widget puede consumir este endpoint para auto-configurarse
    sin hardcodear valores en el HTML de cada sitio.
    """
    return JSONResponse({
        "titulo":        settings.nombre_asistente,
        "bienvenida":    settings.bienvenida,
        "colorPrimario": settings.widget_color_primario,
        "colorHover":    settings.widget_color_primario_hover,
        "posicion":      settings.widget_posicion,
        "chips":         settings.chips_lista,
    })


@app.get("/health")
async def health():
    return {"status": "ok", "institucion": settings.nombre_institucion}