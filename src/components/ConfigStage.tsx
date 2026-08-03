import React, { useState } from 'react';
import { BookMetadata, BookStyle, WritingTone } from '../types';
import { PROJECT_PRESETS } from '../data/presets';
import {
  EUROPE_AMERICAS_LANGUAGES,
  BOOK_STYLES_OPTIONS,
  WRITING_TONES_OPTIONS,
  getStylePrompt,
  getTonePrompt,
} from '../data/promptsAndOptions';
import {
  Sparkles,
  Wand2,
  BookOpen,
  Settings,
  Layers,
  ShieldAlert,
  FileCode2,
  Download,
  Upload,
  HelpCircle,
  CheckCircle2,
  FileText,
  Clipboard,
  X,
  Cpu,
  Globe,
  Copy,
  Check,
} from 'lucide-react';

interface ConfigStageProps {
  metadata: BookMetadata;
  onChangeMetadata: (updated: BookMetadata) => void;
  onProceedToPlanning: () => void;
  isGeneratingPlan: boolean;
}

export const ConfigStage: React.FC<ConfigStageProps> = ({
  metadata,
  onChangeMetadata,
  onProceedToPlanning,
  isGeneratingPlan,
}) => {
  const [showTemplateGuide, setShowTemplateGuide] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Paste JSON Modal State
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pastedJsonText, setPastedJsonText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handleChange = (field: keyof BookMetadata, value: any) => {
    onChangeMetadata({ ...metadata, [field]: value });
  };

  const loadPreset = (presetId: string) => {
    const found = PROJECT_PRESETS.find((p) => p.id === presetId);
    if (found && found.metadata) {
      onChangeMetadata({
        ...metadata,
        ...found.metadata,
      });
    }
  };

  // Process raw JSON text (used by both file upload and direct paste)
  const processAndImportJsonString = (rawText: string) => {
    try {
      let parsed: any = null;

      // Try standard JSON parse
      try {
        parsed = JSON.parse(rawText.trim());
      } catch {
        // Extract JSON from markdown code blocks or brackets
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error(
            'Não foi possível identificar uma estrutura JSON válida no texto fornecido.'
          );
        }
      }

      if (parsed) {
        const updated: BookMetadata = {
          titulo: parsed.titulo || metadata.titulo,
          subtitulo: parsed.subtitulo || metadata.subtitulo,
          autor: parsed.autor || metadata.autor,
          idioma: parsed.idioma || metadata.idioma,
          publicoAlvo: parsed.publicoAlvo || metadata.publicoAlvo,
          resumo: parsed.resumo || metadata.resumo,
          estilo: parsed.estilo || metadata.estilo,
          promptEstilo: parsed.promptEstilo || metadata.promptEstilo,
          tom: parsed.tom || metadata.tom,
          qtdCapitulos: parsed.qtdCapitulos ? Number(parsed.qtdCapitulos) : metadata.qtdCapitulos,
          minPalavras: parsed.minPalavras ? Number(parsed.minPalavras) : metadata.minPalavras,
          maxPalavras: parsed.maxPalavras ? Number(parsed.maxPalavras) : metadata.maxPalavras,
          materiais: parsed.materiais || metadata.materiais,
          informacoesObrigatorias:
            parsed.informacoesObrigatorias || metadata.informacoesObrigatorias,
          restricoes: parsed.restricoes || metadata.restricoes,
          coverImageUrl: parsed.coverImageUrl || metadata.coverImageUrl,
        };

        onChangeMetadata(updated);
        setImportStatus(`Ficha do livro "${updated.titulo}" importada com sucesso!`);
        setTimeout(() => setImportStatus(null), 6000);
        return true;
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao processar JSON.');
    }
    return false;
  };

  // Download JSON Specification Template
  const handleDownloadTemplateJson = () => {
    const templateData = {
      _instrucoes:
        'Preencha os campos abaixo com as especificações do seu livro e salve como arquivo .json. Em seguida, importe este arquivo no Scriptor Editorial Studio.',
      titulo: metadata.titulo || 'Título do Seu Livro',
      subtitulo: metadata.subtitulo || 'Subtítulo explicativo e cativante',
      autor: metadata.autor || 'Nome do Autor ou Pseudônimo',
      idioma: metadata.idioma || 'Português (Brasil)',
      publicoAlvo: metadata.publicoAlvo || 'Público-alvo detalhado e perfil do leitor ideal',
      resumo: metadata.resumo || 'Resumo detalhado, premissa central e proposta de valor do livro',
      estilo: metadata.estilo || 'desenvolvimento_pessoal',
      promptEstilo:
        metadata.promptEstilo ||
        'Diretrizes específicas de estilo, metáforas e exercícios reflexivos',
      tom: metadata.tom || 'didatico_inspirador',
      qtdCapitulos: metadata.qtdCapitulos || 7,
      minPalavras: metadata.minPalavras || 1000,
      maxPalavras: metadata.maxPalavras || 2500,
      materiais: metadata.materiais || 'Notas de pesquisa, citações ou trechos de referência',
      informacoesObrigatorias:
        metadata.informacoesObrigatorias || 'Conceitos ou metodologias obrigatórias a incluir',
      restricoes: metadata.restricoes || 'Clichês a evitar, assuntos proibidos e limites do tom',
    };

    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'scriptor_template_livro.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get Clean Prompt Template String
  const getPromptTemplateContent = () => {
    return `Você é um Arquiteto Editorial Sênior, Diretor de Planejamento Literário e Editor-Chefe de alta performance.
Sua missão é transformar as ideias do autor fornecidas no final deste documento em uma FICHA TÉCNICA EDITORIAL COMPLETA, PROFUNDA E ESTRUTURADA em formato JSON para ser importada no software Scriptor Editorial Studio.

INSTRUÇÕES RIGOROSAS PARA A INTELIGÊNCIA ARTIFICIAL:
1. Retorne ESTRITAMENTE um único bloco de código em formato JSON válido.
2. NÃO inclua nenhum texto introdutório, saudações ou explicações fora da estrutura JSON.
3. NÃO utilize caracteres ou formatações de markdown como '#', '##', '###', '*', '**', ou '---' nos valores das strings.
4. Preencha cada um dos campos com profundidade editorial real, enriquecendo e estruturando as ideias brutas do autor com coerência técnica, psicologia de leitura e apelo mercadológico.

OPÇÕES VÁLIDAS DE ESTILO (campo 'estilo'):
- "desenvolvimento_pessoal" (Desenvolvimento Pessoal, Alta Performance & Hábitos)
- "nao_ficcao" (Não-Ficção Geral & Ensaios)
- "ficcao" (Ficção, Romance, Mistério & Narrativa Literária)
- "negocios_estrategia" (Negócios, Liderança & Estratégia Corporativa)
- "tecnico_educacional" (Técnico, Científico & Educacional)
- "biografia_memorias" (Biografia, Autobiografia & Memórias)
- "infantil_juvenil" (Infantil & Infanto-Juvenil)
- "filosofia_espiritualidade" (Filosofia, Espiritualidade & Sabedoria)
- "saude_bem_estar" (Saúde, Nutrição & Bem-Estar)
- "historia_sociedade" (História, Política & Sociedade)
- "financas_investimentos" (Finanças Pessoais & Investimentos)
- "psicologia_mente" (Psicologia, Neurociência & Comportamento)
- "misterio_thriller" (Mistério, Suspense & Policial)
- "fantasia_sci_fi" (Fantasia, Ficção Científica & Worldbuilding)
- "poesia_cronicas" (Poesia, Crônicas & Prosa Poética)

OPÇÕES VÁLIDAS DE TOM DE ESCRITA (campo 'tom'):
- "didatico_inspirador" (Didático & Inspirador - Encorajador e Claro)
- "analitico_rigoroso" (Analítico, Acadêmico & Rigoroso)
- "conversacional" (Conversacional, Próximo & Acolhedor)
- "poetico_sensivel" (Poético, Sensível & Evocativo)
- "dramatico" (Dramático, Intenso & Cinematográfico)
- "persuasivo_vendedor" (Persuasivo, Motivacional & Direto)
- "jornalistico" (Jornalístico, Investigativo & Objetivo)
- "provocativo_provocante" (Provocativo, Questionador & Desafiador)
- "humoristico_satirico" (Leve, Bem-Humorado & Irônico)
- "sombrio_misterioso" (Sombrio, Atmosférico & Enigmático)

OPÇÕES DE IDIOMA DA EUROPA E AMÉRICAS (campo 'idioma'):
"Português (Brasil)", "Português (Portugal)", "Inglês (Estados Unidos)", "Inglês (Reino Unido)", "Espanhol (América Latina)", "Espanhol (Espanha)", "Francês (França)", "Alemão (Alemanha)", "Italiano (Itália)", "Holandês", "Polonês", "Sueco", "Norueguês", "Dinamarquês", "Finlandês", "Russo", "Ucraniano", "Grego", "Romeno".

ESTRUTURA EXATA DO JSON DE SAÍDA REQUERIDO:

{
  "titulo": "Título impactante, memorável e comercial da obra",
  "subtitulo": "Subtítulo explicativo, elegante e focado na transformação entregue ao leitor",
  "autor": "Nome do autor ou pseudônimo literário",
  "idioma": "Português (Brasil)",
  "publicoAlvo": "Perfil psicológico e demográfico detalhado do leitor ideal, incluindo dores e motivações",
  "resumo": "Premissa central da obra, diagnóstico do problema abordado e proposta de valor clara",
  "estilo": "desenvolvimento_pessoal",
  "promptEstilo": "Diretrizes de escrita para o agente de redação: metáforas, ritmo de parágrafos, exercícios reflexivos ao fim de cada capítulo e tom de autoridade",
  "tom": "didatico_inspirador",
  "qtdCapitulos": 7,
  "minPalavras": 1000,
  "maxPalavras": 2500,
  "materiais": "Trechos de pesquisa, conceitos teóricos, modelos ou dados brutos fornecidos pelo autor",
  "informacoesObrigatorias": "Metodologias, conceitos essenciais ou estruturas que obrigatoriamente devem constar na obra",
  "restricoes": "Clichês a evitar, tom proibido, tópicos sensíveis ou limitações de linguagem"
}

IDEIAS E INFORMAÇÕES BRUTAS DO AUTOR SOBRE O LIVRO:
[DESCREVA AQUI O ASSUNTO DO LIVRO, TEMA CENTRAL, PÚBLICO-ALVO OU QUALQUER RASCUNHO QUE VOCÊ POSSUA]
`;
  };

  // Copy Prompt to Clipboard
  const handleCopyPromptTxt = async () => {
    try {
      const content = getPromptTemplateContent();
      await navigator.clipboard.writeText(content);
      setCopiedPrompt(true);
      setImportStatus('Prompt do agente copiado para a área de transferência com sucesso!');
      setTimeout(() => setCopiedPrompt(false), 3000);
      setTimeout(() => setImportStatus(null), 6000);
    } catch {
      alert(
        'Não foi possível copiar automaticamente. Selecione e copie manualmente se necessário.'
      );
    }
  };

  // Download Prompt Template TXT for external AI (Clean, Master-level, No Header Decorators)
  const handleDownloadPromptTxt = () => {
    const promptContent = getPromptTemplateContent();

    const blob = new Blob([promptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prompt_ficha_livro_ia_externa.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload/Import Completed Template File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        processAndImportJsonString(text);
      } catch (err: any) {
        alert(`Erro ao ler arquivo: ${err.message || 'Formato de arquivo inválido.'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Apply Direct Pasted JSON Text
  const handleApplyPastedJson = () => {
    setPasteError(null);
    if (!pastedJsonText.trim()) {
      setPasteError('Por favor, cole o texto do JSON gerado pela sua IA.');
      return;
    }

    try {
      processAndImportJsonString(pastedJsonText);
      setIsPasteModalOpen(false);
      setPastedJsonText('');
    } catch (err: any) {
      setPasteError(err.message || 'Erro ao processar o JSON colado.');
    }
  };

  const currentStylePrompt = getStylePrompt(metadata.estilo);
  const currentTonePrompt = getTonePrompt(metadata.tom);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-[#F5F5F4] border border-[#E7E5E4] p-6 sm:p-8 text-[#1C1917] relative">
        <div className="border-l-2 border-[#1C1917] pl-6 space-y-2 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#A8A29E] font-semibold italic">
            Etapa 1 • Diretrizes Editoriais & Ficha Técnica
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif italic tracking-tight font-bold text-[#1C1917]">
            Configuração do Projeto
          </h1>
          <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed font-serif">
            Defina os parâmetros centrais, público-alvo, extensão, tom e restrições para orientar a
            arquitetura editorial e a geração dos capítulos originais.
          </p>
        </div>

        {/* Preset Selector Chips */}
        <div className="mt-8 pt-6 border-t border-[#E7E5E4]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#78716C] font-semibold mb-3">
            Modelos Pré-Configurados (Presets)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PROJECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => loadPreset(preset.id)}
                className="text-left p-3.5 bg-white border border-[#E7E5E4] hover:border-[#1C1917] transition-all group"
              >
                <div className="font-serif text-sm italic font-semibold text-[#1C1917] group-hover:text-black">
                  {preset.name}
                </div>
                <div className="text-[11px] text-[#78716C] mt-1 line-clamp-2">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Downloadable Template & External AI Integration Banner */}
      <div className="bg-[#1C1917] text-white p-6 border border-[#292524] shadow-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <FileCode2 className="w-5 h-5 text-amber-500" />
              <h3 className="font-serif italic font-bold text-lg text-white">
                Ficha Técnica com IA Externa / Template Baixável
              </h3>
            </div>
            <p className="text-xs text-stone-300 font-serif leading-relaxed">
              Copie ou baixe o prompt explicativo, envie para sua IA favorita (ChatGPT, Claude,
              OpenCode GO, Gemini, DeepSeek) e envie ou cole a ficha completa preenchida
              diretamente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowTemplateGuide(!showTemplateGuide)}
            className="self-start md:self-auto px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs uppercase tracking-wider font-semibold transition flex items-center space-x-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Como Funciona?</span>
          </button>
        </div>

        {/* Action Buttons: Download Templates, Upload Specs, Copy Prompt & Direct Paste */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyPromptTxt}
            className="p-3 bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 shadow-sm group"
            title="Copiar prompt para a área de transferência"
          >
            {copiedPrompt ? (
              <Check className="w-4 h-4 text-stone-950" />
            ) : (
              <Copy className="w-4 h-4 text-stone-950 group-hover:scale-110 transition" />
            )}
            <span>{copiedPrompt ? 'Copiado!' : '1. Copiar Prompt'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPromptTxt}
            className="p-3 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-semibold uppercase tracking-wider transition flex items-center justify-center space-x-2 group"
            title="Baixar prompt em formato de arquivo .txt"
          >
            <FileText className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            <span>2. Baixar Prompt (.txt)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplateJson}
            className="p-3 bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-xs font-semibold uppercase tracking-wider transition flex items-center justify-center space-x-2 group"
          >
            <Download className="w-4 h-4 text-amber-500 group-hover:scale-110 transition" />
            <span>3. Baixar JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPasteModalOpen(true)}
            className="p-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 shadow-sm"
          >
            <Clipboard className="w-4 h-4 text-stone-950" />
            <span>4. Colar Texto IA</span>
          </button>

          <label className="p-3 bg-stone-200 hover:bg-white text-stone-900 font-bold text-xs uppercase tracking-wider cursor-pointer transition flex items-center justify-center space-x-2 shadow-sm">
            <Upload className="w-4 h-4 text-stone-900" />
            <span>5. Upar Arquivo</span>
            <input type="file" accept=".json,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Import Status Alert */}
        {importStatus && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-center space-x-2 font-medium animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{importStatus}</span>
          </div>
        )}

        {/* Step by Step Guide Collapse */}
        {showTemplateGuide && (
          <div className="bg-stone-900 border border-stone-800 p-4 text-xs text-stone-300 space-y-3 animate-fade-in font-serif">
            <h4 className="font-bold text-white uppercase tracking-wider font-sans text-[11px] text-amber-400">
              Guia de Integração com IA Externa:
            </h4>
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li className="space-x-1">
                <strong>Copie ou Baixe o Prompt</strong> com as instruções detalhadas.
              </li>
              <li>
                Abra a sua IA externa de preferência (ChatGPT, Claude, OpenCode GO, Gemini,
                DeepSeek, Llama).
              </li>
              <li>Cole o prompt fornecido junto com as suas anotações ou ideias do livro.</li>
              <li>Copie a resposta em formato JSON gerada pela IA.</li>
              <li>
                Clique no botão <strong>"4. Colar Texto IA"</strong> (ou "5. Upar Arquivo") para que
                todos os campos sejam preenchidos instantaneamente!
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Main Configuration Form */}
      <div className="bg-white border border-[#E7E5E4] p-6 sm:p-8 space-y-8 text-[#1C1917]">
        {/* Section 1: Informações Básicas do Livro */}
        <div className="border-l-2 border-[#D6D3D1] pl-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#44403C] flex items-center space-x-2 pb-2">
            <BookOpen className="w-4 h-4 text-[#78716C]" />
            <span>1. Informações Principais & Autoria</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Título do Livro <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={metadata.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Ex: A Jornada do Silêncio"
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] font-serif focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Subtítulo do Livro
              </label>
              <input
                type="text"
                value={metadata.subtitulo}
                onChange={(e) => handleChange('subtitulo', e.target.value)}
                placeholder="Ex: Explorando a Quietude em um Mundo Hiperconectado"
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] font-serif focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Nome do Autor(a) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={metadata.autor}
                onChange={(e) => handleChange('autor', e.target.value)}
                placeholder="Ex: Lúcia Mendes"
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] font-serif focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Editora / Selo Editorial
              </label>
              <input
                type="text"
                value={metadata.editora || ''}
                onChange={(e) => handleChange('editora', e.target.value)}
                placeholder="Ex: OMNIA, Sextante, Companhia das Letras..."
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] font-serif focus:outline-none transition"
              />
            </div>

            {/* 20 Languages Selector (Americas and Europe) */}
            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5 flex items-center justify-between">
                <span>Idioma da Obra (Américas & Europa)</span>
                <Globe className="w-3.5 h-3.5 text-[#78716C]" />
              </label>
              <select
                value={metadata.idioma}
                onChange={(e) => handleChange('idioma', e.target.value)}
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none transition font-medium"
              >
                {EUROPE_AMERICAS_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.name}>
                    {lang.name} [{lang.region}]
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Resumo e Público-Alvo */}
        <div className="border-l-2 border-[#D6D3D1] pl-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#44403C] flex items-center space-x-2 pb-2">
            <Settings className="w-4 h-4 text-[#78716C]" />
            <span>2. Propósito, Resumo & Leitor Ideal</span>
          </h2>

          <div className="space-y-6 mt-4">
            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Público-alvo Almejado
              </label>
              <input
                type="text"
                value={metadata.publicoAlvo}
                onChange={(e) => handleChange('publicoAlvo', e.target.value)}
                placeholder="Ex: Profissionais urbanos, 25-45 anos, buscando equilíbrio mental e ferramentas de introspecção técnica..."
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Resumo e Objetivo Geral do Livro <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={4}
                value={metadata.resumo}
                onChange={(e) => handleChange('resumo', e.target.value)}
                placeholder="Descreva a premissa central do livro, o problema que ele resolve e a grande transformação que entregará ao leitor..."
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] p-4 text-sm text-[#1C1917] font-serif focus:outline-none transition leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Estilo, Tom e Parâmetros de Extensão */}
        <div className="border-l-2 border-[#D6D3D1] pl-6 space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#44403C] flex items-center space-x-2 pb-2">
            <Layers className="w-4 h-4 text-[#78716C]" />
            <span>3. Estilo Literário, Tom & Agentes de Escrita</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 15 Styles Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#57534E]">
                Estilo do Livro (Gênero Editorial)
              </label>
              <select
                value={metadata.estilo}
                onChange={(e) => handleChange('estilo', e.target.value as BookStyle)}
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none transition font-medium"
              >
                {BOOK_STYLES_OPTIONS.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.label}
                  </option>
                ))}
              </select>

              {/* Dynamic Style Agent Prompt Card */}
              <div className="p-3 bg-[#FDFCFB] border border-[#E7E5E4] text-[11px] text-[#57534E] font-serif leading-relaxed">
                <div className="font-sans font-bold text-[10px] uppercase text-[#1C1917] mb-1 flex items-center space-x-1">
                  <Cpu className="w-3 h-3 text-amber-600" />
                  <span>Diretriz do Agente de Escrita:</span>
                </div>
                {currentStylePrompt}
              </div>
            </div>

            {/* 10 Tones Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#57534E]">Tom da Escrita</label>
              <select
                value={metadata.tom}
                onChange={(e) => handleChange('tom', e.target.value as WritingTone)}
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none transition font-medium"
              >
                {WRITING_TONES_OPTIONS.map((tone) => (
                  <option key={tone.id} value={tone.id}>
                    {tone.label}
                  </option>
                ))}
              </select>

              {/* Dynamic Tone Agent Prompt Card */}
              <div className="p-3 bg-[#FDFCFB] border border-[#E7E5E4] text-[11px] text-[#57534E] font-serif leading-relaxed">
                <div className="font-sans font-bold text-[10px] uppercase text-[#1C1917] mb-1 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>Instrução de Tom do Agente:</span>
                </div>
                {currentTonePrompt}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Instruções Específicas Personalizadas do Estilo (Opcional)
              </label>
              <input
                type="text"
                value={metadata.promptEstilo}
                onChange={(e) => handleChange('promptEstilo', e.target.value)}
                placeholder="Ex: Use metáforas marcantes, inclua exercícios reflexivos ao final e citações marcantes."
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Quantidade de Capítulos ({metadata.qtdCapitulos})
              </label>
              <input
                type="range"
                min={3}
                max={25}
                value={metadata.qtdCapitulos}
                onChange={(e) => handleChange('qtdCapitulos', parseInt(e.target.value, 10))}
                className="w-full accent-[#1C1917] cursor-pointer"
              />
              <div className="flex justify-between text-xs text-[#78716C] mt-1 font-mono">
                <span>3 Capítulos</span>
                <span className="font-semibold text-[#1C1917] font-serif italic">
                  {metadata.qtdCapitulos} Capítulos
                </span>
                <span>25 Capítulos</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Faixa de Palavras por Capítulo
              </label>
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <span className="text-[11px] text-[#78716C]">Mínimo:</span>
                  <input
                    type="number"
                    min={500}
                    max={5000}
                    step={100}
                    value={metadata.minPalavras}
                    onChange={(e) => handleChange('minPalavras', parseInt(e.target.value, 10))}
                    className="w-full bg-[#FDFCFB] border border-[#D6D3D1] px-3 py-1.5 text-xs text-[#1C1917] focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-[#78716C]">Máximo:</span>
                  <input
                    type="number"
                    min={500}
                    max={8000}
                    step={100}
                    value={metadata.maxPalavras}
                    onChange={(e) => handleChange('maxPalavras', parseInt(e.target.value, 10))}
                    className="w-full bg-[#FDFCFB] border border-[#D6D3D1] px-3 py-1.5 text-xs text-[#1C1917] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Materiais, Informações Obrigatórias e Restrições */}
        <div className="border-l-2 border-[#D6D3D1] pl-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#44403C] flex items-center space-x-2 pb-2">
            <ShieldAlert className="w-4 h-4 text-[#78716C]" />
            <span>4. Anotações, Materiais & Restrições</span>
          </h2>

          <div className="space-y-6 mt-4">
            <div>
              <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                Materiais e Trechos Fornecidos
              </label>
              <textarea
                rows={2}
                value={metadata.materiais}
                onChange={(e) => handleChange('materiais', e.target.value)}
                placeholder="Cole notas de pesquisa, citações ou trechos de referência que devam ser incorporados naturalmente..."
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] p-3 text-xs text-[#1C1917] focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                  Informações Obrigatórias a Incluir
                </label>
                <textarea
                  rows={2}
                  value={metadata.informacoesObrigatorias}
                  onChange={(e) => handleChange('informacoesObrigatorias', e.target.value)}
                  placeholder="Conceitos específicos, tabelas, dados obrigatórios ou metodologias do autor..."
                  className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] p-3 text-xs text-[#1C1917] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#57534E] mb-1.5">
                  Restrições e Proibições
                </label>
                <textarea
                  rows={2}
                  value={metadata.restricoes}
                  onChange={(e) => handleChange('restricoes', e.target.value)}
                  placeholder="Termos proibidos, clichês a evitar, assuntos que não devem ser abordados..."
                  className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] p-3 text-xs text-[#1C1917] focus:outline-none transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-6 border-t border-[#E7E5E4] flex justify-end">
          <button
            type="button"
            onClick={onProceedToPlanning}
            disabled={!metadata.titulo || !metadata.resumo || isGeneratingPlan}
            className="flex items-center space-x-3 px-8 py-4 bg-[#1C1917] hover:bg-[#44403C] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-widest transition shadow-xs"
          >
            {isGeneratingPlan ? (
              <>
                <Wand2 className="w-4 h-4 animate-spin" />
                <span>Gerando Planejamento Editorial...</span>
              </>
            ) : (
              <>
                <span>Gerar Planejamento & Sumário (Etapa 2)</span>
                <span className="text-base">→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal for Direct Pasting AI JSON Text */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E7E5E4] w-full max-w-2xl p-6 shadow-2xl space-y-4 text-[#1C1917]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
              <div className="flex items-center space-x-2">
                <Clipboard className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-serif italic font-bold text-base">
                    Colar Ficha Técnica da IA Externa
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-[#78716C]">
                    Cole abaixo o resultado retornado pelo ChatGPT, Claude, Gemini, OpenCode ou
                    DeepSeek
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsPasteModalOpen(false);
                  setPasteError(null);
                }}
                className="p-1 hover:bg-[#F5F5F4] text-[#78716C] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#57534E]">
                Texto JSON da IA Externa:
              </label>
              <textarea
                rows={10}
                value={pastedJsonText}
                onChange={(e) => setPastedJsonText(e.target.value)}
                placeholder={`Cole o texto aqui, por exemplo:
{
  "titulo": "O Código da Mente",
  "subtitulo": "Domine o Foco e a Alta Performance",
  "autor": "Dr. Lucas Vane",
  "idioma": "Português (Brasil)",
  "resumo": "...",
  "estilo": "desenvolvimento_pessoal",
  "tom": "didatico_inspirador"
}`}
                className="w-full bg-[#FDFCFB] border border-[#D6D3D1] focus:border-[#1C1917] p-3 text-xs font-mono text-[#1C1917] focus:outline-none transition"
              />
            </div>

            {pasteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {pasteError}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#E7E5E4]">
              <button
                onClick={() => {
                  setIsPasteModalOpen(false);
                  setPasteError(null);
                }}
                className="px-4 py-2 bg-[#F5F5F4] hover:bg-[#E7E5E4] text-[#44403C] text-xs font-medium uppercase tracking-wider"
              >
                Cancelar
              </button>

              <button
                onClick={handleApplyPastedJson}
                className="px-6 py-2.5 bg-[#1C1917] hover:bg-[#44403C] text-white text-xs font-bold uppercase tracking-widest transition flex items-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Analisar e Importar Ficha</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
