/**
 * Testa se um morador autenticado consegue de fato ATUALIZAR a propria unidade
 * (ex: adicionar telefone), replicando exatamente o dbService.updateUnit novo.
 * Cria uma conta de teste descartavel, testa, e limpa tudo no final.
 *
 * Uso: node scripts/test-morador-update-unit.cjs
 */
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const pick = (name) => {
  const m = env.match(new RegExp('^' + name + '="?([^"\\n]+)"?', 'm'));
  return m ? m[1] : '';
};

const URL = pick('VITE_SUPABASE_URL');
const ANON_KEY = pick('VITE_SUPABASE_ANON_KEY');
const SERVICE_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

const adminHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
const TEST_EMAIL = `teste-update-unit-${Date.now()}@example.com`;
const TEST_PASSWORD = 'teste12345678';
const UNIT_ID = 'B99-A999';

(async () => {
  let userId = null;
  try {
    console.log('=== 1. Criar usuario + unidade de teste (via service_role) ===');
    const userRes = await fetch(`${URL}/auth/v1/admin/users`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true, user_metadata: { name: 'Teste Update' } })
    });
    const user = await userRes.json();
    if (!userRes.ok) throw new Error('Falha ao criar usuario: ' + JSON.stringify(user));
    userId = user.id;

    await fetch(`${URL}/rest/v1/units`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({
        id: UNIT_ID, block: '99', apartment: 999, resident_name: 'Teste Update',
        resident_phone: '(11) 90000-0001', resident_phones: [{ id: 'p1', label: 'Titular', number: '(11) 90000-0001', isWhatsapp: true }],
        resident_email: TEST_EMAIL, lgpd_accepted: true, lgpd_accepted_at: new Date().toISOString()
      })
    });

    await fetch(`${URL}/rest/v1/profiles`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ id: userId, role: 'morador', name: 'Teste Update', unit_id: UNIT_ID, active: true })
    });
    console.log('OK — unidade B99-A999 criada com 1 telefone');

    console.log('\n=== 2. Login como o morador de teste ===');
    const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
    });
    const { access_token } = await loginRes.json();
    const moradorHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
    console.log('OK');

    console.log('\n=== 3. UPDATE — adicionar um 2o telefone (igual dbService.updateUnit) ===');
    const updateRes = await fetch(`${URL}/rest/v1/units?id=eq.${UNIT_ID}`, {
      method: 'PATCH', headers: moradorHeaders,
      body: JSON.stringify({
        resident_phones: [
          { id: 'p1', label: 'Titular', number: '(11) 90000-0001', isWhatsapp: true },
          { id: 'p2', label: 'Cônjuge', number: '(11) 90000-0002', isWhatsapp: true }
        ]
      })
    });
    console.log('UPDATE ->', updateRes.status, updateRes.ok ? 'OK' : await updateRes.text());
    if (!updateRes.ok) throw new Error('UPDATE falhou');

    console.log('\n=== 4. Reler do banco (simulando refresh da pagina) pra confirmar persistencia ===');
    const check = await fetch(`${URL}/rest/v1/units?id=eq.${UNIT_ID}&select=resident_phones`, { headers: adminHeaders });
    const data = await check.json();
    const phones = data[0]?.resident_phones || [];
    console.log('Telefones apos "refresh":', JSON.stringify(phones));

    if (phones.length === 2) {
      console.log('\n=== RESULTADO: telefone adicional PERSISTE apos refresh — corrigido ===');
    } else {
      console.log('\n=== RESULTADO: FALHOU — telefone adicional nao persistiu ===');
      process.exit(1);
    }
  } finally {
    console.log('\n=== Limpeza ===');
    await fetch(`${URL}/rest/v1/units?id=eq.${UNIT_ID}`, { method: 'DELETE', headers: adminHeaders });
    if (userId) await fetch(`${URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: adminHeaders });
    console.log('OK — conta e unidade de teste removidas');
  }
})();
