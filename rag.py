from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from prompt import PROMPT_BASE
from typing import Generator

# Embeddings para la base vectorial
embedding = OllamaEmbeddings(model="llama3")

# Base vectorial local
db = Chroma(persist_directory="./db", embedding_function=embedding)

# Modelo LLM con streaming activado
llm = OllamaLLM(model="llama3", streaming=True)

# Retriever — k=2 en lugar de k=3 (menos contexto = más rápido)
retriever = db.as_retriever(search_kwargs={"k": 2})


def preguntar_stream(pregunta: str) -> Generator[str, None, None]:
    """Genera la respuesta token a token para streaming."""
    docs = retriever.invoke(pregunta)

    context_text = "\n\n".join([doc.page_content for doc in docs])

    full_prompt = (
        f"{PROMPT_BASE}\n"
        f"Contexto:\n{context_text}\n"
        f"Usuario: {pregunta}\n"
        f"Asistente:"
    )

    # .stream() devuelve los tokens uno a uno
    for token in llm.stream(full_prompt):
        yield token


def preguntar(pregunta: str) -> str:
    """Versión sin streaming, por si la necesitas en otro lugar."""
    return "".join(preguntar_stream(pregunta))