// MCP server (stdio) que expone WhatsApp como herramientas del agente.
// Habla JSON-RPC 2.0 por stdin/stdout, a mano y sin dependencias: el
// protocolo stdio de MCP es estable y asi no arrastramos version drift.
//
// Nunca escribas a stdout otra cosa que no sea JSON-RPC: los logs van a stderr.
import { waCall } from '../config.js';

const TOOLS = [
  {
    name: 'send',
    description:
      'Manda un mensaje de WhatsApp. "to" puede ser un alias de state/contacts.json (ej. "luisa"), ' +
      'un numero, o un jid. Si el daemon esta en modo approve, el mensaje NO sale hasta que Angel ' +
      'lo aprueba en Telegram: en ese caso la respuesta dice pending_approval y debes decirselo.',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'alias, numero o jid del destinatario' },
        text: { type: 'string', description: 'el texto a enviar, ya redactado' },
      },
      required: ['to', 'text'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_chats',
    description: 'Lista los chats de WhatsApp mas recientes, del mas nuevo al mas viejo.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'cuantos chats (default 15)' } },
      additionalProperties: false,
    },
  },
  {
    name: 'read_chat',
    description:
      'Lee los mensajes recientes de un chat. Solo hay historial de lo que llego mientras el ' +
      'daemon estuvo corriendo, no del telefono completo.',
    inputSchema: {
      type: 'object',
      properties: {
        chat: { type: 'string', description: 'alias, numero o jid' },
        limit: { type: 'number', description: 'cuantos mensajes (default 20)' },
      },
      required: ['chat'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve',
    description: 'Verifica a quien apunta un alias o numero antes de mandarle algo.',
    inputSchema: {
      type: 'object',
      properties: { who: { type: 'string' } },
      required: ['who'],
      additionalProperties: false,
    },
  },
  {
    name: 'status',
    description: 'Dice si WhatsApp esta conectado y en que modo de envio esta el daemon.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

async function callTool(name, args = {}) {
  switch (name) {
    case 'send':
      return waCall('/send', { method: 'POST', body: { to: args.to, text: args.text } });
    case 'list_chats':
      return waCall(`/chats?limit=${encodeURIComponent(args.limit ?? 15)}`);
    case 'read_chat':
      return waCall(`/messages?chat=${encodeURIComponent(args.chat)}&limit=${encodeURIComponent(args.limit ?? 20)}`);
    case 'resolve':
      return waCall(`/resolve?who=${encodeURIComponent(args.who)}`);
    case 'status':
      return waCall('/status');
    default:
      throw new Error(`herramienta desconocida: ${name}`);
  }
}

// --------------------------------------------------------------- JSON-RPC

function write(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(req) {
  const { id, method, params } = req;
  const isNotification = id === undefined || id === null;

  try {
    let result;
    switch (method) {
      case 'initialize':
        result = {
          // Espejeamos la version del cliente para no pelearnos por el handshake.
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'hermes-whatsapp', version: '0.1.0' },
        };
        break;
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return; // las notificaciones no llevan respuesta
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools: TOOLS };
        break;
      case 'tools/call': {
        const data = await callTool(params?.name, params?.arguments || {});
        result = { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        break;
      }
      default:
        if (isNotification) return;
        return write({ jsonrpc: '2.0', id, error: { code: -32601, message: `metodo no soportado: ${method}` } });
    }
    if (!isNotification) write({ jsonrpc: '2.0', id, result });
  } catch (err) {
    // Un error de herramienta se reporta como resultado isError, no como
    // error de protocolo: asi el agente lo lee y puede corregir.
    if (isNotification) return;
    if (method === 'tools/call') {
      write({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true } });
    } else {
      write({ jsonrpc: '2.0', id, error: { code: -32603, message: err.message } });
    }
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); }
    catch (err) { process.stderr.write(`json invalido: ${err.message}\n`); }
  }
});
process.stdin.on('end', () => process.exit(0));
