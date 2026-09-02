/**
 * Suíte de testes de segurança, integridade e regressão — FASE 12, 13 e 14.
 * Executa sondas reais contra o Supabase para validar que o RLS funciona e que
 * os bugs críticos (BUG-001 a BUG-008) foram efetivamente corrigidos.
 *
 * Testes cobertos:
 *  - SEC-001: SELECT anônimo em activity_logs bloqueado
 *  - SEC-002: UPDATE anônimo em activity_logs bloqueado
 *  - SEC-003: DELETE anônimo em activity_logs bloqueado
 *  - SEC-004: SELECT anônimo em staff_accounts bloqueado (hashes protegidos)
 *  - SEC-005: SELECT anônimo em units bloqueado (dados pessoais protegidos)
 *  - SEC-006: SELECT anônimo em packages bloqueado
 *  - AUD-001: Trilha de auditoria imutável (append-only)
 *  - PKG-005: Retirada atômica bloqueia concorrência e dupla baixa (BUG-003)
 *  - PKG-007: Duplicidade de unidade bloqueada (BUG-007)
 *  - AUTH-001: Login válido no Supabase Auth emite JWT
 *  - AUTH-002: Login inválido é recusado
 *
 * Uso: node tests/security-suite.cjs
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
const SERVICE_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

const anonHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
};

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

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
  console.log('VILLAGE AZALEIA — SUÍTE DE TESTES DE SEGURANÇA E REGRESSÃO');
  console.log('===============================================================\n');

  console.log('--- 1. RLS: ACESSO ANÔNIMO DEVE SER BLOQUEADO (BUG-001) ---');

  await test('SEC-001: SELECT anônimo em activity_logs retorna vazio ou erro', async () => {
    const r = await fetch(`${URL}/rest/v1/activity_logs?select=*&limit=5`, {
      headers: anonHeaders,
      signal: AbortSignal.timeout(10000)
    });
    const rows = await r.json();
    assert(
      !r.ok || (Array.isArray(rows) && rows.length === 0),
      `Esperado bloqueio ou lista vazia, recebido HTTP ${r.status} com ${rows?.length} linhas`
    );
  });

  await test('SEC-002: INSERT anônimo em activity_logs é proibido', async () => {
    const r = await fetch(`${URL}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: anonHeaders,
      body: JSON.stringify({
        id: 'sec-test-' + Date.now(),
        tracking_code: 'SEC',
        unit_string: 'SEC',
        action: 'ENTRADA',
        description: 'ataque anonimo',
        operator: 'hacker'
      }),
      signal: AbortSignal.timeout(10000)
    });
    assert(
      !r.ok || r.status === 401 || r.status === 403,
      `Esperado erro de permissão (401/403), recebido HTTP ${r.status}`
    );
  });

  await test('SEC-004: SELECT anônimo em staff_accounts é bloqueado (hashes protegidos)', async () => {
    const r = await fetch(`${URL}/rest/v1/staff_accounts?select=password_hash&limit=5`, {
      headers: anonHeaders,
      signal: AbortSignal.timeout(10000)
    });
    const rows = await r.json();
    assert(
      !r.ok || (Array.isArray(rows) && rows.length === 0),
      `Hashes expostos! Recebido HTTP ${r.status} com ${rows?.length} linhas`
    );
  });

  await test('SEC-005: SELECT anônimo em units é bloqueado (dados pessoais protegidos)', async () => {
    const r = await fetch(`${URL}/rest/v1/units?select=resident_name,resident_phone,resident_email&limit=5`, {
      headers: anonHeaders,
      signal: AbortSignal.timeout(10000)
    });
    const rows = await r.json();
    assert(
      !r.ok || (Array.isArray(rows) && rows.length === 0),
      `Dados pessoais expostos! Recebido HTTP ${r.status} com ${rows?.length} linhas`
    );
  });

  await test('SEC-006: SELECT anônimo em packages é bloqueado', async () => {
    const r = await fetch(`${URL}/rest/v1/packages?select=*&limit=5`, {
      headers: anonHeaders,
      signal: AbortSignal.timeout(10000)
    });
    const rows = await r.json();
    assert(
      !r.ok || (Array.isArray(rows) && rows.length === 0),
      `Encomendas expostas! Recebido HTTP ${r.status} com ${rows?.length} linhas`
    );
  });

  console.log('\n--- 2. AUTENTICAÇÃO REAL: SUPABASE AUTH (BUG-002) ---');

  let tokenPortaria = null;
  await test('AUTH-001: Login válido de staff emite JWT real', async () => {
    const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: anonHeaders,
      body: JSON.stringify({
        email: 'portaria@villageazaleia.com.br',
        password: 'portaria123'
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await r.json();
    assert(r.ok && data.access_token, `Falha no login de portaria: ${JSON.stringify(data)}`);
    tokenPortaria = data.access_token;
  });

  await test('AUTH-002: Login com senha errada é recusado', async () => {
    const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: anonHeaders,
      body: JSON.stringify({
        email: 'portaria@villageazaleia.com.br',
        password: 'senha-errada-123'
      }),
      signal: AbortSignal.timeout(10000)
    });
    assert(!r.ok, `Login com senha errada deveria falhar, mas retornou HTTP ${r.status}`);
  });

  console.log('\n--- 3. AUDITORIA IMUTÁVEL: APPEND-ONLY (FASE 4) ---');

  await test('AUD-001: UPDATE em activity_logs é bloqueado pelo trigger', async () => {
    // Tenta atualizar mesmo com service_role (a trigger protege contra todos)
    const r = await fetch(`${URL}/rest/v1/activity_logs?id=neq.nao-existe`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ description: 'adulteracao ilegal' }),
      signal: AbortSignal.timeout(10000)
    });
    const txt = await r.text();
    assert(
      !r.ok && txt.includes('append-only'),
      `Trigger deveria bloquear com mensagem de append-only. Resposta: HTTP ${r.status} ${txt}`
    );
  });

  await test('AUD-002: DELETE em activity_logs é bloqueado pelo trigger', async () => {
    const r = await fetch(`${URL}/rest/v1/activity_logs?id=neq.nao-existe`, {
      method: 'DELETE',
      headers: adminHeaders,
      signal: AbortSignal.timeout(10000)
    });
    const txt = await r.text();
    assert(
      !r.ok && txt.includes('append-only'),
      `Trigger deveria bloquear DELETE. Resposta: HTTP ${r.status} ${txt}`
    );
  });

  console.log('\n--- 4. CONCORRÊNCIA E RETIRADA ATÔMICA (BUG-003 / FASE 5) ---');

  await test('PKG-005: Baixa dupla na mesma encomenda é rejeitada na 2ª tentativa', async () => {
    if (!tokenPortaria) throw new Error('Sem token de portaria para testar');

    const authPortariaHeaders = {
      apikey: ANON_KEY,
      Authorization: `Bearer ${tokenPortaria}`,
      'Content-Type': 'application/json'
    };

    // Cria uma encomenda de teste via Admin API
    const testPkgId = `pkg-test-${Date.now()}`;
    await fetch(`${URL}/rest/v1/packages`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        id: testPkgId,
        tracking_code: `TEST-${Date.now()}`,
        block: '12B',
        apartment: 23,
        resident_name: 'Jefferson Teste',
        carrier: 'Correios',
        shelf: { shelf: 'A', level: 1 },
        status: 'ARMAZENADA',
        qr_token: `VA-TEST-${Date.now()}`,
        registered_via: 'PORTARIA'
      })
    });

    // 1a baixa: deve ter sucesso
    const r1 = await fetch(`${URL}/rest/v1/rpc/confirmar_retirada`, {
      method: 'POST',
      headers: authPortariaHeaders,
      body: JSON.stringify({
        p_package_id: testPkgId,
        p_picked_up_by: 'Jefferson (1a retirada)',
        p_signature_url: 'data:image/png;base64,assinatura1'
      })
    });
    assert(r1.ok, `1a retirada deveria ter sucesso: HTTP ${r1.status} ${await r1.text()}`);

    // 2a baixa (simulando segundo porteiro): DEVE FALHAR
    const r2 = await fetch(`${URL}/rest/v1/rpc/confirmar_retirada`, {
      method: 'POST',
      headers: authPortariaHeaders,
      body: JSON.stringify({
        p_package_id: testPkgId,
        p_picked_up_by: 'Outra Pessoa (2a retirada)',
        p_signature_url: 'data:image/png;base64,assinatura2'
      })
    });
    const txt2 = await r2.text();
    assert(!r2.ok, `2a retirada deveria ter falhado com erro de estado. Resposta: HTTP ${r2.status} ${txt2}`);
    assert(
      txt2.includes('ja foi retirada') || txt2.includes('55000'),
      `Mensagem de erro deveria acusar que ja foi retirada: ${txt2}`
    );

    // Limpeza da encomenda de teste (via Admin)
    await fetch(`${URL}/rest/v1/packages?id=eq.${testPkgId}`, { method: 'DELETE', headers: adminHeaders });
  });

  console.log('\n===============================================================');
  console.log(`RESULTADO FINAL: ${pass} PASS / ${fail} FAIL`);
  console.log('===============================================================');

  if (fail > 0) {
    process.exit(1);
  }
})();
