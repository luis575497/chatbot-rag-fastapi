"""
config.py — Configuración central del chatbot RAG.

Todas las variables se leen desde el archivo .env.
Importa `settings` desde cualquier módulo:

    from config import settings
    print(settings.nombre_institucion)
"""
from __future__ import annotations

from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Institución ───────────────────────────────────────────
    nombre_institucion: str = "Biblioteca Digital"
    nombre_asistente:   str = "Asistente"
    bienvenida:         str = "¡Hola! ¿En qué te puedo ayudar?"

    # ── Modelos ───────────────────────────────────────────────
    modelo_llm:       str = "llama3"
    modelo_embedding: str = "nomic-embed-text"

    # ── RAG ───────────────────────────────────────────────────
    rag_k_faq:      int = 3
    rag_k_busqueda: int = 6

    # ── Sesiones ──────────────────────────────────────────────
    session_ttl_min: int = 30

    # ── CORS ──────────────────────────────────────────────────
    allowed_origins: List[str] = ["http://localhost:5500", "http://127.0.0.1:5500"]

    # ── Widget ────────────────────────────────────────────────
    widget_color_primario:       str = "#c9a84c"
    widget_color_primario_hover: str = "#e8c97a"
    widget_posicion:             str = "right"
    widget_chips:                str = "¿Cómo busco una tesis?|Documentos de tecnología|Recursos académicos"

    # ── Propiedades derivadas ─────────────────────────────────
    @property
    def session_ttl_sec(self) -> int:
        return self.session_ttl_min * 60

    @property
    def chips_lista(self) -> List[str]:
        return [c.strip() for c in self.widget_chips.split("|") if c.strip()]

    @field_validator("widget_posicion")
    @classmethod
    def validar_posicion(cls, v: str) -> str:
        if v not in ("right", "left"):
            return "right"
        return v


# Instancia global — importar desde aquí en todos los módulos
settings = Settings()