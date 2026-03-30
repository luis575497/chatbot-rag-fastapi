"""
rag.py — Motor RAG parametrizado con settings.
"""
from __future__ import annotations

import time
from typing import Generator

from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM

from config import settings
from prompt import (
    PROMPT_CLASIFICAR,
    PROMPT_FAQ,
    PROMPT_BUSQUEDA,
    PROMPT_OTRO,
    RESPUESTA_SALUDO,
)

# ── Modelos (leídos desde settings) ──────────────────────────────────────────
embedding = OllamaEmbeddings(model=settings.modelo_embedding)
db        = Chroma(persist_directory="./db", embedding_function=embedding)

llm     = OllamaLLM(model=settings.modelo_llm, streaming=True)
llm_cls = OllamaLLM(model=settings.modelo_llm, streaming=False)

retriever_faq      = db.as_retriever(search_kwargs={"k": settings.rag_k_faq})
retriever_busqueda = db.as_retriever(search_kwargs={"k": settings.rag_k_busqueda})

# ── Sesiones ──────────────────────────────────────────────────────────────────
_sesiones: dict[str, dict] = {}


def _get_session(session_id: str) -> dict:
    ahora = time.time()
    sesion = _sesiones.get(session_id)
    if sesion is None or (ahora - sesion["last_active"]) > settings.session_ttl_sec:
        _sesiones[session_id] = {"history": [], "last_active": ahora}
    else:
        _sesiones[session_id]["last_active"] = ahora
    return _sesiones[session_id]


def reset_session(session_id: str) -> None:
    _sesiones.pop(session_id, None)


def _purgar_expiradas() -> None:
    ahora = time.time()
    expiradas = [
        sid for sid, d in _sesiones.items()
        if ahora - d["last_active"] > settings.session_ttl_sec
    ]
    for sid in expiradas:
        del _sesiones[sid]


# ── Clasificación semántica ───────────────────────────────────────────────────
_INTENCIONES_VALIDAS = {"faq", "busqueda", "saludo", "otro"}


def _clasificar_intencion(mensaje: str) -> str:
    prompt = PROMPT_CLASIFICAR.format(mensaje=mensaje)
    try:
        resultado = llm_cls.invoke(prompt).strip().lower()
        primera   = resultado.split()[0] if resultado else "otro"
        return primera if primera in _INTENCIONES_VALIDAS else "otro"
    except Exception:
        return "otro"


# ── Helpers de contexto ───────────────────────────────────────────────────────
def _deduplicar(docs: list) -> list:
    vistos: set = set()
    unicos = []
    for doc in docs:
        clave = (
            doc.metadata.get("source", ""),
            doc.metadata.get("row", ""),
            doc.page_content.strip()[:120],
        )
        if clave not in vistos:
            vistos.add(clave)
            unicos.append(doc)
    return unicos


def _formatear_contexto(docs: list) -> str:
    if not docs:
        return "Sin resultados recuperados."
    bloques = []
    for i, doc in enumerate(docs, 1):
        bloques.append(
            f"[Doc {i}]\n"
            f"source: {doc.metadata.get('source', 'N/D')}\n"
            f"row: {doc.metadata.get('row', 'N/D')}\n"
            f"contenido:\n{doc.page_content.strip()}"
        )
    return "\n\n".join(bloques)


# ── Función principal ─────────────────────────────────────────────────────────
def preguntar_stream(pregunta: str, session_id: str) -> Generator[str, None, None]:
    _purgar_expiradas()
    sesion    = _get_session(session_id)
    historial = sesion["history"]
    hist_texto = "\n".join(historial[-10:]) if historial else "(sin historial previo)"

    intencion = _clasificar_intencion(pregunta)
    historial.append(f"Usuario: {pregunta}")

    # Saludo → respuesta estática, sin LLM ni RAG
    if intencion == "saludo":
        historial.append(f"Asistente: {RESPUESTA_SALUDO}")
        sesion["history"] = historial[-10:]
        yield RESPUESTA_SALUDO
        return

    # FAQ → RAG con k pequeño + prompt FAQ
    if intencion == "faq":
        docs        = _deduplicar(retriever_faq.invoke(pregunta))
        contexto    = _formatear_contexto(docs)
        full_prompt = PROMPT_FAQ.format(
            contexto=contexto,
            historial=hist_texto,
            pregunta=pregunta,
        )

    # Búsqueda → RAG con k grande + prompt BUSQUEDA
    elif intencion == "busqueda":
        docs        = _deduplicar(retriever_busqueda.invoke(pregunta))
        contexto    = _formatear_contexto(docs)
        full_prompt = PROMPT_BUSQUEDA.format(
            contexto=contexto,
            historial=hist_texto,
            pregunta=pregunta,
        )

    # Otro → LLM directo sin RAG
    else:
        full_prompt = PROMPT_OTRO.format(
            historial=hist_texto,
            pregunta=pregunta,
        )

    respuesta = ""
    try:
        for token in llm.stream(full_prompt):
            respuesta += token
            yield token
    except GeneratorExit:
        pass
    finally:
        if respuesta:
            historial.append(f"Asistente: {respuesta}")
        sesion["history"] = historial[-10:]