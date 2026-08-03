import { validateBookConfig } from '../src/lib/ai/validation/configValidator';
import { reconcileEditorialPlan } from '../src/lib/ai/validation/planReconciler';
import { buildChapterSectionPlan } from '../src/lib/ai/planning/chapterSectionPlanner';
import { normalizeProse } from '../src/lib/ai/normalization/proseNormalizer';
import { validateChapterContent } from '../src/lib/ai/validation/contentValidator';
import { checkChapterCoverage } from '../src/lib/ai/validation/coverageChecker';
import { detectSensitiveNiche } from '../src/lib/ai/policies/sensitiveNichePolicy';
import { createInitialBookBibleMemory, updateBookBibleMemoryWithChapter, formatMemoryForPrompt } from '../src/lib/ai/memory/bookBibleMemory';

async function runPhase5Audit() {
  console.log('=== STARTING PHASE 5 (RECONSTRUCT PLANNING & DRAFTING) AUDIT TESTS ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
    }
  }

  // 1. Config Validation Tests
  console.log('--- 1. Pre-planning Configuration Validation Tests ---');
  const invalidConfig = validateBookConfig({
    titulo: '',
    autor: '',
    qtdCapitulos: -5,
    minPalavras: 100,
    maxPalavras: 50,
  });
  assert(!invalidConfig.valid, 'Rejects empty title, empty author, negative chapters, invalid word bounds');
  assert(Boolean(invalidConfig.errors.titulo && invalidConfig.errors.autor && invalidConfig.errors.qtdCapitulos), 'Reports field-specific error messages');

  const validConfig = validateBookConfig({
    titulo: 'O Código da Mente Suplementar',
    autor: 'Dr. Roberto Silva',
    qtdCapitulos: 8,
    minPalavras: 1200,
    maxPalavras: 2500,
  });
  assert(validConfig.valid && validConfig.sanitizedMetadata?.qtdCapitulos === 8, 'Accepts valid metadata and sanitizes fields');

  // 2. Plan Reconciliation Tests
  console.log('\n--- 2. Plan Reconciliation & Invariant Tests ---');
  const rawAiPlan = {
    conceitoCentral: 'Aprimoramento neural',
    sumario: [
      { numero: 1, titulo: 'Cap 1', estimativaPalavras: 500 },
      { numero: 2, titulo: 'Cap 2', estimativaPalavras: 1500 },
    ],
  };
  const reconciled = reconcileEditorialPlan(rawAiPlan, validConfig.sanitizedMetadata!);
  assert(reconciled.reconciledPlan.sumario.length === 8, 'Reconciles sumario to exact requested chapter count (8)');
  assert((reconciled.reconciledPlan.sumario[0]?.estimativaPalavras ?? 0) >= 1200, 'Adjusts chapter word estimate up to min boundary');

  // 3. Sub-block Chapter Planning Tests
  console.log('\n--- 3. Sub-block Chapter Planning Tests ---');
  const chapterPlan = reconciled.reconciledPlan.sumario[0];
  if (chapterPlan) {
    const detailed = buildChapterSectionPlan(chapterPlan, validConfig.sanitizedMetadata!);
    assert(detailed.sections.length >= 2, 'Divides chapter into sub-block working sections (>= 2 sections)');
    assert((detailed.sections[0]?.estimativaPalavras ?? 0) >= 600 && (detailed.sections[0]?.estimativaPalavras ?? 0) <= 1200, 'Sub-block word estimates stay in optimal 600-1200 range');
  }

  // 4. Non-Destructive Prose Normalization Tests
  console.log('\n--- 4. Non-Destructive Prose Normalization Tests ---');
  const rawCodeAndMathText = `Aqui está o capítulo:

O cálculo do algorítmo é dado pela fórmula $E = m * c^2$ e $2 * 3 * 4 = 24$.
Variável técnica: \`snake_case_variable_name\`

\`\`\`typescript
const result = calculate_sum(10, 20);
\`\`\`

Espero que goste deste capítulo!`;

  const normalized = normalizeProse(rawCodeAndMathText);
  assert(!normalized.includes('Aqui está o capítulo:'), 'Removes AI conversational prefix');
  assert(!normalized.includes('Espero que goste deste capítulo!'), 'Removes AI conversational suffix');
  assert(normalized.includes('$E = m * c^2$') && normalized.includes('2 * 3 * 4 = 24'), 'Preserves mathematical expression $E = m * c^2$ and $2 * 3 * 4 = 24$ without regex corruption');
  assert(normalized.includes('snake_case_variable_name'), 'Preserves inline code with snake_case variables');
  assert(normalized.includes('const result = calculate_sum(10, 20);'), 'Preserves code blocks intact');

  // 5. Content Validation & Word Count Tests
  console.log('\n--- 5. Content Validation & Word Count Tests ---');
  const emptyVal = validateChapterContent('', 1000);
  assert(!emptyVal.valid && emptyVal.isEmpty, 'Detects empty AI response');

  const truncatedText = 'O desenvolvimento da consciência corporal exige prática diária e foco constante na respiração sem parar';
  const truncatedVal = validateChapterContent(truncatedText, 1000);
  assert(!truncatedVal.valid && truncatedVal.isTruncated, 'Detects truncated response without terminal punctuation');

  const completeText = 'O desenvolvimento da consciência corporal exige prática diária e foco constante na respiração profunda. Ao cultivar essa presença, o leitor alcança maior equilíbrio emocional e físico ao longo do tempo.';
  const completeVal = validateChapterContent(completeText, 30);
  assert(completeVal.valid, 'Validates complete text with terminal punctuation and sufficient word count');

  // 6. Coverage & Restriction Verification Tests
  console.log('\n--- 6. Coverage & Restriction Verification Tests ---');
  const coverageMeta = {
    ...validConfig.sanitizedMetadata!,
    informacoesObrigatorias: 'Mindfulness, Respiração',
    restricoes: 'Pseudo-ciência, Palavrões',
  };
  const coverageReport = checkChapterCoverage(completeText, ['Mindfulness', 'Respiração'], coverageMeta);
  assert(coverageReport.coverageScore >= 50, 'Calculates coverage score for mandatory topics');
  assert(coverageReport.forbiddenTermsViolated.length === 0, 'Verifies no forbidden terms were violated');

  // 7. Sensitive Niche Policy Tests
  console.log('\n--- 7. Sensitive Niche Policy Tests ---');
  const healthPolicy = detectSensitiveNiche({ estilo: 'saude_bem_estar', resumo: 'Tratamento de diabetes' });
  assert(healthPolicy.type === 'health' && healthPolicy.requiresSources, 'Detects health sensitive niche and requires sources');
  assert(healthPolicy.mandatoryDisclaimer.includes('não substituindo o diagnóstico'), 'Attaches mandatory health disclaimer');

  const financePolicy = detectSensitiveNiche({ estilo: 'financas_investimentos', resumo: 'Investir em ações' });
  assert(financePolicy.type === 'finance' && financePolicy.mandatoryDisclaimer.includes('não constitui recomendação'), 'Detects finance sensitive niche and attaches mandatory financial disclaimer');

  // 8. BookBible Editorial Memory Tests
  console.log('\n--- 8. BookBible Editorial Memory & Continuity Tests ---');
  let memory = createInitialBookBibleMemory();
  memory = updateBookBibleMemoryWithChapter(memory, 1, 'Os Fundamentos', 'Capítulo 1 explicou os conceitos essenciais da atenção plena.', {
    keyTheses: ['Atenção plena reduz estresse'],
    termsDefined: ['Mindfulness'],
    analogiesUsed: ['Metáfora do oceano e ondas'],
  });

  assert(memory.resumosCapitulos.length === 1, 'Records chapter 1 summary in BookBible memory');
  assert(memory.datasETermos.includes('Mindfulness'), 'Stores defined terms in BookBible memory');

  const memoryPromptText = formatMemoryForPrompt(memory);
  assert(memoryPromptText.includes('Metáfora do oceano e ondas'), 'Formats memory text for injection into chapter 2 writer prompt');

  console.log(`\n=== PHASE 5 AUDIT RESULTS: ${passed}/${total} PASSED ===`);
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase5Audit();
