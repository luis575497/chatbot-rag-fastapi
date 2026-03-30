/*!
 * RAI Chat Widget v2.2
 * ─────────────────────────────────────────────────────────────
 * Auto-configuración: al arrancar, el widget llama a
 * GET /widget-config en el backend y aplica colores, textos
 * y chips desde el .env de la institución.
 *
 * Uso mínimo (todo viene del servidor):
 *   <script src="widget.js" data-api="https://mi-backend.com"></script>
 *
 * Uso con overrides locales (prevalecen sobre el servidor):
 *   <script>
 *     window.RAI_CONFIG = {
 *       apiBase:  "https://mi-backend.com",  // obligatorio si no usas data-api
 *       posicion: "left",                    // override opcional
 *     };
 *   </script>
 *   <script src="widget.js"></script>
 * ─────────────────────────────────────────────────────────────
 */
(function () {
  "use strict";

  // ── API base URL ──────────────────────────────────────────────────────────
  // Prioridad: window.RAI_CONFIG.apiBase > atributo data-api > localhost
  const scriptTag = document.currentScript;
  const dataApi   = scriptTag ? scriptTag.getAttribute("data-api") : null;
  const userCfg   = window.RAI_CONFIG || {};

  const API_BASE = (userCfg.apiBase || dataApi || "http://localhost:8000").replace(/\/$/, "");

  const STORAGE_KEY   = "rai_session";
  const SESSION_TTL   = (userCfg.sessionTtlMs) || 30 * 60 * 1000;

  // ── Defaults mientras carga la config del servidor ────────────────────────
  let CFG = {
    titulo:        userCfg.titulo        || "Asistente",
    bienvenida:    userCfg.bienvenida    || "¡Hola! ¿En qué te puedo ayudar?",
    colorPrimario: userCfg.colorPrimario || "#c9a84c",
    colorHover:    userCfg.colorHover    || "#e8c97a",
    posicion:      userCfg.posicion      || "right",
    chips:         userCfg.chips         || ["¿Cómo busco una tesis?", "Documentos académicos"],
    placeholder:   userCfg.placeholder   || "Escribe tu pregunta...",
  };

  // ── Markdown renderer ─────────────────────────────────────────────────────
  function _mdToHtml(text) {
    if (!text) return "";
    const esc = s => s
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const inline = raw => {
      let s = esc(raw);
      s = s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a||b}</strong>`);
      s = s.replace(/(?<!\w)\*([^*]+?)\*(?!\w)|(?<!\w)_([^_]+?)_(?!\w)/g,
        (_, a, b) => `<em>${a||b}</em>`);
      s = s.replace(/`([^`]+?)`/g, (_, c) => `<code>${c}</code>`);
      s = s.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
        (_, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
      s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)"]+)/g,
        (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
      return s;
    };

    const lines = text.split("\n");
    let html = "", inList = false, listType = "";
    const closeList = () => { if (inList) { html += `</${listType}>`; inList = false; listType = ""; } };

    for (const line of lines) {
      if (/^[-*_]{3,}\s*$/.test(line)) { closeList(); html += "<hr/>"; continue; }
      const h = line.match(/^(#{1,3})\s+(.+)$/);
      if (h) { closeList(); const lvl = h[1].length + 2; html += `<h${lvl}>${inline(h[2])}</h${lvl}>`; continue; }
      const ul = line.match(/^[\s]*[-*]\s+(.+)$/);
      if (ul) { if (!inList || listType !== "ul") { closeList(); html += "<ul>"; inList = true; listType = "ul"; } html += `<li>${inline(ul[1])}</li>`; continue; }
      const ol = line.match(/^[\s]*\d+[.)]\s+(.+)$/);
      if (ol) { if (!inList || listType !== "ol") { closeList(); html += "<ol>"; inList = true; listType = "ol"; } html += `<li>${inline(ol[1])}</li>`; continue; }
      if (line.trim() === "") { closeList(); html += "<br/>"; continue; }
      closeList(); html += `<p>${inline(line)}</p>`;
    }
    closeList();
    return html;
  }

  // ── Persistencia ──────────────────────────────────────────────────────────
  function _cargarSesion() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!d?.sessionId || !d?.lastActive) return null;
      if (Date.now() - d.lastActive > SESSION_TTL) { localStorage.removeItem(STORAGE_KEY); return null; }
      return d;
    } catch { return null; }
  }
  function _guardarSesion(id, msgs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: id, lastActive: Date.now(), messages: msgs })); } catch {}
  }
  function _borrarSesion() { try { localStorage.removeItem(STORAGE_KEY); } catch {} }

  // ── Estado ────────────────────────────────────────────────────────────────
  let sesionGuardada = _cargarSesion();
  let sessionId  = sesionGuardada?.sessionId ?? crypto.randomUUID();
  let histMsgs   = sesionGuardada?.messages  ?? [];
  let isOpen = false, isLoading = false, currentCtrl = null;
  let widgetMounted = false;

  // ── Inyectar estilos dinámicos ────────────────────────────────────────────
  function _inyectarCSS() {
    const POS = CFG.posicion === "left" ? "left:28px" : "right:28px";
    const existing = document.getElementById("rai-style");
    if (existing) existing.remove();

    const styleEl = document.createElement("style");
    styleEl.id = "rai-style";
    styleEl.textContent = `
      :root{
        --rai-gold:${CFG.colorPrimario}; --rai-gold-l:${CFG.colorHover};
        --rai-bg:#14130f; --rai-surface:#1e1c17;
        --rai-border:#2e2b25; --rai-text:#e8e4da;
        --rai-muted:#7a7468; --rai-user-bg:${CFG.colorPrimario};
        --rai-user-text:#0f0e0c; --rai-bot-bg:#252219;
        --rai-radius:18px; --rai-w:390px; --rai-h:540px;
      }
      #rai-fab{position:fixed;bottom:28px;${POS};width:58px;height:58px;border-radius:50%;background:var(--rai-gold);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,0,0,.3);transition:transform .2s,background .2s;z-index:99998;}
      #rai-fab:hover{background:var(--rai-gold-l);transform:scale(1.07);}
      #rai-fab svg{transition:transform .3s;}
      #rai-fab.open svg{transform:rotate(45deg);}
      #rai-fab::after{content:'';position:absolute;top:6px;right:6px;width:10px;height:10px;background:#4ade80;border-radius:50%;border:2px solid var(--rai-bg);animation:rai-pulse 2s infinite;}
      #rai-fab.open::after{display:none;}
      @keyframes rai-pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.3);opacity:.7;}}
      #rai-window{position:fixed;bottom:100px;${POS};width:var(--rai-w);height:var(--rai-h);background:var(--rai-bg);border:1px solid var(--rai-border);border-radius:var(--rai-radius);display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.7);z-index:99999;overflow:hidden;font-family:'DM Sans',-apple-system,sans-serif;transform:scale(.92) translateY(16px);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.34,1.56,.64,1),opacity .2s;}
      #rai-window.visible{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
      #rai-header{display:flex;align-items:center;gap:.6rem;padding:.85rem 1.1rem;border-bottom:1px solid var(--rai-border);background:var(--rai-surface);flex-shrink:0;}
      #rai-avatar{width:34px;height:34px;background:var(--rai-gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0;}
      #rai-header-info{flex:1;min-width:0;}
      #rai-header-title{font-size:.9rem;font-weight:500;color:var(--rai-text);}
      #rai-header-status{font-size:.7rem;color:#4ade80;letter-spacing:.04em;}
      .rai-hbtn{background:none;border:none;cursor:pointer;color:var(--rai-muted);padding:5px;border-radius:6px;transition:color .15s,background .15s;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
      .rai-hbtn:hover{color:var(--rai-text);background:var(--rai-border);}
      #rai-messages{flex:1;overflow-y:auto;padding:1.1rem;display:flex;flex-direction:column;gap:.75rem;scroll-behavior:smooth;}
      #rai-messages::-webkit-scrollbar{width:4px;}
      #rai-messages::-webkit-scrollbar-thumb{background:var(--rai-border);border-radius:4px;}
      .rai-msg{max-width:86%;padding:.65rem .95rem;border-radius:14px;font-size:.87rem;line-height:1.6;animation:rai-fi .2s ease;word-break:break-word;}
      @keyframes rai-fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .rai-msg.user{align-self:flex-end;background:var(--rai-user-bg);color:var(--rai-user-text);border-bottom-right-radius:4px;white-space:pre-wrap;}
      .rai-msg.bot{align-self:flex-start;background:var(--rai-bot-bg);color:var(--rai-text);border:1px solid var(--rai-border);border-bottom-left-radius:4px;}
      .rai-msg.bot.stopped{opacity:.72;border-style:dashed;}
      .rai-msg.bot p{margin:.18rem 0;}.rai-msg.bot p:first-child{margin-top:0;}.rai-msg.bot p:last-child{margin-bottom:0;}
      .rai-msg.bot ul,.rai-msg.bot ol{padding-left:1.3rem;margin:.3rem 0;}.rai-msg.bot li{margin:.2rem 0;}
      .rai-msg.bot strong{color:var(--rai-gold-l);font-weight:600;}
      .rai-msg.bot em{color:#b8c4d8;font-style:italic;}
      .rai-msg.bot code{background:#1a1a1a;color:#e8c97a;padding:.1em .35em;border-radius:4px;font-family:'Courier New',monospace;font-size:.83em;}
      .rai-msg.bot a{color:var(--rai-gold);text-decoration:underline;text-underline-offset:2px;word-break:break-all;}
      .rai-msg.bot a:hover{color:var(--rai-gold-l);}
      .rai-msg.bot h3,.rai-msg.bot h4,.rai-msg.bot h5{color:var(--rai-text);font-weight:600;margin:.5rem 0 .2rem;font-size:.9rem;}
      .rai-msg.bot hr{border:none;border-top:1px solid var(--rai-border);margin:.5rem 0;}
      .rai-typing{display:flex;gap:4px;padding:.75rem .95rem;align-self:flex-start;background:var(--rai-bot-bg);border:1px solid var(--rai-border);border-radius:14px;border-bottom-left-radius:4px;}
      .rai-typing span{width:6px;height:6px;background:var(--rai-muted);border-radius:50%;animation:rai-b 1.2s infinite;}
      .rai-typing span:nth-child(2){animation-delay:.2s;}.rai-typing span:nth-child(3){animation-delay:.4s;}
      @keyframes rai-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
      .rai-sep{align-self:center;font-size:.72rem;color:var(--rai-muted);border-top:1px solid var(--rai-border);width:100%;text-align:center;padding-top:.5rem;margin:.2rem 0;}
      #rai-suggestions{display:flex;flex-wrap:wrap;gap:.4rem;padding:0 1.1rem .75rem;}
      .rai-chip{background:var(--rai-surface);border:1px solid var(--rai-border);border-radius:20px;padding:.28rem .75rem;font-size:.77rem;color:var(--rai-muted);cursor:pointer;transition:all .15s;font-family:inherit;}
      .rai-chip:hover{border-color:var(--rai-gold);color:var(--rai-gold);}
      #rai-form{display:flex;align-items:flex-end;gap:.45rem;padding:.85rem;border-top:1px solid var(--rai-border);background:var(--rai-surface);flex-shrink:0;}
      #rai-input{flex:1;background:var(--rai-bg);border:1px solid var(--rai-border);border-radius:10px;padding:.55rem .85rem;color:var(--rai-text);font-family:inherit;font-size:.87rem;outline:none;transition:border-color .2s;resize:none;max-height:96px;}
      #rai-input:focus{border-color:var(--rai-gold);}
      #rai-input::placeholder{color:var(--rai-muted);}
      #rai-send,#rai-stop{width:36px;height:36px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s,transform .15s;}
      #rai-send{background:var(--rai-gold);}
      #rai-send:hover{background:var(--rai-gold-l);transform:scale(1.05);}
      #rai-send:disabled{opacity:.4;cursor:not-allowed;transform:none;}
      #rai-stop{background:#3a2020;border:1px solid #6b2f2f;display:none;}
      #rai-stop:hover{background:#4a2828;}
      #rai-stop.visible{display:flex;}
      @media(max-width:440px){#rai-window{width:calc(100vw - 24px);${CFG.posicion==="left"?"left:12px":"right:12px"};}}
    `;
    document.head.appendChild(styleEl);
  }

  // ── Montar HTML ───────────────────────────────────────────────────────────
  function _montarWidget() {
    if (widgetMounted) return;
    widgetMounted = true;

    if (!document.querySelector('link[href*="DM+Sans"]')) {
      const lnk = document.createElement("link");
      lnk.rel  = "stylesheet";
      lnk.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap";
      document.head.appendChild(lnk);
    }

    const chipsHtml = CFG.chips
      .map(c => `<button class="rai-chip">${c}</button>`)
      .join("");

    const wrap = document.createElement("div");
    wrap.id = "rai-root";
    wrap.innerHTML = `
      <button id="rai-fab" aria-label="Abrir asistente">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none"
             stroke="#0f0e0c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
          <button class="rai-hbtn" id="rai-new" title="Nuevo chat" aria-label="Nuevo chat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="rai-hbtn" id="rai-close" title="Cerrar" aria-label="Cerrar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div id="rai-messages"></div>
        <div id="rai-suggestions">${chipsHtml}</div>
        <div id="rai-form">
          <textarea id="rai-input" rows="1" placeholder="${CFG.placeholder}"></textarea>
          <button id="rai-send" aria-label="Enviar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f0e0c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
          <button id="rai-stop" aria-label="Detener" title="Detener respuesta">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#ef4444">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    _bindEventos();
    _restaurarHistorial();
  }

  // ── Eventos ───────────────────────────────────────────────────────────────
  function _bindEventos() {
    const fab      = document.getElementById("rai-fab");
    const win      = document.getElementById("rai-window");
    const closeBtn = document.getElementById("rai-close");
    const newBtn   = document.getElementById("rai-new");
    const sendBtn  = document.getElementById("rai-send");
    const stopBtn  = document.getElementById("rai-stop");
    const input    = document.getElementById("rai-input");

    fab.addEventListener("click", _toggleChat);
    closeBtn.addEventListener("click", _toggleChat);
    newBtn.addEventListener("click", _nuevaConversacion);
    stopBtn.addEventListener("click", _detener);
    sendBtn.addEventListener("click", () => _enviar(input.value));

    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); _enviar(input.value); }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 96) + "px";
    });

    document.querySelectorAll(".rai-chip").forEach(c =>
      c.addEventListener("click", () => _enviar(c.textContent))
    );
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && isOpen) _toggleChat();
    });
    ["click", "keydown"].forEach(ev =>
      win.addEventListener(ev, () => _guardarSesion(sessionId, histMsgs), { passive: true })
    );
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────
  function _toggleChat() {
    isOpen = !isOpen;
    document.getElementById("rai-window").classList.toggle("visible", isOpen);
    document.getElementById("rai-fab").classList.toggle("open", isOpen);
    if (isOpen) setTimeout(() => document.getElementById("rai-input").focus(), 250);
  }

  function _setLoading(v) {
    isLoading = v;
    const sendBtn = document.getElementById("rai-send");
    const stopBtn = document.getElementById("rai-stop");
    if (sendBtn) sendBtn.disabled = v;
    if (stopBtn) stopBtn.classList.toggle("visible", v);
  }

  function _addMsg(content, role, asMarkdown = false) {
    const msgs = document.getElementById("rai-messages");
    const div  = document.createElement("div");
    div.className = `rai-msg ${role}`;
    if (asMarkdown) div.innerHTML = _mdToHtml(content);
    else div.textContent = content;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function _addSep() {
    const msgs = document.getElementById("rai-messages");
    const div  = document.createElement("div");
    div.className = "rai-sep";
    div.textContent = "— Nueva conversación —";
    msgs.appendChild(div);
  }

  function _addTyping() {
    const msgs = document.getElementById("rai-messages");
    const div  = document.createElement("div");
    div.className = "rai-typing";
    div.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function _restaurarHistorial() {
    const suggs = document.getElementById("rai-suggestions");
    if (histMsgs.length === 0) {
      histMsgs.push({ role: "bot", text: CFG.bienvenida });
      _guardarSesion(sessionId, histMsgs);
      _addMsg(CFG.bienvenida, "bot", true);
    } else {
      histMsgs.forEach(m => _addMsg(m.text, m.role, m.role === "bot"));
      suggs.style.display = "none";
    }
  }

  async function _nuevaConversacion() {
    if (currentCtrl) { currentCtrl.abort(); currentCtrl = null; }
    _setLoading(false);
    const old = sessionId;
    try {
      await fetch(`${API_BASE}/session/reset`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "reset", session_id: old }),
      });
    } catch {}
    sessionId = crypto.randomUUID();
    histMsgs  = [];
    _borrarSesion();
    document.getElementById("rai-messages").innerHTML = "";
    document.getElementById("rai-suggestions").style.display = "flex";
    _addSep();
    histMsgs.push({ role: "bot", text: CFG.bienvenida });
    _addMsg(CFG.bienvenida, "bot", true);
    _guardarSesion(sessionId, histMsgs);
    document.getElementById("rai-input").focus();
  }

  function _detener() {
    if (currentCtrl) { currentCtrl.abort(); currentCtrl = null; }
    _setLoading(false);
  }

  async function _enviar(texto) {
    texto = texto.trim();
    if (!texto || isLoading) return;

    _setLoading(true);
    document.getElementById("rai-suggestions").style.display = "none";
    histMsgs.push({ role: "user", text: texto });
    _addMsg(texto, "user", false);
    const input = document.getElementById("rai-input");
    input.value = ""; input.style.height = "auto";

    const typing  = _addTyping();
    const msgs    = document.getElementById("rai-messages");
    let botBubble = null, rawText = "";

    try {
      currentCtrl = new AbortController();
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST", signal: currentCtrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: texto, session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      typing.remove();
      botBubble = document.createElement("div");
      botBubble.className = "rai-msg bot";
      msgs.appendChild(botBubble);

      const reader = res.body.getReader(), decoder = new TextDecoder();
      let buffer = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const token = line.slice(6);
          if (token === "[DONE]") break outer;
          rawText += token;
          botBubble.innerHTML = _mdToHtml(rawText);
          msgs.scrollTop = msgs.scrollHeight;
        }
      }

      histMsgs.push({ role: "bot", text: rawText });
      _guardarSesion(sessionId, histMsgs);

    } catch (err) {
      if (typing.parentNode) typing.remove();
      if (err.name === "AbortError") {
        if (botBubble && rawText) {
          botBubble.classList.add("stopped");
          histMsgs.push({ role: "bot", text: rawText + " [detenido]" });
          _guardarSesion(sessionId, histMsgs);
        } else {
          if (botBubble) botBubble.remove();
          _addMsg("Respuesta detenida.", "bot");
        }
      } else {
        if (botBubble) botBubble.remove();
        _addMsg("⚠️ No pude conectarme al servidor.", "bot");
        console.error("[RAI Widget]", err);
      }
    } finally {
      _setLoading(false); currentCtrl = null;
      document.getElementById("rai-input").focus();
    }
  }

  // ── Arranque: cargar config del servidor, luego montar ───────────────────
  async function _init() {
    try {
      const res = await fetch(`${API_BASE}/widget-config`);
      if (res.ok) {
        const serverCfg = await res.json();
        // Los overrides de window.RAI_CONFIG prevalecen sobre el servidor
        CFG = Object.assign(CFG, serverCfg, userCfg);
      }
    } catch {
      // Si el servidor no responde, usa los defaults ya en CFG
    }
    _inyectarCSS();
    _montarWidget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _init);
  } else {
    _init();
  }

})();