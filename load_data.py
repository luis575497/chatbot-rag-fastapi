"""
load_data.py — Carga documentos en el vectorstore.
Lee el modelo de embeddings desde settings.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_community.document_loaders import (
    CSVLoader,
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
)
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings

RUTA_DOCUMENTOS  = Path("./documentos")
TIPOS_SOPORTADOS = {".docx", ".pdf", ".csv", ".txt", ".xlsx", ".xls"}


def cargar_documento(path: Path) -> list[Document]:
    ext = path.suffix.lower()

    if ext == ".docx":
        docs = Docx2txtLoader(str(path)).load()
    elif ext == ".pdf":
        docs = PyPDFLoader(str(path)).load()
    elif ext == ".csv":
        docs = CSVLoader(file_path=str(path), encoding="utf-8").load()
    elif ext == ".txt":
        docs = TextLoader(file_path=str(path), encoding="utf-8").load()
    elif ext in {".xlsx", ".xls"}:
        df   = pd.read_excel(path).fillna("")
        docs = []
        for idx, row in df.iterrows():
            contenido = "\n".join(f"{col}: {val}" for col, val in row.items())
            docs.append(Document(
                page_content=contenido,
                metadata={"row": int(idx) + 2},
            ))
    else:
        return []

    for doc in docs:
        doc.metadata["source"]   = path.name
        doc.metadata["filetype"] = ext

    return docs


def cargar_todos(ruta: Path) -> list[Document]:
    if not ruta.exists():
        raise FileNotFoundError(f"No existe la ruta: {ruta.resolve()}")

    documentos: list[Document] = []
    for path in sorted(ruta.iterdir()):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TIPOS_SOPORTADOS:
            print(f"⏭️  Omitido (tipo no soportado): {path.name}")
            continue
        docs = cargar_documento(path)
        documentos.extend(docs)
        print(f"📄 Cargado {path.name}: {len(docs)} fragmento(s)")

    return documentos


def main() -> None:
    print(f"🏛️  Institución : {settings.nombre_institucion}")
    print(f"🤖 Embedding   : {settings.modelo_embedding}")
    print(f"📂 Documentos  : {RUTA_DOCUMENTOS.resolve()}\n")

    documentos = cargar_todos(RUTA_DOCUMENTOS)
    print(f"\n📚 Total documentos cargados: {len(documentos)}")

    splitter      = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    docs_divididos = splitter.split_documents(documentos)
    print(f"✂️  Fragmentos generados     : {len(docs_divididos)}")

    # Usa el modelo de embeddings definido en .env
    emb = OllamaEmbeddings(model=settings.modelo_embedding)

    Chroma.from_documents(
        documents=docs_divididos,
        embedding=emb,
        persist_directory="./db",
    )
    print("✅ Base vectorial creada correctamente en ./db")


if __name__ == "__main__":
    main()