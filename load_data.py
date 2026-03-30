from langchain_community.document_loaders import Docx2txtLoader
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os

RUTA_DOCUMENTOS = "./documentos"

documentos = []

for archivo in os.listdir(RUTA_DOCUMENTOS):
    if archivo.endswith(".docx"):
        path = os.path.join(RUTA_DOCUMENTOS, archivo)

        loader = Docx2txtLoader(path)
        docs = loader.load()

        for doc in docs:
            doc.metadata["source"] = archivo

        documentos.extend(docs)

print(f"📄 Documentos cargados: {len(documentos)}")

splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=30
)

docs_divididos = splitter.split_documents(documentos)

print(f"✂️ Fragmentos generados: {len(docs_divididos)}")

embedding = OllamaEmbeddings(model="llama3")

db = Chroma.from_documents(
    docs_divididos,
    embedding,
    persist_directory="./db"
)

db.persist()

print("✅ Base vectorial creada correctamente")