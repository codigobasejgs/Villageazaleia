/**
 * Provisiona as contas iniciais no Supabase Auth + public.profiles.
 * Usa a Admin API (service_role) — roda no servidor ou localmente, nunca no browser.
 *
 * Preserva as senhas de staff existentes ('portaria123' e 'sindico123') e recria
 * a conta do morador com uma senha temporaria que ele redefine no primeiro login.
 *
 * Uso: node scripts/setup-auth-users.cjs
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

if (!URL || !SERVICE_KEY) {
  console.error('Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const CONTAS = [
  {
    email: 'portaria@villageazaleia.com.br',
    password: 'portaria123',
    name: 'Silvio Portaria',
    role: 'portaria',
    unitId: null
  },
  {
    email: 'sindico@villageazaleia.com.br',
    password: 'sindico123',
    name: 'Marcos Síndico',
    role: 'sindico',
    unitId: null
  },
  {
    // Totem fisico da portaria (kiosk): conta de servico com papel 'totem'
    email: 'totem@villageazaleia.com.br',
    password: 'totem-village-2026-kiosk',
    name: 'Totem de Autoatendimento',
    role: 'totem',
    unitId: null
  },
  {
    // Conta do morador existente no backup
    email: 'Jefferson.22gs@gmail.com',
    password: 'morador123456', // Senha inicial — redefinir no primeiro acesso
    name: 'Jefferson Gomes dos Santos',
    role: 'morador',
    unitId: 'B12B-A23'
  }
];

(async () => {
  console.log('Provisionando contas no Supabase Auth...');

  for (const c of CONTAS) {
    try {
      // 1. Cria ou atualiza o usuario em auth.users (via Admin API do Supabase)
      const userRes = await fetch(`${URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          email: c.email.toLowerCase(),
          password: c.password,
          email_confirm: true, // Confirma o e-mail automaticamente (sem envio de confirmacao)
          user_metadata: { name: c.name }
        }),
        signal: AbortSignal.timeout(15000)
      });

      let userId = null;
      if (userRes.ok) {
        const u = await userRes.json();
        userId = u.id;
        console.log(`  + auth.users criado: ${c.email} (id: ${userId})`);
      } else {
        const err = await userRes.json();
        // Se ja existe, busca o id
        const listRes = await fetch(`${URL}/auth/v1/admin/users`, {
          headers: adminHeaders,
          signal: AbortSignal.timeout(15000)
        });
        const list = await listRes.json();
        const existing = (list.users || []).find(
          (x) => x.email.toLowerCase() === c.email.toLowerCase()
        );
        if (existing) {
          userId = existing.id;
          console.log(`  = auth.users ja existia: ${c.email} (id: ${userId})`);
        } else {
          console.error(`  x Falha ao criar ${c.email}:`, err);
          continue;
        }
      }

      // 2. Cria/atualiza o perfil em public.profiles
      const profileRes = await fetch(`${URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          ...adminHeaders,
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userId,
          role: c.role,
          name: c.name,
          unit_id: c.unitId,
          active: true
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (profileRes.ok) {
        console.log(`  + public.profiles atualizado: ${c.email} -> role=${c.role}`);
      } else {
        const pErr = await profileRes.text();
        console.error(`  x Falha ao gravar profile para ${c.email}:`, pErr);
      }
    } catch (e) {
      console.error(`  x Erro ao processar ${c.email}:`, e.message);
    }
  }

  console.log('\nConcluido. Agora as politicas RLS tem identidade real em que se apoiar.');
})();
