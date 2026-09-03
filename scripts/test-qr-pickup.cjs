/**
 * Testa o fluxo real de retirada por QR: login como Portaria, escaneia o QR
 * (busca a encomenda pelo qr_token, igual PortariaView.handleQrSearch faz),
 * confirma a baixa via RPC confirmar_retirada (igual App.tsx faz agora),
 * e tenta reutilizar o mesmo QR para confirmar a protecao contra reuso/dupla baixa.
 *
 * Uso: node scripts/test-qr-pickup.cjs <qr_token>
 */
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const pick = (name) => {
  const m = env.match(new RegExp('^' + name + '="?([^"\\n]+)"?', 'm'));
  return m ? m[1] : '';
};
const SUPABASE_URL = pick('VITE_SUPABASE_URL');
const ANON_KEY = pick('VITE_SUPABASE_ANON_KEY');

// PNG 1x1 transparente — placeholder de assinatura so pra satisfazer a validacao
// (nao e uma assinatura real; este e um teste de infraestrutura, nao uma entrega real assinada).
const FAKE_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

(async () => {
  const qrToken = process.argv[2];
  if (!qrToken) {
    console.error('Uso: node scripts/test-qr-pickup.cjs <qr_token>');
    process.exit(1);
  }

  console.log('=== 1. Login como Portaria ===');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'portaria@villageazaleia.com.br', password: 'portaria123' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error('Login falhou: ' + JSON.stringify(loginData));
  const token = loginData.access_token;
  const staffHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  console.log('OK');

  console.log('\n=== 2. "Escanear" o QR — buscar encomenda por qr_token (igual PortariaView.handleQrSearch) ===');
  const findRes = await fetch(`${SUPABASE_URL}/rest/v1/packages?qr_token=eq.${encodeURIComponent(qrToken)}&select=*`, { headers: staffHeaders });
  const found = await findRes.json();
  if (!Array.isArray(found) || found.length === 0) throw new Error('QR nao encontrado (nenhuma encomenda com esse token)');
  const pkg = found[0];
  console.log(`OK — Encomenda localizada: ${pkg.tracking_code} | ${pkg.resident_name} | Bloco ${pkg.block} Apt ${pkg.apartment} | status=${pkg.status}`);

  console.log('\n=== 3. Confirmar retirada via RPC confirmar_retirada (com o qr_token real) ===');
  const rpc1 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/confirmar_retirada`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      p_package_id: pkg.id,
      p_qr_token: qrToken,
      p_picked_up_by: pkg.resident_name,
      p_signature_url: FAKE_SIGNATURE,
      p_handover_photo_url: null,
      p_receipt_protocol: `REC-VA-${Date.now().toString().slice(-8)}`
    })
  });
  const rpc1Data = await rpc1.json();
  if (!rpc1.ok) {
    console.log('FALHOU (inesperado):', JSON.stringify(rpc1Data));
    process.exit(1);
  }
  console.log('OK — Retirada confirmada:');
  console.log('   status:', rpc1Data.status);
  console.log('   picked_up_at:', rpc1Data.picked_up_at);
  console.log('   picked_up_by:', rpc1Data.picked_up_by);
  console.log('   qr_consumed_at:', rpc1Data.qr_consumed_at);
  console.log('   receipt_protocol:', rpc1Data.receipt_protocol);

  console.log('\n=== 4. Tentar reutilizar o MESMO QR (simulando 2o porteiro ou reaproveitamento) ===');
  const rpc2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/confirmar_retirada`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      p_package_id: pkg.id,
      p_qr_token: qrToken,
      p_picked_up_by: 'Outra Pessoa Tentando de Novo',
      p_signature_url: FAKE_SIGNATURE,
      p_handover_photo_url: null,
      p_receipt_protocol: null
    })
  });
  const rpc2Text = await rpc2.text();
  if (rpc2.ok) {
    console.log('❌ FALHA DE SEGURANCA: a segunda retirada foi aceita! Resposta:', rpc2Text);
    process.exit(1);
  }
  console.log('OK — segunda tentativa corretamente rejeitada:');
  console.log('  ', rpc2Text.slice(0, 200));

  console.log('\n=== 5. Confirmar log de auditoria gravado ===');
  const logRes = await fetch(`${SUPABASE_URL}/rest/v1/activity_logs?package_id=eq.${pkg.id}&action=eq.RETIRADA&select=action,description,operator,timestamp`, { headers: staffHeaders });
  console.log(JSON.stringify(await logRes.json(), null, 2));

  console.log('\n=== RESULTADO: fluxo de retirada por QR funcional e protegido contra reuso ===');
})().catch((e) => {
  console.error('\nERRO:', e.message);
  process.exit(1);
});
