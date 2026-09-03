/**
 * POST /api/units/claim
 * Cadastro seguro de morador: cria a conta no Supabase Auth, insere a Unit no
 * banco (apenas se o bloco+apartamento estiver livre) e vincula o perfil.
 *
 * Fecha o BUG-007 (sequestro de unidade por cadastro duplicado).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const adminHeaders = () => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
});

export async function POST(request: Request): Promise<Response> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Servidor nao configurado.' }), { status: 503 });
  }

  let body: {
    block?: string;
    apartment?: number;
    residentName?: string;
    residentEmail?: string;
    residentPhone?: string;
    residentPhones?: Array<{ id: string; label: string; number: string; isWhatsapp: boolean }>;
    password?: string;
    lgpdAccepted?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON invalido.' }), { status: 400 });
  }

  const { block, apartment, residentName, residentEmail, residentPhone, password, lgpdAccepted } = body;

  if (!block || !apartment || !residentName || !residentEmail || !password) {
    return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatorios nao preenchidos.' }), { status: 400 });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ ok: false, error: 'A senha precisa ter pelo menos 8 caracteres.' }), { status: 400 });
  }

  if (!lgpdAccepted) {
    return new Response(JSON.stringify({ ok: false, error: 'O consentimento LGPD e obrigatorio para o cadastro.' }), { status: 400 });
  }

  const emailNorm = residentEmail.trim().toLowerCase();
  const unitId = `B${String(block).padStart(2, '0')}-A${apartment}`;

  try {
    // 1. Verifica se a unidade ja esta cadastrada no banco
    const unitCheckRes = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/units?block=eq.${encodeURIComponent(block)}&apartment=eq.${apartment}&select=id,resident_name`,
      { headers: adminHeaders(), signal: AbortSignal.timeout(8000) }
    );
    const existingUnits = await unitCheckRes.json();

    if (Array.isArray(existingUnits) && existingUnits.length > 0) {
      // Unidade ja ocupada: impede sobrescrever (BUG-007)
      return new Response(
        JSON.stringify({
          ok: false,
          error: `O Bloco ${block} Apto ${apartment} ja possui cadastro ativo no sistema. Procure a portaria ou o sindico caso precise atualizar o titular.`
        }),
        { status: 409 }
      );
    }

    // 2. Cria o usuario no Supabase Auth
    const userRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        email: emailNorm,
        password,
        email_confirm: true,
        user_metadata: { name: residentName.trim() }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!userRes.ok) {
      const err = await userRes.json().catch(() => ({}));
      // A Admin API do Supabase varia o formato do erro entre versoes: as vezes
      // vem em `msg`, as vezes em `message`, e sempre tem `error_code` quando
      // e um caso conhecido. Checar so `.message` deixava esse erro invisivel
      // (campo undefined -> string vazia -> nenhuma keyword batia).
      const rawMsg = err.msg || err.message || err.error_description || '';
      const m = String(rawMsg).toLowerCase();
      const isDuplicate =
        err.error_code === 'email_exists' ||
        userRes.status === 422 ||
        m.includes('already') ||
        m.includes('registered') ||
        m.includes('exists');

      if (isDuplicate) {
        return new Response(JSON.stringify({ ok: false, error: 'Este e-mail ja possui conta. Use "Entrar".' }), { status: 409 });
      }
      return new Response(
        JSON.stringify({ ok: false, error: 'Falha ao criar usuario' + (rawMsg ? ': ' + rawMsg : ' (sem detalhes do servidor).') }),
        { status: 400 }
      );
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // 3. Insere a Unit no banco
    const nowIso = new Date().toISOString();
    const phones = (body.residentPhones || []).filter((p) => {
      const clean = (p.number || '').replace(/\D/g, '');
      return clean.length >= 10 && !clean.includes('999990000');
    });

    const unitRow = {
      id: unitId,
      block: String(block),
      apartment: Number(apartment),
      resident_name: residentName.trim(),
      resident_phone: residentPhone ? residentPhone.trim() : (phones[0]?.number || ''),
      resident_phones: phones,
      resident_email: emailNorm,
      pwa_installed: true,
      push_enabled: true,
      registered_at: nowIso,
      lgpd_accepted: true,
      lgpd_accepted_at: nowIso
    };

    const unitInsertRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/units`, {
      method: 'POST',
      headers: { ...adminHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify(unitRow),
      signal: AbortSignal.timeout(8000)
    });

    if (!unitInsertRes.ok) {
      // Rollback: remove o auth.user se o insert da unit falhar (com timeout seguro)
      try {
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: adminHeaders(),
          signal: AbortSignal.timeout(8000)
        });
      } catch {
        // Log silencioso do rollback
      }
      return new Response(JSON.stringify({ ok: false, error: 'Nao foi possivel registrar a unidade.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Cria o perfil vinculado a unidade (com checagem de erro + rollback completo se falhar)
    const profileRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        id: userId,
        role: 'morador',
        name: residentName.trim(),
        unit_id: unitId,
        active: true
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!profileRes.ok) {
      // Rollback em cadeia: apaga unit e auth.user pra nao deixar orfao
      try {
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/units?id=eq.${encodeURIComponent(unitId)}`, {
          method: 'DELETE',
          headers: adminHeaders(),
          signal: AbortSignal.timeout(8000)
        });
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: adminHeaders(),
          signal: AbortSignal.timeout(8000)
        });
      } catch {
        // Falha no rollback nao bloqueia resposta
      }
      return new Response(JSON.stringify({ ok: false, error: 'Nao foi possivel criar o perfil do morador.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true, unit: unitRow }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Erro interno.' }), { status: 500 });
  }
}
