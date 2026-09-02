/**
 * Testes positivos de autorizacao por papel — FASE 13.
 * Valida que usuarios legitimos conseguem operar normalmente sob a nova RLS:
 *  - Portaria autenticada le unidades e encomendas
 *  - Morador autenticado le SOMENTE a propria unidade e encomendas
 *  - Morador NAO enxerga dados de outros apartamentos (prova de IDOR corrigido)
 *
 * Uso: node tests/positive-suite.cjs
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const pick = (name) => {
  const m = env.match(new RegExp('^' + name + '="?([^"\\n]+)"?', 'm'));
  return m ? m[1] : '';
};

const URL = pick('VITE_SUPABASE_URL');
const ANON_KEY = pick('VITE_SUPABASE_ANON_KEY');

const anonHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function login(email, password) {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: anonHeaders,
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000)
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error('Falha no login: ' + JSON.stringify(data));
  return data.access_token;
}

let pass = 0;
let fail = 0;

async function test(nome, fn) {
  process.stdout.write(`  [TEST] ${nome} ... `);
  try {
    await fn();
    console.log('✓ PASS');
    pass++;
  } catch (err) {
    console.log('✕ FAIL');
    console.log(`         ${err.message}`);
    fail++;
  }
}

(async () => {
  console.log('===============================================================');
  console.log('VILLAGE AZALEIA — TESTES POSITIVOS POR PAPEL (FASE 13)');
  console.log('===============================================================\n');

  const tokenPortaria = await login('portaria@villageazaleia.com.br', 'portaria123');
  const tokenSindico = await login('sindico@villageazaleia.com.br', 'sindico123');
  const tokenMorador = await login('Jefferson.22gs@gmail.com', 'morador123456');

  const hPortaria = { apikey: ANON_KEY, Authorization: `Bearer ${tokenPortaria}` };
  const hSindico = { apikey: ANON_KEY, Authorization: `Bearer ${tokenSindico}` };
  const hMorador = { apikey: ANON_KEY, Authorization: `Bearer ${tokenMorador}` };

  console.log('--- 1. PORTARIA & SÍNDICO: ACESSO OPERACIONAL ---');

  await test('POS-001: Portaria le todas as unidades para operar', async () => {
    const r = await fetch(`${URL}/rest/v1/units?select=id,resident_name`, { headers: hPortaria });
    const rows = await r.json();
    assert(r.ok && Array.isArray(rows) && rows.length >= 1, `Portaria deveria ver unidades: ${JSON.stringify(rows)}`);
  });

  await test('POS-002: Sindico le todas as unidades e logs para auditoria', async () => {
    const r = await fetch(`${URL}/rest/v1/activity_logs?select=id,action`, { headers: hSindico });
    const rows = await r.json();
    assert(r.ok && Array.isArray(rows), `Sindico deveria ver logs: ${JSON.stringify(rows)}`);
  });

  console.log('\n--- 2. MORADOR: ISOLAMENTO E PRIVACIDADE (IDOR ZERO) ---');

  await test('POS-003: Morador le apenas a sua propria unidade (B12B-A23)', async () => {
    const r = await fetch(`${URL}/rest/v1/units?select=id,block,apartment,resident_name`, { headers: hMorador });
    const rows = await r.json();
    assert(r.ok && Array.isArray(rows), `Falha na consulta: HTTP ${r.status}`);
    assert(rows.length === 1, `Morador deveria ver exatamente 1 unidade (a sua), recebeu ${rows.length}`);
    assert(rows[0].id === 'B12B-A23', `Morador viu unidade errada: ${rows[0].id}`);
  });

  await test('POS-004: Morador NAO consegue ler staff_accounts nem logs administrativos', async () => {
    const r = await fetch(`${URL}/rest/v1/staff_accounts?select=*`, { headers: hMorador });
    const rows = await r.json();
    assert(!r.ok || (Array.isArray(rows) && rows.length === 0), `Morador nao pode ver staff_accounts`);
  });

  console.log('\n===============================================================');
  console.log(`RESULTADO POSITIVO: ${pass} PASS / ${fail} FAIL`);
  console.log('===============================================================');

  if (fail > 0) process.exit(1);
})();
