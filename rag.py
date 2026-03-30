from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from prompt import PROMPT_BASE
from typing import Generator

# Embeddings para la base vectorial
embedding = OllamaEmbeddings(model="nomic-embed-text")

# Base vectorial local
db = Chroma(persist_directory="./db", embedding_function=embedding)

# Modelo LLM con streaming activado
llm = OllamaLLM(model="llama3", streaming=True)

# Retriever — k=2 en lugar de k=3 (menos contexto = más rápido)
retriever = db.as_retriever(search_kwargs={"k": 2})

memorias: dict[str, list[str]] = {}

def preguntar_stream(pregunta: str, session_id: str):
    if session_id not in memorias:
        memorias[session_id] = []

    historial = memorias[session_id]

    docs = retriever.invoke(pregunta)
    context_text = "\n\n".join([doc.page_content for doc in docs])

    historial.append(f"Usuario: {pregunta}")
    historial = historial[-6:]
    memorias[session_id] = historial

    full_prompt = (
        f"{PROMPT_BASE}\n"
        f"Historial:\n{chr(10).join(historial)}\n\n"
        f"Contexto:\n{context_text}\n\n"
        f"Asistente:"
    )

    respuesta = ""

    for token in llm.stream(full_prompt):
        respuesta += token
        yield token

    historial.append(f"Asistente: {respuesta}")
    memorias[session_id] = historial[-6:]
