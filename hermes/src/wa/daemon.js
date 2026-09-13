// Daemon de WhatsApp: mantiene vivo el socket de Baileys y expone una API
// HTTP local (solo 127.0.0.1) que consume el MCP server.
//
// Arranque:  npm run wa      -> escanea el QR una vez, las credenciales
//                               quedan en wa-auth/ y sobreviven reinicios.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import baileys, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { config, ensureDirs, requireEnv } from '../config.js';
import { tg } from '../telegram/api.js';

const makeWASocket = baileys.default ?? baileys.makeWASocket ?? baileys;

requireEnv(['HERMES_TOKEN']);
ensureDirs();

const log = pino({ level: process.env.HERMES_LOG_LEVEL || 'warn' });
const CHATS_FILE = join(config.stateDir, 'chats.json');

let sock = null;
let connected = false;
let me = null;
const chats = new Map();            // jid -> { jid, name, lastTs, messages: [...] }
const outbox = new Map();           // id -> { jid, text, to, createdAt }

// ---------------------------------------------------------------- utilidades

function loadChats() {
  if (!existsSync(CHATS_FILE)) return;
  try {
    for (const c of JSON.parse(readFileSync(CHATS_FILE, 'utf8'))) chats.set(c.jid, c);
  } catch (err) {
    log.warn({ err }, 'no pude leer chats.json, empiezo vacio');
  }
}

let saveTimer = null;
function saveChatsSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const top = [...chats.values()].sort((a, b) => b.lastTs - a.lastTs).slice(0, 200);
    try { writeFileSync(CHATS_FILE, JSON.stringify(top, null, 2)); }
    catch (err) { log.warn({ err }, 'no pude guardar chats.json'); }
  }, 3000);
}

function contacts() {
  if (!existsSync(config.contactsFile)) return {};
  try { return JSON.parse(readFileSync(config.contactsFile, 'utf8')); }
  catch { return {}; }
}

// Normaliza a formato internacional sin signos. Un numero de 10 digitos
// asume WA_DEFAULT_CC; el "1" viejo de Mexico (521...) se colapsa.
function normalizeNumber(input) {
  let n = String(input).replace(/\D/g, '');
  if (n.length === 10) n = config.defaultCc + n;
  if (n.length === 13 && n.startsWith('521')) n = '52' + n.slice(3);
  return n;
}

function textOf(msg) {
  const m = msg?.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    (m.audioMessage ? '[nota de voz]' : '') ||
    (m.stickerMessage ? '[sticker]' : '') ||
    (m.imageMessage ? '[imagen]' : '') ||
    (m.documentMessage ? `[documento: ${m.documentMessage.fileName || 's/n'}]` : '') ||
    ''
  );
}

// Resuelve "luisa" / "5533112233" / un jid completo -> jid real de WhatsApp.
async function resolveJid(who) {
  const raw = String(who || '').trim();
  if (!raw) throw new Error('dime a quien');
  if (raw.endsWith('@g.us') || raw.endsWith('@s.whatsapp.net')) return raw;

  const alias = contacts()[raw.toLowerCase()];
  const candidate = alias || raw;

  // Si parece numero, preguntale a WhatsApp cual es el jid bueno.
  if (/\d/.test(candidate) && candidate.replace(/\D/g, '').length >= 8) {
    const number = normalizeNumber(candidate);
    if (!connected) throw new Error('WhatsApp no esta conectado todavia');
    const [hit] = await sock.onWhatsApp(number);
    if (hit?.exists) return hit.jid;
    throw new Error(`el numero ${number} no tiene WhatsApp (o no lo pude verificar)`);
  }

  // Si no, busca por nombre entre los chats conocidos.
  const needle = candidate.toLowerCase();
  const matches = [...chats.values()].filter((c) => (c.name || '').toLowerCase().includes(needle));
  if (matches.length === 1) return matches[0].jid;
  if (matches.length > 1) {
    const names = matches.slice(0, 8).map((c) => `${c.name} (${c.jid})`).join(', ');
    throw new Error(`"${raw}" es ambiguo, coincide con: ${names}`);
  }
  throw new Error(`no encontre a "${raw}". Agregalo a state/contacts.json o pasa el numero completo.`);
}

// ------------------------------------------------------------------- baileys

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: log,
    browser: ['Hermes', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false, // no le robes las notificaciones a tu telefono
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\nEscanea este QR desde WhatsApp > Dispositivos vinculados:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      connected = true;
      me = sock.user;
      console.log(`WhatsApp conectado como ${me?.name || me?.id}`);
    }
    if (connection === 'close') {
      connected = false;
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === DisconnectReason.loggedOut) {
        console.error('Sesion cerrada desde el telefono. Borra wa-auth/ y vuelve a escanear el QR.');
        process.exit(1);
      }
      console.error(`Conexion caida (${status}), reconectando en 3s...`);
      setTimeout(start, 3000);
    }
  });

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      const jid = msg.key?.remoteJid;
      if (!jid || jid === 'status@broadcast') continue;
      const chat = chats.get(jid) || { jid, name: '', lastTs: 0, messages: [] };
      chat.name = msg.pushName || chat.name || jid.split('@')[0];
      chat.lastTs = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);
      chat.messages.push({
        ts: chat.lastTs,
        fromMe: !!msg.key.fromMe,
        author: msg.key.fromMe ? 'yo' : (msg.pushName || jid.split('@')[0]),
        text: textOf(msg),
      });
      if (chat.messages.length > 100) chat.messages = chat.messages.slice(-100);
      chats.set(jid, chat);
    }
    saveChatsSoon();
  });
}

// ---------------------------------------------------------------- envio real

async function reallySend(jid, text) {
  if (!connected) throw new Error('WhatsApp no esta conectado');
  await sock.sendMessage(jid, { text });
  const chat = chats.get(jid) || { jid, name: jid.split('@')[0], lastTs: 0, messages: [] };
  chat.lastTs = Math.floor(Date.now() / 1000);
  chat.messages.push({ ts: chat.lastTs, fromMe: true, author: 'yo', text });
  chats.set(jid, chat);
  saveChatsSoon();
}

// En modo approve nada sale sin que Angel lo apruebe desde Telegram.
async function requestApproval(id, to, jid, text) {
  outbox.set(id, { jid, text, to, createdAt: Date.now() });
  await tg('sendMessage', {
    chat_id: config.ownerId,
    text: `📤 Quiero mandar este WhatsApp a *${to}*:\n\n${text}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Enviar', callback_data: `wa:ok:${id}` },
        { text: '❌ Cancelar', callback_data: `wa:no:${id}` },
      ]],
    },
  });
}

// ---------------------------------------------------------------- API HTTP

const routes = {
  'GET /status': async () => ({
    connected,
    me: me ? { id: me.id, name: me.name } : null,
    chats: chats.size,
    pending: outbox.size,
    sendMode: config.sendMode,
  }),

  'GET /chats': async (_body, url) => {
    const limit = Number(url.searchParams.get('limit') || 15);
    return {
      chats: [...chats.values()]
        .sort((a, b) => b.lastTs - a.lastTs)
        .slice(0, limit)
        .map((c) => ({
          jid: c.jid,
          name: c.name,
          isGroup: c.jid.endsWith('@g.us'),
          last: c.messages.at(-1)?.text?.slice(0, 120) || '',
          lastAt: new Date(c.lastTs * 1000).toISOString(),
        })),
    };
  },

  'GET /messages': async (_body, url) => {
    const jid = await resolveJid(url.searchParams.get('chat'));
    const limit = Number(url.searchParams.get('limit') || 20);
    const chat = chats.get(jid);
    if (!chat) return { jid, messages: [], note: 'sin historial local; el daemon solo guarda lo que llega mientras corre' };
    return {
      jid,
      name: chat.name,
      messages: chat.messages.slice(-limit).map((m) => ({
        at: new Date(m.ts * 1000).toISOString(), author: m.author, text: m.text,
      })),
    };
  },

  'GET /resolve': async (_body, url) => ({ jid: await resolveJid(url.searchParams.get('who')) }),

  'POST /send': async (body) => {
    const { to, text } = body;
    if (!text?.trim()) throw new Error('el mensaje va vacio');
    const jid = await resolveJid(to);
    if (config.sendMode === 'direct') {
      await reallySend(jid, text);
      return { status: 'sent', jid };
    }
    const id = Math.random().toString(36).slice(2, 10);
    await requestApproval(id, to, jid, text);
    return { status: 'pending_approval', id, jid, note: 'Angel tiene que aprobarlo en Telegram' };
  },

  // Lo llama el bridge cuando Angel toca un boton del borrador.
  'POST /approve': async (body) => {
    const draft = outbox.get(body.id);
    if (!draft) throw new Error('ese borrador ya no existe');
    outbox.delete(body.id);
    if (!body.ok) return { status: 'cancelled', to: draft.to };
    await reallySend(draft.jid, draft.text);
    return { status: 'sent', to: draft.to };
  },
};

const server = createServer(async (req, res) => {
  const reply = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  try {
    if (req.headers['x-hermes-token'] !== config.token) return reply(401, { error: 'token invalido' });
    const url = new URL(req.url, 'http://127.0.0.1');
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return reply(404, { error: `ruta desconocida: ${url.pathname}` });

    let body = {};
    if (req.method === 'POST') {
      const raw = await new Promise((resolve, reject) => {
        let buf = '';
        req.on('data', (c) => { buf += c; if (buf.length > 1e6) req.destroy(); });
        req.on('end', () => resolve(buf));
        req.on('error', reject);
      });
      body = raw ? JSON.parse(raw) : {};
    }
    reply(200, await handler(body, url));
  } catch (err) {
    reply(400, { error: err.message });
  }
});

loadChats();
// Escucha SOLO en loopback: nadie fuera de esta maquina toca tu WhatsApp.
server.listen(config.waPort, '127.0.0.1', () => {
  console.log(`Daemon de WhatsApp en http://127.0.0.1:${config.waPort} (modo de envio: ${config.sendMode})`);
});
start().catch((err) => { console.error('No pude arrancar Baileys:', err); process.exit(1); });
