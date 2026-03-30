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


def preguntar_stream(pregunta: str, session_id: str) -> Generator[str, None, None]:
    if session_id not in memorias:
        memorias[session_id] = []

    historial = memorias[session_id]

    docs = retriever.invoke(pregunta)
    context_text = _formatear_contexto(docs)

    historial.append(f"Usuario: {pregunta}")
    historial = historial[-6:]
    memorias[session_id] = historial

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
