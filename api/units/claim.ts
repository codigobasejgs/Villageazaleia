/**
 * POST /api/units/claim
 * Cria conta de Morador e vincula à unidade (Bloco + Apto).
 *
 * SUPORTE A MÚLTIPLOS MORADORES POR UNIDADE:
 * Até 5 moradores da mesma residência (ex: Jefferson e Giuliana no Bloco 12B Apto 23)
 * podem criar suas próprias contas no app com e-mails diferentes e ter acesso às
 * MESMAS encomendas do apartamento.
 *
 * - Se a unidade AINDA NÃO EXISTE: cria o usuário em auth.users, insere a linha
 *   na tabela units (com ID canônico B12B-A23, bloco em maiúsculas), e cria o profile.
 * - Se a unidade JÁ EXISTE: cria o usuário em auth.users com seu próprio e-mail,
 *   vincula o profile à MESMA unidade já existente, e adiciona o telefone do novo
 *   morador à lista `resident_phones` da unidade (até o limite de 5 contatos).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function adminHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[Units Claim] SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL ausente.');
    return new Response(JSON.stringify({ ok: false, error: 'Servidor nao configurado.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Body JSON invalido.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { block, apartment, residentName, residentPhone, residentEmail, password, lgpdAccepted } = body || {};

  if (!block || !apartment || !residentName || !residentEmail || !password) {
    return new Response(JSON.stringify({ ok: false, error: 'Campos obrigatorios faltando.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ ok: false, error: 'A senha precisa ter no minimo 8 caracteres.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!lgpdAccepted) {
    return new Response(JSON.stringify({ ok: false, error: 'O consentimento LGPD e obrigatorio para o cadastro.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const emailNorm = residentEmail.trim().toLowerCase();
  // Bloco canônico sempre em maiúsculas (ex: "12B", não "12b") para evitar unidades duplicadas
  const blockNorm = String(block).trim().toUpperCase();
  const aptNum = Number(apartment);
  const canonicalUnitId = `B${blockNorm.padStart(2, '0')}-A${aptNum}`;

  try {
    // 1. Verifica se já existe uma unidade para esse bloco e apartamento
    const unitCheckRes = await fetch(
      `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/units?block=ilike.${encodeURIComponent(blockNorm)}&apartment=eq.${aptNum}&select=*&limit=1`,
      { headers: adminHeaders(), signal: AbortSignal.timeout(8000) }
    );
    const existingUnits = await unitCheckRes.json();
    const existingUnit = Array.isArray(existingUnits) && existingUnits.length > 0 ? existingUnits[0] : null;

    // 2. Cria o usuário no Supabase Auth
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
      const rawMsg = err.msg || err.message || err.error_description || '';
      const m = String(rawMsg).toLowerCase();
      const isDuplicate =
        err.error_code === 'email_exists' ||
        userRes.status === 422 ||
        m.includes('already') ||
        m.includes('registered') ||
        m.includes('exists');

      if (isDuplicate) {
        return new Response(JSON.stringify({ ok: false, error: 'Este e-mail ja possui conta. Use "Entrar".' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(
        JSON.stringify({ ok: false, error: 'Falha ao criar usuario' + (rawMsg ? ': ' + rawMsg : '.') }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userData = await userRes.json();
    const userId = userData.id;

    let targetUnitId = canonicalUnitId;
    let finalUnitRow: any = null;

    if (existingUnit) {
      // CENÁRIO A: Unidade já existe (familiar se cadastrando no mesmo apartamento)
      targetUnitId = existingUnit.id;
      finalUnitRow = existingUnit;

      // Adiciona o telefone do novo morador na lista de telefones da unidade (se couber, max 5)
      const newPhoneClean = String(residentPhone || '').replace(/\D/g, '');
      const currentPhones: any[] = Array.isArray(existingUnit.resident_phones) ? existingUnit.resident_phones : [];
      const phoneJaExiste = currentPhones.some((p) => String(p.number || '').replace(/\D/g, '') === newPhoneClean);

      if (newPhoneClean.length >= 10 && !phoneJaExiste && currentPhones.length < 5) {
        const updatedPhones = [
          ...currentPhones,
          {
            id: `phone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: residentName.trim().split(' ')[0] || 'Familiar',
            number: residentPhone.trim(),
            isWhatsapp: true
          }
        ];
        // Atualiza a unidade com a lista unificada de telefones
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/units?id=eq.${encodeURIComponent(targetUnitId)}`, {
          method: 'PATCH',
          headers: adminHeaders(),
          body: JSON.stringify({ resident_phones: updatedPhones }),
          signal: AbortSignal.timeout(8000)
        });
      }
    } else {
      // CENÁRIO B: Primeiro morador do apartamento (cria a unidade no banco)
      const nowIso = new Date().toISOString();
      const phones = (body.residentPhones || []).filter((p: any) => {
        const clean = (p.number || '').replace(/\D/g, '');
        return clean.length >= 10 && !clean.includes('999990000');
      });

      const unitRow = {
        id: canonicalUnitId,
        block: blockNorm,
        apartment: aptNum,
        resident_name: residentName.trim(),
        resident_phone: residentPhone ? residentPhone.trim() : (phones[0]?.number || ''),
        resident_phones: phones.length > 0 ? phones : (residentPhone ? [{ id: 'phone-1', label: 'Titular', number: residentPhone.trim(), isWhatsapp: true }] : []),
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
        // Rollback: remove o auth.user se o insert da unit falhar
        try {
          await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`, {
            method: 'DELETE',
            headers: adminHeaders(),
            signal: AbortSignal.timeout(8000)
          });
        } catch {
          // ignora
        }
        return new Response(JSON.stringify({ ok: false, error: 'Nao foi possivel registrar a unidade.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      finalUnitRow = unitRow;
    }

    // 3. Cria o perfil do morador vinculado à unidade (com rollback do auth se falhar)
    const profileRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        id: userId,
        role: 'morador',
        name: residentName.trim(),
        unit_id: targetUnitId,
        active: true
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!profileRes.ok) {
      const pErr = await profileRes.json().catch(() => ({}));
      console.warn('[Units Claim] Falha ao criar profile:', pErr);
      // Se falhou por índice único de profile (1 morador por unidade), tenta rollback
      try {
        await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: adminHeaders(),
          signal: AbortSignal.timeout(8000)
        });
      } catch {
        // ignora
      }
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Nao foi possivel vincular o perfil a unidade. Execute a migration SQL do Supabase caso mais de um morador resida no mesmo apartamento.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, unit: finalUnitRow }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Erro interno.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
