// Prueba el MCP server contra un daemon falso: handshake, tools/list,
// tools/call exitoso, y tools/call que falla.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const PORT = 8799, TOKEN = 'test-token';
let seen = [];

const fake = createServer((req, res) => {
  seen.push(`${req.method} ${req.url} auth=${req.headers['x-hermes-token']}`);
  const url = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/status') return res.end(JSON.stringify({ connected: true, me: { name: 'Angel' } }));
  if (url.pathname === '/send') return res.end(JSON.stringify({ status: 'pending_approval', id: 'abc123' }));
  if (url.pathname === '/resolve') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'no encontre a "nadie"' })); }
  res.statusCode = 404; res.end(JSON.stringify({ error: 'nope' }));
});
await new Promise(r => fake.listen(PORT, '127.0.0.1', r));

const mcp = spawn(process.execPath, ['src/mcp/whatsapp.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, HERMES_TOKEN: TOKEN, HERMES_WA_PORT: String(PORT) },
  stdio: ['pipe', 'pipe', 'inherit'],
});

const replies = [];
let buf = '';
mcp.stdout.on('data', c => {
  buf += c;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (line) replies.push(JSON.parse(line));
  }
});

const send = o => mcp.stdin.write(JSON.stringify(o) + '\n');
const waitFor = async id => {
  for (let i = 0; i < 100; i++) {
    const hit = replies.find(r => r.id === id);
    if (hit) return hit;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`timeout esperando id=${id}`);
};

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
};

console.log('\n1. handshake');
send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
const init = await waitFor(1);
check('responde protocolVersion espejeada', init.result.protocolVersion === '2025-06-18', JSON.stringify(init));
check('declara capability tools', !!init.result.capabilities.tools);
check('trae serverInfo', init.result.serverInfo.name === 'hermes-whatsapp');

send({ jsonrpc: '2.0', method: 'notifications/initialized' });
await new Promise(r => setTimeout(r, 100));
check('la notificacion NO genera respuesta', replies.length === 1, `hay ${replies.length}`);

console.log('\n2. tools/list');
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
const list = await waitFor(2);
const names = list.result.tools.map(t => t.name);
check('expone las 5 herramientas', names.length === 5, names.join(','));
check('todas traen inputSchema objeto', list.result.tools.every(t => t.inputSchema?.type === 'object'));
check('send exige to y text', JSON.stringify(list.result.tools.find(t => t.name === 'send').inputSchema.required) === '["to","text"]');

console.log('\n3. tools/call exitoso');
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'send', arguments: { to: 'luisa', text: 'hola' } } });
const call = await waitFor(3);
check('no marca isError', !call.result.isError, JSON.stringify(call));
check('regresa content[0].text', call.result.content[0].type === 'text');
check('pasa el pending_approval al agente', call.result.content[0].text.includes('pending_approval'));
check('el daemon recibio POST /send con token', seen.some(s => s === `POST /send auth=${TOKEN}`), seen.join(' | '));

console.log('\n4. tools/call que falla');
send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'resolve', arguments: { who: 'nadie' } } });
const bad = await waitFor(4);
check('marca isError: true', bad.result.isError === true, JSON.stringify(bad));
check('NO es error de protocolo (el agente lo puede leer)', bad.error === undefined);
check('propaga el mensaje del daemon', bad.result.content[0].text.includes('no encontre'));

console.log('\n5. metodo desconocido');
send({ jsonrpc: '2.0', id: 5, method: 'resources/list' });
const unk = await waitFor(5);
check('responde error -32601', unk.error?.code === -32601, JSON.stringify(unk));

console.log(`\n${pass} pasaron, ${fail} fallaron`);
mcp.kill(); fake.close();
process.exit(fail ? 1 : 0);
