# Hermes

Agente personal de Angel. Tres piezas:

```
   Telegram  ──►  bridge.js  ──►  Claude Agent SDK  ──┬──►  MCP whatsapp  ──►  daemon Baileys  ──►  WhatsApp
  (tu consola)                                         └──►  Bash: himalaya            ──►  correo IMAP/SMTP
```

**Telegram es tu consola conmigo. WhatsApp es una herramienta que yo uso para
hablarle a otros.** Son roles distintos a proposito: Telegram Bot API es oficial
y estable; Baileys no lo es y no quieres que tu canal de control dependa de el.

## Requisitos

- Node 20+
- Una maquina que este siempre prendida (mini PC, Mac viejo, Raspberry). **No sirve
  una sesion en la nube**: las credenciales de WhatsApp viven en disco y la sesion
  se tiene que mantener.
- `himalaya` instalado (`brew install himalaya` / `cargo install himalaya`)
- Un `ANTHROPIC_API_KEY`

## Instalacion

```bash
git clone <este repo> ~/hermes && cd ~/hermes/hermes
npm install
cp .env.example .env      # y llenalo
```

### 1. El bot de Telegram

1. Hablale a [@BotFather](https://t.me/BotFather), `/newbot`, te da el token → `TELEGRAM_BOT_TOKEN`.
2. Hablale a [@userinfobot](https://t.me/userinfobot), te da tu id numerico → `TELEGRAM_OWNER_ID`.

Ese id es el unico que el bridge obedece. Cualquier otro que le escriba al bot se ignora.

### 2. WhatsApp

```bash
npm run wa
```

Sale un QR en la terminal. WhatsApp del telefono → **Dispositivos vinculados** → escanear.
Las credenciales quedan en `wa-auth/` y aguantan reinicios; solo escaneas otra vez si
cierras la sesion desde el telefono.

Los alias de contactos van en `state/contacts.json` (ve `state-contacts.example.json`).

### 3. Correo

```bash
cp himalaya/config.example.toml ~/.config/himalaya/config.toml
$EDITOR ~/.config/himalaya/config.toml
himalaya envelope list     # si lista tu bandeja, ya quedo
```

### 4. Prender todo

```bash
npm run wa       # terminal 1
npm run bridge   # terminal 2
```

Escribele al bot: `/status` para ver como va, `/new` para empezar hilo limpio.

Para que viva solo, copia los `.service` de `systemd/` a `/etc/systemd/system/`
(ajusta usuario y rutas) y:

```bash
sudo systemctl enable --now hermes-wa hermes-bridge
```

## Uso

Le escribes normal:

- "¿que correos importantes llegaron hoy?"
- "dile a Luisa que llego como 7:30"
- "¿que me dijo Gaby ayer?"
- "buscame el correo de la reinscripcion de Patricio y resumelo"

El hilo se mantiene entre mensajes (el bridge guarda el `session_id` y hace `resume`),
asi que puedes decirle "mejor dile 8:00" y entiende de que hablas.

## Seguridad

Esto lee tu correo y puede mandar mensajes. Eso es exactamente la combinacion que
hace falta para que un ataque de prompt injection duela: un correo cualquiera trae
texto, el agente lo lee, y ese texto intenta pasar por instruccion. Tres capas:

1. **El system prompt** (en `src/telegram/bridge.js`) le dice explicitamente que el
   contenido de correos y mensajes son datos, no ordenes.
2. **Modo `approve`** (default, en `.env`): ningun WhatsApp sale sin que le des
   "Enviar" en el borrador que te llega a Telegram. `WA_SEND_MODE=direct` lo quita —
   no lo quites hasta que confies en el setup.
3. **Allowlist angosta** en `workspace/.claude/settings.json`: solo los comandos de
   `himalaya` de lectura estan pre-aprobados, y `.env` y `wa-auth/` estan en la
   lista de denegados.

La capa 1 es la mas debil de las tres — un prompt no es una barrera dura. Las que
de verdad te protegen son la 2 y la 3.

El daemon escucha solo en `127.0.0.1` y pide el `HERMES_TOKEN` en cada llamada.
Nada de esto debe quedar expuesto a internet.

## Baileys: lo que hay que saber

Es un cliente **no oficial** de WhatsApp Web. WhatsApp puede banear el numero si
detecta comportamiento automatizado: mucho volumen, mensajes identicos a muchos
destinatarios, respuestas instantaneas 24/7. Para uso personal (unos cuantos
mensajes al dia, redactados distinto cada vez) el riesgo es bajo, pero no es cero.
Si te preocupa perder tu numero, usa uno secundario.

El historial que ves en `read_chat` es solo lo que llego **mientras el daemon
estuvo corriendo** — no es el respaldo del telefono.

## Estructura

```
src/config.js           carga .env, cliente del daemon
src/wa/daemon.js        Baileys + API HTTP local (el unico que toca WhatsApp)
src/mcp/whatsapp.js     MCP server stdio -> daemon (JSON-RPC a mano, sin deps)
src/telegram/api.js     cliente de la Bot API
src/telegram/bridge.js  long polling + Claude Agent SDK
workspace/              carpeta de trabajo del agente (CLAUDE.md + skills)
```
