import { useState, useEffect } from 'react';
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
import { PlanningStage } from './components/PlanningStage';
import { WritingStage } from './components/WritingStage';
import { ReviewStage } from './components/ReviewStage';
import { DesignExportStage } from './components/DesignExportStage';
import { BookReaderModal } from './components/BookReaderModal';
import { AiTextAssistModal } from './components/AiTextAssistModal';
import { ProjectListModal } from './components/ProjectListModal';
import { AiSettingsModal } from './components/AiSettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { createChapterVersion } from './lib/ai/review/versionManager';

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
  provider: 'gemini',
  geminiModel: 'gemini-3.6-flash',
  opencodeApiKey: '',
  opencodeBaseUrl: 'https://opencode.go/api/v1',
  opencodeModel: 'opencode/claude-3-5-sonnet',
};

export default function App() {
  // Saved Projects
  const [projects, setProjects] = useState<BookProject[]>(() => {
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

  const [currentProjectId, setCurrentProjectId] = useState<string>(projects[0]?.id || '');

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => {
    const saved = localStorage.getItem('scriptor_aiconfig_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing aiConfig from localStorage', e);
      }
    }
    return DEFAULT_AI_CONFIG;
  });

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
  const [aiAssistState, setAiAssistState] = useState<{
    text: string;
    action: string;
    chapterIndex?: number;
  } | null>(null);

  // Auto-save projects to localStorage
  useEffect(() => {
    localStorage.setItem('scriptor_projects_v2', JSON.stringify(projects));
  }, [projects]);

  // Auto-save aiConfig
  useEffect(() => {
    localStorage.setItem('scriptor_aiconfig_v1', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const activeProject = projects.find((p) => p.id === currentProjectId) || projects[0];

  if (!activeProject) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-[#FDFCFB] text-[#1C1917]">
          Nenhum projeto disponível. Recarregue a aplicação para criar um novo projeto.
        </div>
      </ErrorBoundary>
    );
  }

  const updateActiveProject = (updater: (prev: BookProject) => BookProject) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === activeProject.id) {
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
    setIsGeneratingPlan(true);
    try {
      const res = await fetch('/api/editorial/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activeProject.metadata,
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
          'O plano de capítulos e diretrizes foi montado.'
        );
      } else {
        addToast(
          'error',
          'Falha no Planejamento',
          data.error || 'Erro ao gerar planejamento editorial.'
        );
      }
    } catch (err: any) {
      console.error(err);
      addToast('error', 'Erro de Conexão', 'Erro na comunicação com o provedor de IA.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // 2. Generate Single Chapter
  const handleGenerateChapter = async (index: number): Promise<boolean> => {
    if (!activeProject.plan) return false;
    setGeneratingIndex(index);

    try {
      const previousSummaries = activeProject.chapters
        .slice(0, index)
        .filter((c) => c.content)
        .map((c) => `Capítulo ${c.numero} (${c.titulo}): ${c.content.slice(0, 300)}...`);

      const res = await fetch('/api/editorial/generate-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: activeProject.metadata,
          plan: activeProject.plan,
          chapterIndex: index,
          previousSummaries,
          aiConfig,
        }),
      });

      const data = await res.json();
      if (data.success) {
        updateActiveProject((p) => {
          const chapters = [...p.chapters];
          const chapter = chapters[index];
          if (!chapter) return p;
          const newContent = data.content;
          chapters[index] = {
            ...chapter,
            content: newContent,
            wordCount: data.wordCount,
            status: 'completed',
          };
          const chapterNumber = chapter.numero;

          // Save Version Item
          const versionItem = createChapterVersion({
            chapterNumber,
            content: newContent,
            author: 'ia',
            label: 'Draft Inicial Gerado por IA',
          });

          const currentVersions = p.chapterVersions || {};
          const capVersions = currentVersions[chapterNumber] || [];

          return {
            ...p,
            chapters,
            chapterVersions: {
              ...currentVersions,
              [chapterNumber]: [versionItem, ...capVersions],
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
    if (!activeProject.plan) return;
    setIsGeneratingBatch(true);

    const totalCaps = activeProject.plan.sumario.length;
    for (let i = 0; i < totalCaps; i++) {
      if (
        activeProject.chapters[i]?.status === 'completed' &&
        activeProject.chapters[i]?.content?.trim()
      ) {
        continue;
      }

      setGeneratingIndex(i);
      const success = await handleGenerateChapter(i);
      if (!success) break;

      if (i < totalCaps - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }

    setIsGeneratingBatch(false);
    setGeneratingIndex(null);
  };

  // 4. Generate Front/End Matter Section
  const handleGenerateFrontOrEndMatter = async (
    type:
      'apresentacao' | 'introducao' | 'conclusao' | 'agradecimentos' | 'sobreAutor' | 'exercicios'
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/editorial/generate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: activeProject.metadata,
          plan: activeProject.plan,
          sectionType: type,
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
      if (!sec) break;
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
          project: activeProject,
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

  // 5B. Apply Editorial Review Improvements to Chapters
  const handleApplyReviewImprovements = async (chapterIndex?: number) => {
    if (!activeProject.editorialReport) {
      addToast('error', 'Sem Relatório', 'Execute a auditoria editorial primeiro.');
      return;
    }

    setIsApplyingReview(true);

    try {
      if (typeof chapterIndex === 'number') {
        const targetCap = activeProject.chapters[chapterIndex];
        if (!targetCap || !targetCap.content?.trim()) {
          addToast('error', 'Capítulo Vazio', `Capítulo ${chapterIndex + 1} não possui texto.`);
          return;
        }

        setGeneratingIndex(chapterIndex);

        const res = await fetch('/api/editorial/apply-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: activeProject.metadata,
            plan: activeProject.plan,
            chapterIndex,
            chapterTitle: targetCap.titulo,
            chapterContent: targetCap.content,
            report: activeProject.editorialReport,
            aiConfig,
          }),
        });

        const data = await res.json();
        if (data.success) {
          updateActiveProject((p) => {
            const chapters = [...p.chapters];
            const chapter = chapters[chapterIndex];
            if (!chapter) return p;
            const newContent = data.content;
            chapters[chapterIndex] = {
              ...chapter,
              content: newContent,
              wordCount: data.wordCount,
              status: 'edited',
            };
            const chapterNumber = chapter.numero;

            const versionItem = createChapterVersion({
              chapterNumber,
              content: newContent,
              author: 'review_patch',
              label: 'Revisão Editorial Aplicada (IA)',
            });

            const currentVersions = p.chapterVersions || {};
            const capVersions = currentVersions[chapterNumber] || [];

            return {
              ...p,
              chapters,
              chapterVersions: {
                ...currentVersions,
                [chapterNumber]: [versionItem, ...capVersions],
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
        const total = activeProject.chapters.length;
        let appliedCount = 0;

        for (let i = 0; i < total; i++) {
          const cap = activeProject.chapters[i];
          if (!cap || !cap.content?.trim()) continue;

          setGeneratingIndex(i);

          try {
            const res = await fetch('/api/editorial/apply-review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                metadata: activeProject.metadata,
                plan: activeProject.plan,
                chapterIndex: i,
                chapterTitle: cap.titulo,
                chapterContent: cap.content,
                report: activeProject.editorialReport,
                aiConfig,
              }),
            });

            const data = await res.json();
            if (data.success) {
              appliedCount++;
              updateActiveProject((p) => {
                const chapters = [...p.chapters];
                const chapter = chapters[i];
                if (!chapter) return p;
                const newContent = data.content;
                chapters[i] = {
                  ...chapter,
                  content: newContent,
                  wordCount: data.wordCount,
                  status: 'edited',
                };
                const chapterNumber = chapter.numero;

                const versionItem = createChapterVersion({
                  chapterNumber,
                  content: newContent,
                  author: 'review_patch',
                  label: 'Revisão Editorial Aplicada (IA)',
                });

                const currentVersions = p.chapterVersions || {};
                const capVersions = currentVersions[chapterNumber] || [];

                return {
                  ...p,
                  chapters,
                  chapterVersions: {
                    ...currentVersions,
                    [chapterNumber]: [versionItem, ...capVersions],
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
          addToast('success', 'Obra Polida', `Melhorias aplicadas em ${appliedCount} capítulo(s).`);
        }
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
    if (projects.length <= 1) return;
    const filtered = projects.filter((p) => p.id !== id);
    setProjects(filtered);
    if (currentProjectId === id) {
      const nextProject = filtered[0];
      if (nextProject) setCurrentProjectId(nextProject.id);
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
      const firstImportedProject = imported[0];
      if (firstImportedProject) setCurrentProjectId(firstImportedProject.id);
    } else {
      setProjects((prev) => [imported, ...prev.filter((p) => p.id !== imported.id)]);
      setCurrentProjectId(imported.id);
    }
    addToast('success', 'Importação Concluída', 'Projetos sincronizados com sucesso.');
  };

  const totalWords = activeProject.chapters.reduce((acc, c) => acc + (c.wordCount || 0), 0);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#FDFCFB] text-[#1C1917] font-sans antialiased flex flex-col">
        <ToastContainer toasts={toasts} onDismiss={removeToast} />

        {/* Navigation Header */}
        <Header
          project={activeProject}
          activeStage={activeProject.currentStage}
          onSelectStage={setStage}
          onNewProject={handleNewProject}
          onOpenProjectList={() => setIsProjectModalOpen(true)}
          onOpenAiSettings={() => setIsAiSettingsOpen(true)}
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
              isGeneratingPlan={isGeneratingPlan}
            />
          )}

          {activeProject.currentStage === 'planning' && (
            <PlanningStage
              plan={activeProject.plan}
              metadata={activeProject.metadata}
              onUpdatePlan={(updatedPlan) =>
                updateActiveProject((p) => ({ ...p, plan: updatedPlan }))
              }
              onRegeneratePlan={handleGeneratePlan}
              onProceedToWriting={() => setStage('writing')}
              isGenerating={isGeneratingPlan}
            />
          )}

          {activeProject.currentStage === 'writing' && (
            <WritingStage
              metadata={activeProject.metadata}
              plan={
                activeProject.plan || {
                  conceitoCentral: '',
                  promessaPrincipal: '',
                  perfilLeitor: { descricao: '', doresEAnseios: [], oQueBuscaraNoLivro: [] },
                  sumario: [],
                }
              }
              chapters={activeProject.chapters}
              frontMatter={activeProject.frontMatter}
              endMatter={activeProject.endMatter}
              onUpdateChapter={(index, content) => {
                updateActiveProject((p) => {
                  const chapters = [...p.chapters];
                  const chapter = chapters[index];
                  if (!chapter) return p;
                  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
                  chapters[index] = {
                    ...chapter,
                    content,
                    wordCount,
                    status: 'edited',
                  };
                  return { ...p, chapters };
                });
              }}
              onUpdateFrontOrEndMatter={handleUpdateFrontOrEndMatter}
              onGenerateChapter={handleGenerateChapter}
              onGenerateBatchChapters={handleGenerateBatchChapters}
              onGenerateFrontOrEndMatter={handleGenerateFrontOrEndMatter}
              onGenerateBatchFrontAndEndMatter={handleGenerateBatchFrontAndEndMatter}
              onOpenAiAssist={(text, action) => setAiAssistState({ text, action })}
              isGeneratingBatch={isGeneratingBatch}
              isGeneratingFrontEndBatch={isGeneratingFrontEndBatch}
              generatingIndex={generatingIndex}
            />
          )}

          {activeProject.currentStage === 'review' && (
            <ReviewStage
              report={activeProject.editorialReport}
              onRunReview={handleRunEditorialReview}
              onApplyReviewImprovements={handleApplyReviewImprovements}
              isReviewing={isReviewing}
              isApplyingReview={isApplyingReview}
              generatingIndex={generatingIndex}
              totalWords={totalWords}
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
            onApply={(_replacement) => {
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
