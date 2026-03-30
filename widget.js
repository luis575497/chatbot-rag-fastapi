/*!
 * RAI Chat Widget v1.0
 * Widget embebible para el chatbot RAG de la Biblioteca Digital.
 * Uso: <script src="widget.js"></script>
 *
 * Configuración opcional antes de cargar el script:
 *   window.RAI_CONFIG = {
 *     apiUrl: "http://localhost:8000/chat",   // URL de tu backend
 *     titulo: "Asistente RAI",
 *     placeholder: "Escribe tu pregunta...",
 *     bienvenida: "¡Hola! ¿En qué te puedo ayudar?",
 *     posicion: "right"   // "right" | "left"
 *   };
 */
(function () {
  "use strict";

  // ── Configuración con defaults ──────────────────────────────────────────
  const CFG = Object.assign({
    apiUrl:     "http://localhost:8000/chat",
    titulo:     "Asistente RAI",
    placeholder:"Escribe tu pregunta...",
    bienvenida: "¡Hola! Soy el asistente de la Biblioteca Digital. ¿En qué te puedo ayudar hoy?",
    posicion:   "right"
  }, window.RAI_CONFIG || {});

  // ── Estilos ──────────────────────────────────────────────────────────────
  const CSS = `
    :root {
      --rai-gold: #c9a84c;
      --rai-gold-l: #e8c97a;
      --rai-bg: #14130f;
      --rai-surface: #1e1c17;
      --rai-border: #2e2b25;
      --rai-text: #e8e4da;
      --rai-muted: #7a7468;
      --rai-user-bg: #c9a84c;
      --rai-user-text: #0f0e0c;
      --rai-bot-bg: #252219;
      --rai-radius: 18px;
      --rai-w: 380px;
      --rai-h: 520px;
    }

    #rai-fab {
      position: fixed;
      bottom: 28px;
      ${CFG.posicion === "left" ? "left: 28px" : "right: 28px"};
      width: 58px; height: 58px;
      border-radius: 50%;
      background: var(--rai-gold);
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px rgba(201,168,76,0.35);
      transition: transform 0.2s, background 0.2s;
      z-index: 99998;
    }
    #rai-fab:hover { background: var(--rai-gold-l); transform: scale(1.07); }
    #rai-fab svg { transition: transform 0.3s; }
    #rai-fab.open svg { transform: rotate(45deg); }

    /* Puntito de notificación */
    #rai-fab::after {
      content: '';
      position: absolute;
      top: 6px; right: 6px;
      width: 10px; height: 10px;
      background: #4ade80;
      border-radius: 50%;
      border: 2px solid var(--rai-bg);
      animation: rai-pulse 2s infinite;
    }
    #rai-fab.open::after { display: none; }

    @keyframes rai-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50%       { transform: scale(1.3); opacity: 0.7; }
    }

    #rai-window {
      position: fixed;
      bottom: 100px;
      ${CFG.posicion === "left" ? "left: 28px" : "right: 28px"};
      width: var(--rai-w);
      height: var(--rai-h);
      background: var(--rai-bg);
      border: 1px solid var(--rai-border);
      border-radius: var(--rai-radius);
      display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.7);
      z-index: 99999;
      overflow: hidden;
      font-family: 'DM Sans', -apple-system, sans-serif;
      transform: scale(0.92) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), opacity 0.2s;
    }
    #rai-window.visible {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    #rai-header {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 1rem 1.2rem;
      border-bottom: 1px solid var(--rai-border);
      background: var(--rai-surface);
      flex-shrink: 0;
    }
    #rai-avatar {
      width: 36px; height: 36px;
      background: var(--rai-gold);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    #rai-header-info { flex: 1; }
    #rai-header-title {
      font-size: 0.92rem; font-weight: 500;
      color: var(--rai-text);
      letter-spacing: 0.02em;
    }
    #rai-header-status {
      font-size: 0.72rem;
      color: #4ade80;
      letter-spacing: 0.04em;
    }
    #rai-close {
      background: none; border: none; cursor: pointer;
      color: var(--rai-muted); padding: 4px;
      border-radius: 6px; transition: color 0.15s, background 0.15s;
    }
    #rai-close:hover { color: var(--rai-text); background: var(--rai-border); }

    /* Mensajes */
    #rai-messages {
      flex: 1; overflow-y: auto;
      padding: 1.2rem;
      display: flex; flex-direction: column; gap: 0.8rem;
      scroll-behavior: smooth;
    }
    #rai-messages::-webkit-scrollbar { width: 4px; }
    #rai-messages::-webkit-scrollbar-track { background: transparent; }
    #rai-messages::-webkit-scrollbar-thumb { background: var(--rai-border); border-radius: 4px; }

    .rai-msg {
      max-width: 82%;
      padding: 0.7rem 1rem;
      border-radius: 14px;
      font-size: 0.88rem;
      line-height: 1.55;
      animation: rai-fadein 0.2s ease;
    }
    @keyframes rai-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }

    .rai-msg.user {
      align-self: flex-end;
      background: var(--rai-user-bg);
      color: var(--rai-user-text);
      border-bottom-right-radius: 4px;
      font-weight: 400;
    }
    .rai-msg.bot {
      align-self: flex-start;
      background: var(--rai-bot-bg);
      color: var(--rai-text);
      border: 1px solid var(--rai-border);
      border-bottom-left-radius: 4px;
    }

    /* Typing indicator */
    .rai-typing {
      display: flex; gap: 4px; padding: 0.8rem 1rem;
      align-self: flex-start;
      background: var(--rai-bot-bg);
      border: 1px solid var(--rai-border);
      border-radius: 14px; border-bottom-left-radius: 4px;
    }
    .rai-typing span {
      width: 6px; height: 6px;
      background: var(--rai-muted);
      border-radius: 50%;
      animation: rai-bounce 1.2s infinite;
    }
    .rai-typing span:nth-child(2) { animation-delay: 0.2s; }
    .rai-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes rai-bounce {
      0%,60%,100% { transform: translateY(0); }
      30%         { transform: translateY(-5px); }
    }

    /* Input */
    #rai-form {
      display: flex; gap: 0.5rem;
      padding: 1rem;
      border-top: 1px solid var(--rai-border);
      background: var(--rai-surface);
      flex-shrink: 0;
    }
    #rai-input {
      flex: 1;
      background: var(--rai-bg);
      border: 1px solid var(--rai-border);
      border-radius: 10px;
      padding: 0.6rem 0.9rem;
      color: var(--rai-text);
      font-family: inherit;
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.2s;
      resize: none;
    }
    #rai-input:focus { border-color: var(--rai-gold); }
    #rai-input::placeholder { color: var(--rai-muted); }
    #rai-send {
      width: 38px; height: 38px;
      background: var(--rai-gold);
      border: none; border-radius: 10px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s, transform 0.15s;
      align-self: flex-end;
    }
    #rai-send:hover { background: var(--rai-gold-l); transform: scale(1.05); }
    #rai-send:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    /* Sugerencias */
    #rai-suggestions {
      display: flex; flex-wrap: wrap; gap: 0.4rem;
      padding: 0 1.2rem 0.8rem;
    }
    .rai-chip {
      background: var(--rai-surface);
      border: 1px solid var(--rai-border);
      border-radius: 20px;
      padding: 0.3rem 0.8rem;
      font-size: 0.78rem;
      color: var(--rai-muted);
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .rai-chip:hover { border-color: var(--rai-gold); color: var(--rai-gold); }

    @media (max-width: 440px) {
      #rai-window { width: calc(100vw - 24px); ${CFG.posicion === "left" ? "left:12px" : "right:12px"}; }
    }
  `;

  // ── Inyectar estilos ─────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Google Fonts (si no está ya cargada) ─────────────────────────────────
  if (!document.querySelector('link[href*="DM+Sans"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap";
    document.head.appendChild(link);
  }

  // ── HTML del widget ──────────────────────────────────────────────────────
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <button id="rai-fab" aria-label="Abrir asistente">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f0e0c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </button>

    <div id="rai-window" role="dialog" aria-label="${CFG.titulo}">
      <div id="rai-header">
        <div id="rai-avatar">📚</div>
        <div id="rai-header-info">
          <div id="rai-header-title">${CFG.titulo}</div>
          <div id="rai-header-status">● En línea</div>
        </div>
        <button id="rai-close" aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div id="rai-messages"></div>

      <div id="rai-suggestions">
        <button class="rai-chip">¿Cómo busco una tesis?</button>
        <button class="rai-chip">Documentos de tecnología</button>
        <button class="rai-chip">¿Tienen acceso remoto?</button>
      </div>

      <div id="rai-form">
        <textarea id="rai-input" rows="1" placeholder="${CFG.placeholder}"></textarea>
        <button id="rai-send" aria-label="Enviar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f0e0c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(wrapper);

  // ── Referencias ──────────────────────────────────────────────────────────
  const fab      = document.getElementById("rai-fab");
  const win      = document.getElementById("rai-window");
  const closeBtn = document.getElementById("rai-close");
  const messages = document.getElementById("rai-messages");
  const input    = document.getElementById("rai-input");
  const sendBtn  = document.getElementById("rai-send");
  const chips    = document.querySelectorAll(".rai-chip");

  // ── Estado ───────────────────────────────────────────────────────────────
  let isOpen    = false;
  let isLoading = false;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle("visible", isOpen);
    fab.classList.toggle("open", isOpen);
    if (isOpen) {
      setTimeout(() => input.focus(), 250);
      // Ocultar sugerencias si ya hay mensajes
      if (messages.children.length > 1) {
        document.getElementById("rai-suggestions").style.display = "none";
      }
    }
  }

  function addMessage(text, role) {
    const div = document.createElement("div");
    div.className = `rai-msg ${role}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function getSessionId() {
    let id = localStorage.getItem("rai_session");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("rai_session", id);
      }
    return id;
  }

  function addTyping() {
    const div = document.createElement("div");
    div.className = "rai-typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  // ── Mensaje de bienvenida ────────────────────────────────────────────────
  addMessage(CFG.bienvenida, "bot");

  // ── Enviar pregunta con streaming SSE ────────────────────────────────────
  async function enviar(texto) {
    if (!texto.trim() || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    document.getElementById("rai-suggestions").style.display = "none";

    addMessage(texto, "user");
    input.value = "";
    input.style.height = "auto";

    const typing = addTyping();

    try {
      const res = await fetch(CFG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: texto, 
          session_id: getSessionId()
        }),
      });

      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);

      // Reemplazar typing por burbuja vacía del bot
      typing.remove();
      const botBubble = addMessage("", "bot");

      // Leer stream SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // guardar línea incompleta

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const token = line.slice(6);
          if (token === "[DONE]") break;
          botBubble.textContent += token;
          messages.scrollTop = messages.scrollHeight;
        }
      }

    } catch (err) {
      typing.remove();
      addMessage("⚠️ No pude conectarme al servidor. ¿Está corriendo el backend?", "bot");
      console.error("[RAI Widget]", err);
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ── Eventos ──────────────────────────────────────────────────────────────
  fab.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  sendBtn.addEventListener("click", () => enviar(input.value));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(input.value);
    }
  });

  // Auto-resize del textarea
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 96) + "px";
  });

  // Chips de sugerencias
  chips.forEach(chip => {
    chip.addEventListener("click", () => enviar(chip.textContent));
  });

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) toggleChat();
  });

})();