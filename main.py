from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from rag import preguntar_stream

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
    query: str
    session_id: str


def generar_sse(pregunta: str, session_id: str):
    for token in preguntar_stream(pregunta, session_id):
        yield f"data: {token}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/chat")
async def chat(p: Pregunta):
    return StreamingResponse(
        generar_sse(p.query, p.session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    return {"status": "ok"}