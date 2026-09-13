// Carga .env (sin dependencias) y expone la configuracion validada.
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotenv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotenv();

export const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  ownerId: String(process.env.TELEGRAM_OWNER_ID || ''),
  waPort: Number(process.env.HERMES_WA_PORT || 8787),
  token: process.env.HERMES_TOKEN || '',
  sendMode: (process.env.WA_SEND_MODE || 'approve').toLowerCase(),
  defaultCc: String(process.env.WA_DEFAULT_CC || '52'),
  workspace: process.env.HERMES_WORKSPACE || join(ROOT, 'workspace'),
  stateDir: join(ROOT, 'state'),
  authDir: join(ROOT, 'wa-auth'),
  contactsFile: join(ROOT, 'state', 'contacts.json'),
};

export function ensureDirs() {
  for (const d of [config.stateDir, config.authDir, config.workspace]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

export function requireEnv(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Falta configurar en .env: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const waBase = () => `http://127.0.0.1:${config.waPort}`;

// Llama al daemon de WhatsApp. Lanza Error con mensaje legible si algo falla.
export async function waCall(path, { method = 'GET', body } = {}) {
  const res = await fetch(waBase() + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-hermes-token': config.token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || `daemon respondio ${res.status}: ${text.slice(0, 200)}`);
  return data;
}
