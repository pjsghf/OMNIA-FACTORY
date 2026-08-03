/**
 * End-to-end provider verification.
 *
 * The unit/integration suites deliberately never touch a real provider, so nothing
 * in CI can tell you whether the configured model ids actually exist or whether the
 * OpenCode endpoint answers. This script does exactly that, against live APIs, and
 * is meant to be run by hand after changing catalog.ts or provider URLs.
 *
 *   npm run verify:providers
 *
 * Reads GEMINI_API_KEY / OPENCODE_API_KEY from .env. Each provider is skipped (not
 * failed) when its key is absent, so it is useful with only one of them configured.
 * Exits non-zero if anything configured is broken.
 */
import dotenv from 'dotenv';
import {
  GEMINI_MODEL_CATALOG,
  OPENCODE_DEFAULT_BASE_URL,
  OPENCODE_DEFAULT_MODEL,
} from '../src/lib/ai/catalog';

dotenv.config();

const PASS = '\u001b[32mPASS\u001b[0m';
const FAIL = '\u001b[31mFAIL\u001b[0m';
const SKIP = '\u001b[33mSKIP\u001b[0m';

let failures = 0;
let passes = 0;
let skips = 0;

function report(status: string, label: string, detail = '') {
  if (status === FAIL) failures++;
  else if (status === PASS) passes++;
  else skips++;
  console.log(`  ${status}  ${label}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Distinguishes "the corporate/sandbox proxy refused to tunnel" from "the provider
 * rejected the request". Both surface as 403, and conflating them turns a network
 * policy issue into a wild goose chase after a perfectly valid API key.
 */
function isEgressBlock(status: number, body: string): boolean {
  if (status !== 403) return false;
  return /not in allowlist|egress|CONNECT|tunnel|proxy/i.test(body);
}

/** Never print a key, even partially reconstructable. */
function redact(text: string): string {
  let out = text;
  for (const key of [process.env.GEMINI_API_KEY, process.env.OPENCODE_API_KEY]) {
    if (key) out = out.split(key).join('***REDACTED***');
  }
  return out;
}

async function verifyGemini() {
  console.log('\n=== Gemini ===');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    report(SKIP, 'GEMINI_API_KEY ausente — Gemini desativado por ora (esperado)');
    return;
  }

  // ListModels is the authoritative answer to "does this id exist for my account?"
  let liveIds: Set<string>;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`
    );
    if (!res.ok) {
      report(
        FAIL,
        `GET /v1beta/models devolveu ${res.status}`,
        redact((await res.text()).slice(0, 200))
      );
      return;
    }
    const data = (await res.json()) as { models?: { name?: string }[] };
    liveIds = new Set((data.models || []).map((m) => (m.name || '').replace(/^models\//, '')));
    report(PASS, `API respondeu com ${liveIds.size} modelos disponíveis`);
  } catch (err: any) {
    report(FAIL, 'Não foi possível listar modelos', redact(String(err?.message || err)));
    return;
  }

  for (const id of Object.keys(GEMINI_MODEL_CATALOG)) {
    const entry = GEMINI_MODEL_CATALOG[id]!;
    const suffix = entry.isDefault ? ' (PADRÃO)' : '';
    if (liveIds.has(id)) {
      report(PASS, `catálogo: ${id}${suffix}`);
    } else {
      report(
        FAIL,
        `catálogo: ${id}${suffix}`,
        entry.isDefault
          ? 'NÃO EXISTE — este é o padrão, TODA geração de texto vai falhar'
          : 'não existe nesta conta; remova de catalog.ts ou troque o id'
      );
    }
  }
}

async function verifyOpenCode() {
  console.log('\n=== OpenCode GO ===');
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    report(SKIP, 'OPENCODE_API_KEY ausente no .env');
    return;
  }

  const baseUrl = process.env.OPENCODE_BASE_URL || OPENCODE_DEFAULT_BASE_URL;
  const model = process.env.OPENCODE_MODEL || OPENCODE_DEFAULT_MODEL;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responda apenas: ok' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(30000),
    });

    const body = await res.text();

    if (res.ok) {
      const content = JSON.parse(body)?.choices?.[0]?.message?.content;
      report(PASS, `${baseUrl} respondeu`, `modelo ${model}, resposta: ${JSON.stringify(content)}`);
    } else if (isEgressBlock(res.status, body)) {
      // Must be checked before the 401/403 branch: a proxy that denies CONNECT
      // answers 403 too, and reading that as "your key was rejected" sends you
      // hunting for a credential problem that does not exist.
      report(
        SKIP,
        'Bloqueado pela rede, não pelo provedor',
        `${redact(body.trim().slice(0, 120))} — rode este script fora do sandbox/proxy`
      );
    } else if (res.status === 401 || res.status === 403) {
      report(
        FAIL,
        `${baseUrl} rejeitou a chave (${res.status})`,
        'endpoint correto, credencial inválida ou sem crédito'
      );
    } else if (res.status === 404) {
      report(
        FAIL,
        `${baseUrl} devolveu 404 para o modelo '${model}'`,
        'a URL base ou o id do modelo está errado — confira ambos na documentação do OpenCode'
      );
    } else if (res.status === 400 && /model/i.test(body)) {
      report(
        FAIL,
        `O modelo '${model}' foi rejeitado pelo gateway`,
        `${redact(body.slice(0, 160))} — ajuste OPENCODE_DEFAULT_MODEL em catalog.ts`
      );
    } else {
      report(FAIL, `${baseUrl} devolveu ${res.status}`, redact(body.slice(0, 200)));
    }
  } catch (err: any) {
    report(FAIL, `Não foi possível alcançar ${baseUrl}`, redact(String(err?.message || err)));
  }
}

async function main() {
  console.log('Verificação de provedores de IA (chamadas reais, custo mínimo)');
  console.log(`Modelo OpenCode alvo: ${process.env.OPENCODE_MODEL || OPENCODE_DEFAULT_MODEL}`);
  await verifyGemini();
  await verifyOpenCode();

  // "No failures" is not the same as "verified": everything may have been skipped
  // for a missing key or a blocked host, and reporting that as success is exactly
  // the false all-clear this script exists to prevent.
  if (failures > 0) {
    console.log(`\n${failures} verificação(ões) FALHARAM — veja os detalhes acima.\n`);
  } else if (passes === 0) {
    console.log(
      `\nNADA FOI VERIFICADO: ${skips} verificação(ões) puladas (chave ausente ou host bloqueado).\n` +
        'Isto NÃO significa que os provedores funcionam.\n'
    );
  } else {
    console.log(
      `\n${passes} verificação(ões) OK` +
        (skips > 0 ? `, ${skips} pulada(s) — estas continuam não verificadas.` : '.') +
        '\n'
    );
  }

  // Exit 2 for "inconclusive" so CI or a wrapper can tell it apart from success.
  process.exit(failures > 0 ? 1 : passes === 0 ? 2 : 0);
}

main();
