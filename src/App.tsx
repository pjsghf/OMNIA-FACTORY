import { useState, useEffect, useRef } from 'react';
import {
  BookProject,
  EditorialPlan,
  BookMetadata,
  ChapterContent,
  EditorialStage,
  AiConfig,
} from './types';
import { Header } from './components/Header';
import { ConfigStage } from './components/ConfigStage';
import { DesignExportStage } from './components/DesignExportStage';
import { BookReaderModal } from './components/BookReaderModal';
import { ProjectListModal } from './components/ProjectListModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { TranslationModal } from './components/TranslationModal';
import { LogConsoleModal } from './components/LogConsoleModal';
import { AutonomousPipelineRunner, TelemetryState } from './lib/pipeline/autonomousPipeline';
import { AutonomousPipelineModal } from './components/AutonomousPipelineModal';
import { Sidebar } from './components/Sidebar';
import { SidebarDrawer } from './components/SidebarDrawer';
import { StudioStage } from './components/StudioStage';
import {
  saveProjectDB,
  getAllProjectsDB,
  deleteProjectDB,
  migrateLocalStorageToIndexedDB,
} from './lib/storage/indexedDBStorage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { createChapterVersion } from './lib/ai/review/versionManager';
import { OPENCODE_DEFAULT_BASE_URL, OPENCODE_DEFAULT_MODEL } from './lib/ai/catalog';

const DEFAULT_METADATA: BookMetadata = {
  titulo: 'O Código da Mente Inabalável',
  subtitulo:
    'Estratégias Práticas para Dominar o Foco, Vencer a Procrastinação e Construir uma Vida de Resultados',
  autor: 'Dr. Lucas Vane',
  editora: 'OMNIA',
  idioma: 'Português',
  publicoAlvo:
    'Profissionais, estudantes e empreendedores que buscam alta performance e clareza mental',
  resumo:
    'Um livro transformador focado na reestruturação de modelos mentais, eliminação de crenças limitantes e implementação de rotinas de alta disciplina e controle emocional.',
  estilo: 'desenvolvimento_pessoal',
  promptEstilo:
    'Enfatize estudos de caso práticos, metáforas marcantes, exercícios reflexivos ao final de cada capítulo e uma linguagem diretamente voltada à ação.',
  tom: 'didatico_inspirador',
  qtdCapitulos: 7,
  minPalavras: 1000,
  maxPalavras: 2500,
  materiais:
    'Notas sobre ancoragem mental, técnicas de respiração e a matriz de decisão sob pressão.',
  informacoesObrigatorias:
    'Incluir rotina matinal dos 4 pilares e tabela de rastreamento de hábitos.',
  restricoes: 'Evitar bordões genéricos de autoajuda. Manter rigor na psicologia comportamental.',
};

const DEFAULT_AI_CONFIG: AiConfig = {
  provider: 'opencode',
  geminiModel: 'gemini-2.5-flash',
  // Left blank on purpose: the server reads OPENCODE_API_KEY from its own .env, so
  // the credential never has to touch localStorage or ride along on requests.
  opencodeApiKey: '',
  opencodeBaseUrl: OPENCODE_DEFAULT_BASE_URL,
  opencodeModel: OPENCODE_DEFAULT_MODEL,
};

/**
 * A saved aiConfig overrides the defaults above, so switching the shipped provider
 * would otherwise leave every existing browser pinned to the old one. This moves
 * only configs still sitting on a superseded default; anything the user chose
 * deliberately is left alone.
 */
const SUPERSEDED_OPENCODE_MODELS = ['opencode/claude-3-5-sonnet'];

export function migrateAiConfig(saved: Partial<AiConfig> | null | undefined): AiConfig {
  const config: AiConfig = { ...DEFAULT_AI_CONFIG, ...(saved || {}) };

  if (!config.opencodeModel || SUPERSEDED_OPENCODE_MODELS.includes(config.opencodeModel)) {
    config.opencodeModel = OPENCODE_DEFAULT_MODEL;
  }

  // The old default pointed at a domain that does not resolve.
  if (!config.opencodeBaseUrl || config.opencodeBaseUrl.includes('opencode.go')) {
    config.opencodeBaseUrl = OPENCODE_DEFAULT_BASE_URL;
  }

  return config;
}

const DEFAULT_PROJECT: BookProject = {
  id: 'proj_default',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: DEFAULT_METADATA,
  plan: null,
  chapters: [],
  frontMatter: {},
  endMatter: {},
  editorialReport: null,
  currentStage: 'config',
};

export default function App() {
  // Saved Projects
  const [projects, setProjectsState] = useState<BookProject[]>(() => {
    const saved = localStorage.getItem('scriptor_projects_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing projects from localStorage', e);
      }
    }
    const initialProject: BookProject = {
      id: 'proj_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: DEFAULT_METADATA,
      plan: null,
      chapters: [],
      frontMatter: {},
      endMatter: {},
      editorialReport: null,
      currentStage: 'config',
    };
    return [initialProject];
  });

  const [currentProjectId, setCurrentProjectIdState] = useState<string>(projects[0]?.id || '');

  // Long-running batch handlers (chapter generation, review application) await between
  // iterations, so the `projects` / `currentProjectId` values captured by their closure
  // go stale the moment the first update lands. These refs mirror the state so those
  // handlers can always read the freshest project instead of the render-time snapshot.
  const projectsRef = useRef<BookProject[]>(projects);
  const currentProjectIdRef = useRef<string>(currentProjectId);

  const setProjects = (action: BookProject[] | ((prev: BookProject[]) => BookProject[])) => {
    setProjectsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      projectsRef.current = next;
      return next;
    });
  };

  const setCurrentProjectId = (id: string) => {
    currentProjectIdRef.current = id;
    setCurrentProjectIdState(id);
  };

  // Reads the active project from the refs, so it stays correct across awaits.
  const getLiveProject = (): BookProject =>
    projectsRef.current.find((p) => p.id === currentProjectIdRef.current) ||
    projectsRef.current[0] ||
    DEFAULT_PROJECT;

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => {
    const saved = localStorage.getItem('scriptor_aiconfig_v1');
    if (saved) {
      try {
        return migrateAiConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing aiConfig from localStorage', e);
      }
    }
    return DEFAULT_AI_CONFIG;
  });

  // Sidebar Drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Initial load from IndexedDB + migration
  useEffect(() => {
    async function initIndexedDB() {
      await migrateLocalStorageToIndexedDB();
      const loaded = await getAllProjectsDB();
      if (loaded && loaded.length > 0) {
        setProjectsState(loaded);
        projectsRef.current = loaded;
        if (
          !currentProjectIdRef.current ||
          !loaded.some((p) => p.id === currentProjectIdRef.current)
        ) {
          setCurrentProjectIdState(loaded[0]!.id);
          currentProjectIdRef.current = loaded[0]!.id;
        }
      }
    }
    initIndexedDB();
  }, []);

  // Save projects to IndexedDB in background
  useEffect(() => {
    const live = getLiveProject();
    if (live) {
      saveProjectDB(live);
    }
  }, [projects, currentProjectId]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type,
      title,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Loading States
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [isGeneratingFrontEndBatch, setIsGeneratingFrontEndBatch] = useState<boolean>(false);
  const [isApplyingReview, setIsApplyingReview] = useState<boolean>(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [isReviewing, setIsReviewing] = useState<boolean>(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState<boolean>(false);

  // Modals
  const [isReaderOpen, setIsReaderOpen] = useState<boolean>(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState<boolean>(false);
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState<boolean>(false);
  const [isLogConsoleOpen, setIsLogConsoleOpen] = useState<boolean>(false);
  const [pipelineRunner, setPipelineRunner] = useState<AutonomousPipelineRunner | null>(null);
  const [pipelineTelemetry, setPipelineTelemetry] = useState<TelemetryState | null>(null);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState<boolean>(false);

  const handleStartAutonomousPipeline = async () => {
    setIsPipelineModalOpen(true);
    const runner = new AutonomousPipelineRunner({
      project: getLiveProject(),
      aiConfig,
      targetScore: 8.5,
      maxReviewIterations: 3,
      onTelemetry: (telemetry) => {
        setPipelineTelemetry(telemetry);
      },
      onProjectUpdate: (updater) => {
        updateActiveProject(updater);
      },
      addToast,
    });

    setPipelineRunner(runner);
    const success = await runner.run();
    if (success) {
      setStage('design_export');
      addToast(
        'success',
        'Piloto Automático Finalizado!',
        'Sua obra foi planejada, escrita, auditada e está pronta para exportação.'
      );
    }
  };
  const [aiAssistState, setAiAssistState] = useState<{
    text: string;
    action: string;
    chapterIndex?: number;
  } | null>(null);

  const handleTranslationComplete = (
    translatedProject: BookProject,
    saveMode: 'new_project' | 'replace_current'
  ) => {
    if (saveMode === 'new_project') {
      setProjects((prev) => [translatedProject, ...prev]);
      setCurrentProjectId(translatedProject.id);
      addToast(
        'success',
        'Edição Localizada Criada!',
        `Nova versão em ${translatedProject.metadata.idioma} com capa gerada adicionada à biblioteca.`
      );
    } else {
      const targetId = getLiveProject().id;
      setProjects((prev) => prev.map((p) => (p.id === targetId ? translatedProject : p)));
      addToast(
        'success',
        'E-book Atualizado!',
        `O e-book ativo foi substituído pela versão em ${translatedProject.metadata.idioma}.`
      );
    }
  };

  // Auto-save projects to localStorage.
  //
  // Debounced because WritingStage calls onUpdateChapter on every keystroke: this
  // effect used to re-serialize every project (full manuscript plus base64 covers,
  // easily megabytes) once per character typed.
  //
  // Guarded because a book with cover art approaches the ~5MB origin quota, and an
  // unhandled QuotaExceededError here propagates out of the effect and takes down
  // the whole app -- losing the very work it was trying to save.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('scriptor_projects_v2', JSON.stringify(projects));
        setStorageWarning(null);
      } catch (err) {
        console.error('Falha ao salvar projetos no localStorage', err);
        const isQuota =
          err instanceof DOMException &&
          (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
        setStorageWarning(
          isQuota
            ? 'Armazenamento local cheio: suas últimas alterações NÃO foram salvas. Exporte um backup e remova projetos antigos da biblioteca.'
            : 'Não foi possível salvar automaticamente no navegador. Exporte um backup para não perder o trabalho.'
        );
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [projects]);

  // Flush pending work on unload, since the debounce may still be in flight.
  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem('scriptor_projects_v2', JSON.stringify(projectsRef.current));
      } catch {
        // Nothing useful to do while the page is going away.
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  // Auto-save aiConfig
  useEffect(() => {
    try {
      localStorage.setItem('scriptor_aiconfig_v1', JSON.stringify(aiConfig));
    } catch (err) {
      console.error('Falha ao salvar configuração de IA no localStorage', err);
    }
  }, [aiConfig]);

  const activeProject =
    projects.find((p) => p.id === currentProjectId) || projects[0] || DEFAULT_PROJECT;

  const updateActiveProject = (updater: (prev: BookProject) => BookProject) => {
    const targetId = getLiveProject().id;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === targetId) {
          const updated = updater(p);
          // Flag report as obsolete if chapter content was edited
          if (updated.chapters !== p.chapters && updated.editorialReport) {
            updated.editorialReport = {
              ...updated.editorialReport,
              obsoleto: true,
            };
          }
          return { ...updated, updatedAt: new Date().toISOString() };
        }
        return p;
      })
    );
  };

  const setStage = (stage: EditorialStage) => {
    updateActiveProject((p) => ({ ...p, currentStage: stage }));
  };

  // 1. Generate Editorial Plan & Outline
  const handleGeneratePlan = async () => {
    const meta = getLiveProject().metadata;
    if (!meta.titulo?.trim() || !meta.autor?.trim() || !meta.resumo?.trim()) {
      const missing = [];
      if (!meta.titulo?.trim()) missing.push('Título');
      if (!meta.autor?.trim()) missing.push('Autor');
      if (!meta.resumo?.trim()) missing.push('Resumo');
      addToast(
        'error',
        'Dados Incompletos',
        `Preencha os campos obrigatórios antes de gerar: ${missing.join(', ')}.`
      );
      return;
    }

    setIsGeneratingPlan(true);
    try {
      const res = await fetch('/api/editorial/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...meta,
          aiConfig,
        }),
      });
      const data = await res.json();
      if (data.success && data.plan) {
        const plan: EditorialPlan = data.plan;

        const chapters: ChapterContent[] = (plan.sumario || []).map((c) => ({
          numero: c.numero,
          titulo: c.titulo,
          subtitulo: c.subtitulo,
          content: '',
          wordCount: 0,
          status: 'pending',
        }));

        updateActiveProject((p) => ({
          ...p,
          plan,
          chapters,
          currentStage: 'planning',
        }));
        addToast(
          'success',
          'Planejamento Editorial Gerado',
          'O plano de capítulos e diretrizes foi montado com sucesso.'
        );
      } else {
        const detailMsg = data.details
          ? Object.values(data.details).join(' ')
          : data.error || 'Erro ao gerar planejamento editorial.';
        addToast('error', 'Falha no Planejamento', detailMsg);
      }
    } catch (err: any) {
      console.error(err);
      addToast(
        'error',
        'Erro de Conexão',
        err?.message || 'Erro na comunicação com o provedor de IA.'
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // 2. Generate Single Chapter
  const handleGenerateChapter = async (index: number): Promise<boolean> => {
    // Read from the refs: in batch mode this runs once per chapter across awaits,
    // and every iteration needs the memory/chapters produced by the previous one.
    const liveProject = getLiveProject();
    if (!liveProject.plan) return false;
    setGeneratingIndex(index);

    try {
      const previousSummaries = liveProject.chapters
        .slice(0, index)
        .filter((c: ChapterContent) => Boolean(c.content))
        .map(
          (c: ChapterContent) => `Capítulo ${c.numero} (${c.titulo}): ${c.content.slice(0, 300)}...`
        );

      const res = await fetch('/api/editorial/generate-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: liveProject.metadata,
          plan: liveProject.plan,
          chapterIndex: index,
          memory: liveProject.bookBibleMemory,
          previousSummaries,
          aiConfig,
        }),
      });

      const data = await res.json();
      if (data.success) {
        updateActiveProject((p) => {
          const chapters = [...p.chapters];
          const newContent = data.content;
          const targetCap = chapters[index];
          if (!targetCap) return p;

          const updatedCap: ChapterContent = {
            ...targetCap,
            content: newContent,
            wordCount: data.wordCount,
            status: 'completed',
          };
          chapters[index] = updatedCap;

          // Save Version Item
          const currentVersions = p.chapterVersions || {};
          const capVersions = currentVersions[updatedCap.numero] || [];

          const versionItem = createChapterVersion({
            chapterNumber: updatedCap.numero,
            content: newContent,
            existingVersions: capVersions,
            author: 'ia',
            label: 'Draft Inicial Gerado por IA',
          });

          return {
            ...p,
            chapters,
            bookBibleMemory: data.updatedMemory || p.bookBibleMemory,
            chapterVersions: {
              ...currentVersions,
              [updatedCap.numero]: [versionItem, ...capVersions],
            },
          };
        });
        addToast(
          'success',
          `Capítulo ${index + 1} Redigido`,
          `${data.wordCount} palavras geradas.`
        );
        return true;
      } else {
        addToast(
          'error',
          `Erro no Capítulo ${index + 1}`,
          data.error || 'Erro ao escrever capítulo.'
        );
        return false;
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', `Erro de Conexão (Cap. ${index + 1})`, err?.message || 'Falha na conexão.');
      return false;
    } finally {
      setGeneratingIndex(null);
    }
  };

  // 3. Batch Generate All Chapters sequentially
  const handleGenerateBatchChapters = async () => {
    if (!getLiveProject().plan) return;
    setIsGeneratingBatch(true);

    const totalCaps = getLiveProject().plan!.sumario.length;
    let failedIndex: number | null = null;

    for (let i = 0; i < totalCaps; i++) {
      const chaptersNow = getLiveProject().chapters;
      if (chaptersNow[i]?.status === 'completed' && chaptersNow[i]?.content?.trim()) {
        continue;
      }

      setGeneratingIndex(i);

      // Auto-retry up to 2 attempts per chapter for network/timeout resilience
      let success = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (attempt > 1) {
          addToast(
            'info',
            `Revisando Capítulo ${i + 1}`,
            `Reagendando tentativa ${attempt} de 2 após timeout do servidor...`
          );
          await new Promise((res) => setTimeout(res, 3500));
        }
        success = await handleGenerateChapter(i);
        if (success) break;
      }

      if (!success) {
        failedIndex = i;
        break;
      }

      if (i < totalCaps - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setIsGeneratingBatch(false);
    setGeneratingIndex(null);

    if (failedIndex !== null) {
      addToast(
        'info',
        'Redação em Lote Pausada',
        `A geração parou no Capítulo ${failedIndex + 1}. Todos os capítulos anteriores foram salvos. Clique em "Continuar Redação em Lote" para continuar.`
      );
    } else {
      addToast(
        'success',
        'Redação em Lote Concluída!',
        'Todos os capítulos foram redigidos e salvos na biblioteca.'
      );
    }
  };

  // 4. Generate Front/End Matter Section
  const handleGenerateFrontOrEndMatter = async (
    type:
      'apresentacao' | 'introducao' | 'conclusao' | 'agradecimentos' | 'sobreAutor' | 'exercicios'
  ): Promise<boolean> => {
    try {
      const liveProject = getLiveProject();

      // The conclusion / exercises / author sections are written *about* the book, so
      // the backend prompt needs the actual prose. It was never being sent, leaving
      // buildMatterPrompt with its "Livro fundamentado na obra do autor." placeholder.
      const fullBookContent = liveProject.chapters
        .filter((c: ChapterContent) => Boolean(c.content?.trim()))
        .map((c: ChapterContent) => `Capítulo ${c.numero} — ${c.titulo}\n${c.content}`)
        .join('\n\n');

      const res = await fetch('/api/editorial/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: liveProject.metadata,
          plan: liveProject.plan,
          sectionType: type,
          fullBookContent,
          aiConfig,
        }),
      });

      const data = await res.json();
      if (data.success) {
        updateActiveProject((p) => {
          if (type === 'apresentacao' || type === 'introducao') {
            return {
              ...p,
              frontMatter: { ...p.frontMatter, [type]: data.content },
            };
          } else {
            return {
              ...p,
              endMatter: { ...p.endMatter, [type]: data.content },
            };
          }
        });
        addToast('success', 'Seção Gerada', `Seção ${type} adicionada ao livro.`);
        return true;
      } else {
        addToast(
          'error',
          'Falha ao Gerar Seção',
          data.error || 'Erro ao gerar seção complementar.'
        );
        return false;
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Erro de Conexão', err?.message || 'Falha na conexão.');
      return false;
    }
  };

  const handleGenerateBatchFrontAndEndMatter = async () => {
    setIsGeneratingFrontEndBatch(true);
    const sections: Array<
      'apresentacao' | 'introducao' | 'conclusao' | 'exercicios' | 'agradecimentos' | 'sobreAutor'
    > = ['apresentacao', 'introducao', 'conclusao', 'exercicios', 'agradecimentos', 'sobreAutor'];

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      if (!sec) continue;
      const success = await handleGenerateFrontOrEndMatter(sec);
      if (!success) break;
      if (i < sections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    setIsGeneratingFrontEndBatch(false);
  };

  const handleUpdateFrontOrEndMatter = (
    type:
      'apresentacao' | 'introducao' | 'conclusao' | 'agradecimentos' | 'sobreAutor' | 'exercicios',
    content: string
  ) => {
    updateActiveProject((p) => {
      if (type === 'apresentacao' || type === 'introducao') {
        return {
          ...p,
          frontMatter: { ...p.frontMatter, [type]: content },
        };
      } else {
        return {
          ...p,
          endMatter: { ...p.endMatter, [type]: content },
        };
      }
    });
  };

  // 5. Run Editorial Audit & Review
  const handleRunEditorialReview = async () => {
    setIsReviewing(true);

    try {
      const res = await fetch('/api/editorial/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: getLiveProject(),
          aiConfig,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        updateActiveProject((p) => ({ ...p, editorialReport: data.report }));
        addToast(
          'success',
          'Auditoria Concluída',
          `Nota Geral de Qualidade: ${data.report.notaGeral}/100.`
        );
      } else {
        addToast('error', 'Erro na Auditoria', data.error || 'Erro na auditoria editorial.');
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Erro ao Auditar', 'Erro na conexão ao realizar auditoria.');
    } finally {
      setIsReviewing(false);
    }
  };

  // 5B. Apply Editorial Review Improvements to Chapters + Automatic Re-Audit
  const handleApplyReviewImprovements = async (chapterIndex?: number) => {
    if (!getLiveProject().editorialReport) {
      addToast('error', 'Sem Relatório', 'Execute a auditoria editorial primeiro.');
      return;
    }

    setIsApplyingReview(true);
    let appliedSuccess = false;

    try {
      if (typeof chapterIndex === 'number') {
        const liveProject = getLiveProject();
        const targetCap = liveProject.chapters[chapterIndex];
        if (!targetCap || !targetCap.content?.trim()) {
          addToast('error', 'Capítulo Vazio', `Capítulo ${chapterIndex + 1} não possui texto.`);
          return;
        }

        setGeneratingIndex(chapterIndex);

        const res = await fetch('/api/editorial/apply-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: liveProject.metadata,
            plan: liveProject.plan,
            chapterIndex,
            chapterTitle: targetCap.titulo,
            chapterContent: targetCap.content,
            report: liveProject.editorialReport,
            aiConfig,
          }),
        });

        const data = await res.json();
        if (data.success) {
          appliedSuccess = true;
          updateActiveProject((p) => {
            const chapters = [...p.chapters];
            const newContent = data.content;
            const targetCap = chapters[chapterIndex];
            if (!targetCap) return p;

            const updatedCap: ChapterContent = {
              ...targetCap,
              content: newContent,
              wordCount: data.wordCount,
              status: 'edited',
            };
            chapters[chapterIndex] = updatedCap;

            const currentVersions = p.chapterVersions || {};
            const capVersions = currentVersions[updatedCap.numero] || [];

            const versionItem = createChapterVersion({
              chapterNumber: updatedCap.numero,
              content: newContent,
              existingVersions: capVersions,
              author: 'review_patch',
              label: 'Revisão Editorial Aplicada (IA)',
            });

            return {
              ...p,
              chapters,
              chapterVersions: {
                ...currentVersions,
                [updatedCap.numero]: [versionItem, ...capVersions],
              },
            };
          });
          addToast(
            'success',
            'Melhorias Aplicadas',
            `Capítulo ${chapterIndex + 1} aprimorado com sucesso.`
          );
        } else {
          addToast('error', 'Falha ao Aprimorar', data.error || 'Erro desconhecido');
        }
      } else {
        const total = getLiveProject().chapters.length;
        let appliedCount = 0;

        for (let i = 0; i < total; i++) {
          const liveProject = getLiveProject();
          const cap = liveProject.chapters[i];
          if (!cap || !cap.content?.trim()) continue;

          setGeneratingIndex(i);

          try {
            const res = await fetch('/api/editorial/apply-review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                metadata: liveProject.metadata,
                plan: liveProject.plan,
                chapterIndex: i,
                chapterTitle: cap.titulo,
                chapterContent: cap.content,
                report: liveProject.editorialReport,
                aiConfig,
              }),
            });

            const data = await res.json();
            if (data.success) {
              appliedCount++;
              updateActiveProject((p) => {
                const chapters = [...p.chapters];
                const newContent = data.content;
                const targetCap = chapters[i];
                if (!targetCap) return p;

                const updatedCap: ChapterContent = {
                  ...targetCap,
                  content: newContent,
                  wordCount: data.wordCount,
                  status: 'edited',
                };
                chapters[i] = updatedCap;

                const currentVersions = p.chapterVersions || {};
                const capVersions = currentVersions[updatedCap.numero] || [];

                const versionItem = createChapterVersion({
                  chapterNumber: updatedCap.numero,
                  content: newContent,
                  existingVersions: capVersions,
                  author: 'review_patch',
                  label: 'Revisão Editorial Aplicada (IA)',
                });

                return {
                  ...p,
                  chapters,
                  chapterVersions: {
                    ...currentVersions,
                    [updatedCap.numero]: [versionItem, ...capVersions],
                  },
                };
              });
            } else {
              addToast('error', `Erro no Cap. ${i + 1}`, data.error);
              break;
            }
          } catch (fetchErr: any) {
            addToast('error', `Erro de Rede (Cap. ${i + 1})`, fetchErr?.message);
            break;
          }

          if (i < total - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2500));
          }
        }

        if (appliedCount > 0) {
          appliedSuccess = true;
          addToast('success', 'Obra Polida', `Melhorias aplicadas em ${appliedCount} capítulo(s).`);
        }
      }

      // AUTOMATIC RE-AUDIT POST-IMPROVEMENTS
      if (appliedSuccess) {
        addToast(
          'info',
          'Nova Auditoria Automática',
          'Auditando a obra novamente para verificar se os erros foram corrigidos...'
        );
        await handleRunEditorialReview();
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Erro ao Aplicar Melhorias', err?.message);
    } finally {
      setIsApplyingReview(false);
      setGeneratingIndex(null);
    }
  };

  // 6. Generate Cover Image
  const handleGenerateCover = async (promptCapa?: string) => {
    setIsGeneratingCover(true);
    try {
      const res = await fetch('/api/editorial/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: activeProject.metadata.titulo,
          subtitulo: activeProject.metadata.subtitulo,
          autor: activeProject.metadata.autor,
          editora: activeProject.metadata.editora || 'OMNIA',
          estilo: activeProject.metadata.estilo,
          promptEstilo: activeProject.metadata.promptEstilo,
          tom: activeProject.metadata.tom,
          resumo: activeProject.metadata.resumo,
          publicoAlvo: activeProject.metadata.publicoAlvo,
          promptCapa,
          aiConfig,
        }),
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        updateActiveProject((p) => ({
          ...p,
          metadata: { ...p.metadata, coverImageUrl: data.imageUrl },
        }));
        addToast('success', 'Capa Gerada', 'Arte da capa gerada com sucesso.');
      } else {
        addToast('error', 'Erro na Capa', data.error || 'Não foi possível gerar a capa.');
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Erro de Conexão', err?.message);
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Project Management
  const handleNewProject = () => {
    const newProj: BookProject = {
      id: 'proj_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { ...DEFAULT_METADATA, titulo: 'Novo Livro Sem Título' },
      plan: null,
      chapters: [],
      frontMatter: {},
      endMatter: {},
      editorialReport: null,
      currentStage: 'config',
    };
    setProjects((prev) => [newProj, ...prev]);
    setCurrentProjectId(newProj.id);
    addToast('info', 'Novo Projeto Criado', 'Sua área de trabalho foi inicializada.');
  };

  const handleDeleteProject = (id: string) => {
    // Used to return silently, so the confirmation dialog just closed and the
    // project stayed put with no explanation.
    if (projects.length <= 1) {
      addToast(
        'error',
        'Exclusão Bloqueada',
        'A biblioteca precisa manter ao menos um projeto. Crie um novo projeto antes de excluir este.'
      );
      return;
    }
    const filtered = projects.filter((p) => p.id !== id);
    setProjects(filtered);
    if (currentProjectId === id && filtered[0]) {
      setCurrentProjectId(filtered[0].id);
    }
  };

  const handleImportProject = (imported: BookProject | BookProject[]) => {
    if (Array.isArray(imported)) {
      if (imported.length === 0) return;
      setProjects((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newProjects = imported.filter((p) => !existingIds.has(p.id));
        return [...newProjects, ...prev];
      });
      if (imported[0]) {
        setCurrentProjectId(imported[0].id);
      }
    } else {
      setProjects((prev) => [imported, ...prev.filter((p) => p.id !== imported.id)]);
      setCurrentProjectId(imported.id);
    }
    addToast('success', 'Importação Concluída', 'Projetos sincronizados com sucesso.');
  };

  const totalWords = activeProject.chapters.reduce(
    (acc: number, c: ChapterContent) => acc + (c.wordCount || 0),
    0
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FDFCFB] text-[#1C1917] font-sans antialiased flex flex-col">
        <ToastContainer toasts={toasts} onDismiss={removeToast} />

        {/* Persistence failure banner — must be impossible to miss: work is at risk. */}
        {storageWarning && (
          <div
            role="alert"
            className="bg-rose-950 text-rose-50 px-4 py-3 text-sm border-b border-rose-700 flex items-start justify-between gap-4"
          >
            <span>
              <strong className="font-bold">Falha ao salvar automaticamente.</strong>{' '}
              {storageWarning}
            </span>
            <button
              onClick={() => setStorageWarning(null)}
              className="shrink-0 text-rose-200 hover:text-white font-bold"
              aria-label="Fechar aviso de armazenamento"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Header */}
        <Header
          project={activeProject}
          activeStage={activeProject.currentStage}
          onSelectStage={setStage}
          onNewProject={handleNewProject}
          onOpenProjectList={() => setIsProjectModalOpen(true)}
          onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          onOpenTranslation={() => setIsTranslationModalOpen(true)}
          onOpenLogConsole={() => setIsLogConsoleOpen(true)}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          totalWordCount={totalWords}
        />

        {/* Main Content Workspace by Stage */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeProject.currentStage === 'config' && (
            <ConfigStage
              metadata={activeProject.metadata}
              onChangeMetadata={(updated) =>
                updateActiveProject((p) => ({ ...p, metadata: updated }))
              }
              onProceedToPlanning={handleGeneratePlan}
              onStartAutonomousPipeline={handleStartAutonomousPipeline}
              isGeneratingPlan={isGeneratingPlan}
            />
          )}

          {(activeProject.currentStage === 'writing' ||
            activeProject.currentStage === 'planning' ||
            activeProject.currentStage === 'review') && (
            <StudioStage
              project={activeProject}
              onUpdateChapterContent={(index, content) => {
                updateActiveProject((p) => {
                  const chapters = [...p.chapters];
                  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
                  const target = chapters[index];
                  if (target) {
                    chapters[index] = {
                      ...target,
                      content,
                      wordCount,
                      status: 'edited',
                    };
                  }
                  return { ...p, chapters };
                });
              }}
              onGenerateChapter={async (idx) => {
                await handleGenerateChapter(idx);
              }}
              onGenerateBatchChapters={handleGenerateBatchChapters}
              onRunAiAssist={async (text, action, chapterIndex) => {
                setAiAssistState({ text, action, chapterIndex });
              }}
              isGeneratingIndex={generatingIndex}
              isGeneratingBatch={isGeneratingBatch}
              onProceedToReview={() => setStage('review')}
              onProceedToExport={() => setStage('design_export')}
            />
          )}

          {activeProject.currentStage === 'design_export' && (
            <DesignExportStage
              project={activeProject}
              onUpdateCoverUrl={(url) =>
                updateActiveProject((p) => ({
                  ...p,
                  metadata: { ...p.metadata, coverImageUrl: url },
                }))
              }
              onOpenReader={() => setIsReaderOpen(true)}
              onGenerateCover={handleGenerateCover}
              isGeneratingCover={isGeneratingCover}
              onOpenTranslation={() => setIsTranslationModalOpen(true)}
            />
          )}
        </main>

        {/* Reader Modal */}
        {isReaderOpen && (
          <BookReaderModal project={activeProject} onClose={() => setIsReaderOpen(false)} />
        )}

        {/* AI Text Assist Modal */}
        {aiAssistState && (
          <AiTextAssistModal
            initialText={aiAssistState.text}
            initialAction={aiAssistState.action}
            language={activeProject.metadata.idioma}
            aiConfig={aiConfig}
            onApply={(replacementText) => {
              if (aiAssistState.chapterIndex !== undefined && activeProject) {
                const idx = aiAssistState.chapterIndex;
                updateActiveProject((p) => {
                  const chapters = [...p.chapters];
                  const targetCap = chapters[idx];
                  if (!targetCap) return p;

                  let updatedContent = targetCap.content;
                  if (updatedContent.includes(aiAssistState.text)) {
                    updatedContent = updatedContent.replace(aiAssistState.text, replacementText);
                  } else {
                    updatedContent = replacementText;
                  }

                  const updatedCap: ChapterContent = {
                    ...targetCap,
                    content: updatedContent,
                    wordCount: updatedContent.trim().split(/\s+/).filter(Boolean).length,
                    status: 'edited',
                  };
                  chapters[idx] = updatedCap;

                  return {
                    ...p,
                    chapters,
                  };
                });
              }
              setAiAssistState(null);
              addToast('success', 'Texto Substituído', 'A sugestão da IA foi aplicada no editor.');
            }}
            onClose={() => setAiAssistState(null)}
          />
        )}

        {/* Project Library Switcher Modal */}
        {isProjectModalOpen && (
          <ProjectListModal
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={(id) => setCurrentProjectId(id)}
            onNewProject={handleNewProject}
            onDeleteProject={handleDeleteProject}
            onImportProject={handleImportProject}
            onClose={() => setIsProjectModalOpen(false)}
          />
        )}

        {/* AI Settings Modal */}
        {isAiSettingsOpen && (
          <AiSettingsModal
            config={aiConfig}
            onSave={(newConfig) => {
              setAiConfig(newConfig);
              addToast('success', 'Configuração Salva', 'Provedores de IA e chaves atualizados.');
            }}
            onClose={() => setIsAiSettingsOpen(false)}
          />
        )}

        {/* Translation & Cultural Localizer Modal */}
        {isTranslationModalOpen && (
          <TranslationModal
            isOpen={isTranslationModalOpen}
            onClose={() => setIsTranslationModalOpen(false)}
            project={activeProject}
            aiConfig={aiConfig}
            onTranslationComplete={handleTranslationComplete}
          />
        )}

        {/* Live System Log & Diagnostic Console Modal */}
        <LogConsoleModal isOpen={isLogConsoleOpen} onClose={() => setIsLogConsoleOpen(false)} />

        {/* Autonomous 1-Click Pipeline Telemetry Modal */}
        {pipelineTelemetry && (
          <AutonomousPipelineModal
            isOpen={isPipelineModalOpen}
            telemetry={pipelineTelemetry}
            onCancel={() => {
              pipelineRunner?.cancel();
              setIsPipelineModalOpen(false);
            }}
            onMinimize={() => setIsPipelineModalOpen(false)}
          />
        )}

        {/* OMNIA Unified Control Sidebar Drawer */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={(id) => setCurrentProjectId(id)}
          onNewProject={handleNewProject}
          onDeleteProject={handleDeleteProject}
          aiConfig={aiConfig}
          onSaveAiConfig={(updated) => {
            setAiConfig(updated);
            addToast('success', 'Configuração Salva', 'Provedores de IA atualizados.');
          }}
        />

        <SidebarDrawer
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onOpenProjects={() => setIsProjectModalOpen(true)}
          onOpenSettings={() => setIsAiSettingsOpen(true)}
          onOpenLogs={() => setIsLogConsoleOpen(true)}
        />

        {/* Footer */}
        <footer className="bg-[#1C1917] text-stone-400 text-xs py-5 px-6 border-t border-stone-800 font-serif">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-white italic">OMNIA Factory — Editora OMNIA</span>
              <span className="text-[10px] uppercase tracking-wider text-stone-500">v2.5</span>
            </div>

            <div className="text-stone-300 font-sans text-[11px] uppercase tracking-wider">
              Desenvolvido por{' '}
              <strong className="text-white font-bold">Philippe Simões Fernandes</strong>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
