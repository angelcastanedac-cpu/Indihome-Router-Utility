// Cliente minimo de la Bot API de Telegram (solo fetch, sin dependencias).
import { config } from '../config.js';

export async function tg(method, payload = {}, { timeoutMs = 60000 } = {}) {
  const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description || 'error desconocido'}`);
  return data.result;
}

const TG_LIMIT = 4000; // el limite real es 4096; dejamos aire

// Telegram rechaza mensajes largos: los partimos por parrafo/linea.
export function chunk(text) {
  const out = [];
  let rest = String(text ?? '').trim() || '(sin texto)';
  while (rest.length > TG_LIMIT) {
    let cut = rest.lastIndexOf('\n\n', TG_LIMIT);
    if (cut < TG_LIMIT / 2) cut = rest.lastIndexOf('\n', TG_LIMIT);
    if (cut < TG_LIMIT / 2) cut = TG_LIMIT;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  out.push(rest);
  return out;
}

export async function sendToOwner(text, extra = {}) {
  const parts = chunk(text);
  let last;
  for (let i = 0; i < parts.length; i++) {
    last = await tg('sendMessage', {
      chat_id: config.ownerId,
      text: parts[i],
      ...(i === parts.length - 1 ? extra : {}),
    });
  }
  return last;
}
