import re
from typing import Generator

from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM

from prompt import PROMPT_BASE

# Embeddings para la base vectorial
embedding = OllamaEmbeddings(model="nomic-embed-text")

# Base vectorial local
db = Chroma(persist_directory="./db", embedding_function=embedding)

# Modelo LLM con streaming activado
llm = OllamaLLM(model="llama3", streaming=True)

# Recuperar más candidatos para aumentar probabilidad de resultados útiles
retriever = db.as_retriever(search_kwargs={"k": 6})

memorias: dict[str, list[str]] = {}
PATRON_CONSULTA_GENERAL = re.compile(
    r"\b(hora|horario|abre|abren|cierr[ae]n?|direcci[oó]n|ubicaci[oó]n|"
    r"tel[eé]fono|contacto|correo|email|servicios?|pr[eé]stamo|carnet)\b",
    re.IGNORECASE,
)
PATRON_BUSQUEDA_DOCUMENTAL = re.compile(
    r"\b(tesis|art[íi]culo|articulos|documentos?|libros?|autor|handle|enlace|"
    r"investigaci[oó]n|repositorio|recurso)\b",
    re.IGNORECASE,
)


def _deduplicar_docs(docs: list) -> list:
    vistos: set[tuple[str, str, str]] = set()
    unicos: list = []

    for doc in docs:
        clave = (
            str(doc.metadata.get("source", "")),
            str(doc.metadata.get("row", "")),
            doc.page_content.strip(),
        )
        if clave in vistos:
            continue
        vistos.add(clave)
        unicos.append(doc)

    return unicos


def _formatear_contexto(docs) -> str:
    if not docs:
        return "Sin resultados recuperados."

    bloques: list[str] = []
    for i, doc in enumerate(docs, start=1):
        source = doc.metadata.get("source", "No disponible")
        row = doc.metadata.get("row", "No disponible")
        filetype = doc.metadata.get("filetype", "No disponible")
        bloques.append(
            (
                f"[Resultado {i}]\n"
                f"source: {source}\n"
                f"row: {row}\n"
                f"filetype: {filetype}\n"
                f"contenido:\n{doc.page_content.strip()}"
            )
        )

    return "\n\n".join(bloques)


def _es_consulta_general(texto: str) -> bool:
    return bool(PATRON_CONSULTA_GENERAL.search(texto)) and not bool(
        PATRON_BUSQUEDA_DOCUMENTAL.search(texto)
    )


def _respuesta_consulta_general(pregunta: str) -> str:
    return (
        "Entiendo que esta es una consulta general de la biblioteca "
        f"(\"{pregunta}\"). En este momento no tengo la tabla operativa "
        "de horarios/contacto cargada en esta base.\n\n"
        "Si quieres, te ayudo con recursos del repositorio (tesis, artículos, "
        "libros) o puedo orientarte para contactar a la biblioteca."
    )


def reset_session(session_id: str) -> None:
    memorias.pop(session_id, None)


def preguntar_stream(pregunta: str, session_id: str) -> Generator[str, None, None]:
    if session_id not in memorias:
        memorias[session_id] = []

    historial = memorias[session_id]

    docs = _deduplicar_docs(retriever.invoke(pregunta))
    context_text = _formatear_contexto(docs)

    historial.append(f"Usuario: {pregunta}")
    historial = historial[-6:]
    memorias[session_id] = historial

    if _es_consulta_general(pregunta):
        respuesta_general = _respuesta_consulta_general(pregunta)
        historial.append(f"Asistente: {respuesta_general}")
        memorias[session_id] = historial[-6:]
        yield respuesta_general
        return

    full_prompt = (
        f"{PROMPT_BASE}\n"
        "Instrucción adicional:\n"
        "- Si el usuario pide tesis/documentos, prioriza listar resultados concretos del contexto.\n"
        "- No inventes títulos/autor/enlaces que no estén en el contexto.\n\n"
        f"Historial:\n{chr(10).join(historial)}\n\n"
        f"Contexto recuperado:\n{context_text}\n\n"
        "Asistente:"
    )

    respuesta = ""

    for token in llm.stream(full_prompt):
        respuesta += token
        yield token

    historial.append(f"Asistente: {respuesta}")
    memorias[session_id] = historial[-6:]
