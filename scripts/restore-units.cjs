/**
 * Restaura as units salvas no backup para a tabela units do Supabase.
 * Usa service_role para restaurar com seguranca.
 */
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const pick = (name) => {
  const m = env.match(new RegExp('^' + name + '="?([^"\\n]+)"?', 'm'));
  return m ? m[1] : '';
};

const URL = pick('VITE_SUPABASE_URL');
const SERVICE_KEY = pick('SUPABASE_SERVICE_ROLE_KEY');

(async () => {
  const latestBackup = fs.readdirSync(path.join(__dirname, '..', 'backups')).sort().pop();
  const backupUnits = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'backups', latestBackup, 'units.json'), 'utf8')
  );

  console.log(`Restaurando ${backupUnits.length} unidade(s) do backup ${latestBackup}...`);

  for (const u of backupUnits) {
    // Remove o campo password_hash legado (as senhas agora vivem no Supabase Auth)
    const row = {
      id: u.id,
      block: String(u.block),
      apartment: Number(u.apartment),
      resident_name: u.resident_name,
      resident_phone: u.resident_phone,
      resident_phones: u.resident_phones || [],
      resident_email: u.resident_email,
      pwa_installed: u.pwa_installed ?? false,
      push_enabled: u.push_enabled ?? false,
      registered_at: u.registered_at || new Date().toISOString(),
      lgpd_accepted: Boolean(u.lgpd_accepted),
      lgpd_accepted_at: u.lgpd_accepted_at || null
    };

    const r = await fetch(`${URL}/rest/v1/units`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(row)
    });

    if (r.ok) {
      console.log(`  + Unidade restaurada: ${row.id} (${row.resident_name} - Bloco ${row.block} Apt ${row.apartment})`);
    } else {
      console.error(`  x Falha ao restaurar ${row.id}: HTTP ${r.status}`, await r.text());
    }
  }
})();
