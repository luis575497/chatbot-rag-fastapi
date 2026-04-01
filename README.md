# 🧠 Chatbot RAG – Sistema de Consulta Inteligente

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3+-orange.svg)](https://www.langchain.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

Sistema de chatbot basado en arquitectura **RAG (Retrieval-Augmented Generation)** para bibliotecas y repositorios institucionales.

Permite responder consultas sobre colecciones documentales utilizando modelos de lenguaje (LLM), embeddings y una base vectorial.

---

## 🚀 Arquitectura General

```text
[Usuario]
   ↓
[Widget JS]
   ↓
[API REST - FastAPI (main.py)]
   ↓
[Clasificador de intención]
   ↓
 ┌───────────────┬───────────────┬───────────────┐
 │               │               │               │
FAQ           Búsqueda        Saludo           Otro
 │               │               │               │
 ↓               ↓               ↓               ↓
RAG (Chroma)   RAG (Chroma)   Respuesta fija   LLM directo
 │               │
 ↓               ↓
[LLM - Ollama]
   ↓
[Respuesta en streaming (SSE)]
```

---

## ⚙️ Tecnologías utilizadas

* FastAPI → API REST
* LangChain → Orquestación RAG
* ChromaDB → Base vectorial
* Ollama → Modelos LLM y embeddings
* Python → Backend
* JavaScript → Widget frontend

---

## 📂 Estructura del proyecto

```bash
project/
│
├── main.py            # API FastAPI
├── rag.py             # Motor RAG
├── load_data.py       # Ingesta de documentos
├── config.py          # Lectura de configuración (.env)
├── prompt.py          # Prompts del sistema
├── .env               # Configuración (NO subir a git)
├── documentos/        # Archivos fuente
├── db/                # Base vectorial Chroma
└── widget/            # Frontend embebible
```

---

## 🔧 Configuración mediante `.env`

El sistema se configura completamente mediante variables de entorno:

```env
# Institución
NOMBRE_INSTITUCION=Biblioteca Digital
NOMBRE_ASISTENTE=Asistente RAI
BIENVENIDA=¡Hola! Soy el asistente.

# Modelos
MODELO_LLM=llama3
MODELO_EMBEDDING=nomic-embed-text

# RAG
RAG_K_FAQ=3
RAG_K_BUSQUEDA=6

# Sesiones
SESSION_TTL_MIN=30

# CORS
ALLOWED_ORIGINS=["http://localhost:5500"]
```

⚠️ Importante: agregar `.env` al `.gitignore`.

---

## 🤖 Modelos requeridos (Ollama)

Antes de ejecutar el sistema, instala los modelos en Ollama:

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

* `llama3` → modelo de lenguaje principal (respuestas y clasificación)
* `nomic-embed-text` → modelo de embeddings para el RAG

---

## 📥 Ingesta de documentos

El script `load_data.py`:

* Lee archivos desde `/documentos`
* Soporta: PDF, DOCX, CSV, TXT, Excel
* Genera embeddings
* Almacena en Chroma (`/db`)

### Ejecutar:

```bash
python load_data.py
```

---

## 🧠 Funcionamiento del sistema

### 1. Recepción de la consulta

El widget envía:

```json
{
  "query": "¿Cómo buscar una tesis?",
  "session_id": "abc123"
}
```

---

### 2. Clasificación de intención

El sistema clasifica la consulta en:

* faq
* busqueda
* saludo
* otro

---

### 3. Flujo de decisión

| Intención | Acción                   |
| --------- | ------------------------ |
| saludo    | Respuesta fija           |
| faq       | RAG con pocos documentos |
| busqueda  | RAG con más contexto     |
| otro      | LLM sin RAG              |

---

### 4. RAG

Cuando aplica:

1. Embedding de la pregunta
2. Búsqueda en Chroma
3. Recuperación de documentos
4. Construcción de contexto
5. Envío al LLM

---

### 5. Generación de respuesta

* LLM: Ollama (`llama3`)
* Streaming activado
* Respuesta vía SSE

---

## 🔄 Memoria por sesión

* Basada en `session_id`
* Guarda últimos 10 mensajes
* Expira por TTL
* No persistente

---

## 🌐 API Endpoints

### POST `/chat`

Consulta principal (streaming)

```json
{
  "query": "texto",
  "session_id": "opcional"
}
```

---

### POST `/session/reset`

Reinicia la sesión

---

### GET `/widget-config`

Configuración del widget

---

### GET `/health`

Estado del sistema

---

## 🧪 Ejecución

### 1. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 2. Levantar API

```bash
uvicorn main:app --reload
```

### 3. Cargar datos

```bash
python load_data.py
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si tienes ideas para mejorar el sistema, por favor:

1. Haz un fork del proyecto
2. Crea una rama con tu función (`git checkout -b feature/nueva-funcionalidad`)
3. Realiza tus cambios y haz commit (`git commit -m 'Añadir nueva funcionalidad'`)
4. Sube la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

Para cambios importantes, abre primero un issue para discutir lo que te gustaría modificar.

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

## ⚠️ Limitaciones

* Memoria no persistente
* Clasificación dependiente del LLM
* No escalable sin Redis

---

## 🔧 Mejoras futuras

* Persistencia de sesiones (Redis)
* Métricas

---

## 👤 Autor

**Luis Enrique Lescano**
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue?style=flat&logo=linkedin)](https://www.linkedin.com/in/luis-enrique-lescano)
