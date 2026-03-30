from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from uuid import uuid4
from rag import preguntar_stream, reset_session

app = FastAPI()

ALLOWED_ORIGINS = [
    "http://localhost:5500",
]

# CORS correcto
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 👇 ahora incluye session_id
class Pregunta(BaseModel):
    query: str = Field(..., min_length=1)
    session_id: str | None = None


def generar_sse(pregunta: str, session_id: str):
    for token in preguntar_stream(pregunta, session_id):
        yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/chat")
async def chat(p: Pregunta):
    session_id = p.session_id or str(uuid4())
    return StreamingResponse(
        generar_sse(p.query, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Session-Id": session_id,
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/session/reset")
async def session_reset(p: Pregunta):
    if p.session_id:
        reset_session(p.session_id)
    return {"status": "ok"}
