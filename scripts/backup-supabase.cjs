/**
 * Backup logico das tabelas do Supabase antes de qualquer migration.
 * Grava JSON em backups/ (gitignored). Nao apaga nem altera nada — so le.
 *
 * Uso: node scripts/backup-supabase.cjs
 */
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const pick = (name) => {
  const m = env.match(new RegExp('^' + name + '="?([^"\\n]+)"?', 'm'));
  return m ? m[1] : '';
};

const URL = pick('VITE_SUPABASE_URL');
// service_role para enxergar tudo, inclusive o que o RLS futuro vai esconder
const KEY = pick('SUPABASE_SERVICE_ROLE_KEY') || pick('VITE_SUPABASE_ANON_KEY');
const TABLES = ['units', 'staff_accounts', 'packages', 'activity_logs', 'multichannel_reports', 'push_notifications'];

(async () => {
  if (!URL || !KEY) {
    console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(__dirname, '..', 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  const h = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  let total = 0;
  let falhou = false;

  for (const t of TABLES) {
    try {
      const r = await fetch(`${URL}/rest/v1/${t}?select=*`, { headers: h, signal: AbortSignal.timeout(30000) });
      if (!r.ok) {
        console.error(`  ${t}: HTTP ${r.status} — NAO salvo`);
        falhou = true;
        continue;
      }
      const rows = await r.json();
      fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(rows, null, 2));
      console.log(`  ${t}: ${rows.length} registro(s) salvos`);
      total += rows.length;
    } catch (e) {
      console.error(`  ${t}: ERRO ${e.message} — NAO salvo`);
      falhou = true;
    }
  }

  console.log(`\nBackup em backups/${stamp}/ — ${total} registro(s) no total`);
  if (falhou) {
    console.error('ATENCAO: ao menos uma tabela nao foi salva. NAO prossiga com migrations.');
    process.exit(1);
  }
})();
