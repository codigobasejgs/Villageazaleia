/**
 * Self-check das funcoes serverless (api/*): compila com a resolucao ESTRITA do Node
 * (module/moduleResolution = nodenext) e importa cada funcao como ESM real.
 *
 * POR QUE ISSO EXISTE: o projeto e "type": "module" e o tsconfig usa
 * moduleResolution "bundler", entao `npx tsc --noEmit` e `npm run build` passam
 * limpos mesmo com import relativo SEM extensao .js — mas na Vercel a funcao morre
 * em runtime com ERR_MODULE_NOT_FOUND antes de executar qualquer logica. Isso
 * derrubou OCR, e-mail e WhatsApp em producao sem nenhum sinal local.
 *
 * Tambem valida que cada funcao exporta um metodo HTTP NOMEADO (POST/GET/...),
 * e nao `export default` — a Vercel exige export nomeado neste projeto.
 *
 * Uso: node scripts/test-api-esm.cjs
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const outDir = path.join(raiz, '.tmp-esm-check');
const apiDir = path.join(raiz, 'api');
const METODOS_HTTP = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function listarFuncoes(dir) {
  const encontrados = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      // _lib nao e endpoint: e helper compartilhado, importado pelos endpoints.
      if (entrada.name !== '_lib') encontrados.push(...listarFuncoes(p));
    } else if (entrada.name.endsWith('.ts')) {
      encontrados.push(p);
    }
  }
  return encontrados;
}

(async () => {
  const fontes = listarFuncoes(apiDir);
  if (fontes.length === 0) {
    console.error('Nenhuma funcao encontrada em api/');
    process.exit(1);
  }

  fs.rmSync(outDir, { recursive: true, force: true });

  console.log(`=== 1. Compilando ${fontes.length} funcoes com resolucao estrita do Node (nodenext) ===`);
  try {
    const relFontes = fontes.map((f) => path.relative(raiz, f).replace(/\\/g, '/'));
    execFileSync(
      'npx',
      ['tsc', ...relFontes, '--module', 'nodenext', '--moduleResolution', 'nodenext',
       '--target', 'ES2022', '--skipLibCheck', '--outDir', '.tmp-esm-check'],
      { cwd: raiz, stdio: 'pipe', shell: true }
    );
    console.log('OK — compilou sem erros de resolucao\n');
  } catch (err) {
    console.error('FALHOU na compilacao:\n' + (err.stdout || err.message).toString());
    process.exit(1);
  }

  console.log('=== 2. Importando cada funcao como ESM real (igual runtime da Vercel) ===');
  let falhas = 0;

  for (const fonte of fontes) {
    const rel = path.relative(apiDir, fonte).replace(/\\/g, '/').replace(/\.ts$/, '');
    const compilado = path.join(outDir, rel + '.js');
    const url = 'file:///' + compilado.replace(/\\/g, '/');

    try {
      const mod = await import(url);
      const metodos = Object.keys(mod).filter((k) => METODOS_HTTP.includes(k));

      if (metodos.length === 0) {
        const temDefault = 'default' in mod;
        console.log(`FALHOU ${rel} — sem metodo HTTP nomeado exportado` +
          (temDefault ? ' (achou "export default": a Vercel exige export NOMEADO)' : ''));
        falhas++;
      } else {
        console.log(`OK     ${rel} -> ${metodos.join(', ')}`);
      }
    } catch (err) {
      console.log(`FALHOU ${rel} -> ${err.code || 'ERRO'}: ${String(err.message).split('\n')[0]}`);
      falhas++;
    }
  }

  fs.rmSync(outDir, { recursive: true, force: true });

  if (falhas > 0) {
    console.log(`\n=== RESULTADO: ${falhas} funcao(oes) quebrariam em producao ===`);
    process.exit(1);
  }
  console.log(`\n=== RESULTADO: as ${fontes.length} funcoes carregam como ESM real e expoem metodo HTTP nomeado ===`);
})();
