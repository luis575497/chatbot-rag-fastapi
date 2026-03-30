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

RUTA_DOCUMENTOS = Path("./documentos")
TIPOS_SOPORTADOS = {".docx", ".pdf", ".csv", ".txt", ".xlsx", ".xls"}


def cargar_documento(path: Path) -> list[Document]:
    extension = path.suffix.lower()

    if extension == ".docx":
        docs = Docx2txtLoader(str(path)).load()
    elif extension == ".pdf":
        docs = PyPDFLoader(str(path)).load()
    elif extension == ".csv":
        docs = CSVLoader(file_path=str(path), encoding="utf-8").load()
    elif extension == ".txt":
        docs = TextLoader(file_path=str(path), encoding="utf-8").load()
    elif extension in {".xlsx", ".xls"}:
        df = pd.read_excel(path).fillna("")
        docs = []

        for index, row in df.iterrows():
            contenido = "\n".join(f"{col}: {valor}" for col, valor in row.items())
            docs.append(
                Document(
                    page_content=contenido,
                    metadata={"row": int(index) + 2},
                )
            )
    else:
        return []

    for doc in docs:
        doc.metadata["source"] = path.name
        doc.metadata["filetype"] = extension

    return docs


def cargar_todos_los_documentos(ruta_documentos: Path) -> list[Document]:
    documentos: list[Document] = []

    if not ruta_documentos.exists():
        raise FileNotFoundError(
            f"No existe la ruta de documentos: {ruta_documentos.resolve()}"
        )

    for path in sorted(ruta_documentos.iterdir()):
        if not path.is_file():
            continue

        extension = path.suffix.lower()
        if extension not in TIPOS_SOPORTADOS:
            print(f"⏭️ Omitido (tipo no soportado): {path.name}")
            continue

        docs = cargar_documento(path)
        documentos.extend(docs)
        print(f"📄 Cargado {path.name}: {len(docs)} documento(s)")

    return documentos


def main() -> None:
    documentos = cargar_todos_los_documentos(RUTA_DOCUMENTOS)
    print(f"📚 Total documentos cargados: {len(documentos)}")

    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    docs_divididos = splitter.split_documents(documentos)

    print(f"✂️ Fragmentos generados: {len(docs_divididos)}")

    embedding = OllamaEmbeddings(model="nomic-embed-text")

    db = Chroma.from_documents(
        documents=docs_divididos,
        embedding=embedding,
        persist_directory="./db",
    )

    print("✅ Base vectorial creada correctamente")


if __name__ == "__main__":
    main()
