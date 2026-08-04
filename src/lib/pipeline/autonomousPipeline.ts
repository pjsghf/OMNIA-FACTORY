import { BookProject, EditorialPlan, AiConfig, ChapterContent } from '../../types';

export type PipelineStep =
  | 'idle'
  | 'planning'
  | 'front_matter'
  | 'writing_chapters'
  | 'end_matter'
  | 'review_audit'
  | 'review_improving'
  | 'completed'
  | 'failed';

export interface TelemetryState {
  step: PipelineStep;
  stepLabel: string;
  stepProgress: number; // 0 to 100
  totalSteps: number;
  currentStepIndex: number;
  activeAgent: string;
  activeModel: string;
  provider: string;
  currentWordCount: number;
  targetWordCount: number;
  completedChapters: number;
  totalChapters: number;
  reviewIteration: number;
  maxReviewIterations: number;
  currentScore?: number;
  targetScore: number;
  statusMessage: string;
  logs: string[];
  isPaused: boolean;
  isCancelled: boolean;
}

export interface AutonomousPipelineOptions {
  project: BookProject;
  aiConfig: AiConfig;
  targetScore?: number; // Default: 8.5
  maxReviewIterations?: number; // Default: 3
  onTelemetry: (telemetry: TelemetryState) => void;
  onProjectUpdate: (updater: (prev: BookProject) => BookProject) => void;
  addToast: (type: 'info' | 'success' | 'warn' | 'error', title: string, message: string) => void;
}

export class AutonomousPipelineRunner {
  private options: AutonomousPipelineOptions;
  private state: TelemetryState;
  private cancelRequested: boolean = false;

  constructor(options: AutonomousPipelineOptions) {
    this.options = options;
    const project = options.project;
    const totalCaps = project.metadata.qtdCapitulos || 7;
    const targetWords = project.metadata.maxPalavras || 15000;

    this.state = {
      step: 'idle',
      stepLabel: 'Aguardando Inicialização',
      stepProgress: 0,
      totalSteps: 6,
      currentStepIndex: 0,
      activeAgent: 'Orquestrador Master OMNIA',
      activeModel: options.aiConfig.opencodeModel || options.aiConfig.geminiModel || 'IA Standard',
      provider: options.aiConfig.provider || 'opencode',
      currentWordCount: 0,
      targetWordCount: targetWords,
      completedChapters: 0,
      totalChapters: totalCaps,
      reviewIteration: 0,
      maxReviewIterations: options.maxReviewIterations || 3,
      targetScore: options.targetScore || 8.5,
      statusMessage: 'Iniciando pipeline autônomo...',
      logs: [],
      isPaused: false,
      isCancelled: false,
    };
  }

  private emitTelemetry(msg?: string) {
    if (msg) {
      const timestamp = new Date().toLocaleTimeString('pt-BR');
      this.state.logs = [...this.state.logs, `[${timestamp}] ${msg}`].slice(-150);
      this.state.statusMessage = msg;
    }
    this.options.onTelemetry({ ...this.state });
  }

  public cancel() {
    this.cancelRequested = true;
    this.state.isCancelled = true;
    this.state.step = 'failed';
    this.emitTelemetry('Pipeline cancelado pelo usuário.');
  }

  public async run(): Promise<boolean> {
    try {
      this.state.step = 'planning';
      this.state.currentStepIndex = 1;
      this.state.stepLabel = '1. Planejamento Editorial & Sumário';
      this.state.stepProgress = 10;
      this.state.activeAgent = 'Estrategista de Conteúdo Senior';
      this.emitTelemetry('Gerando arquitetura editorial e estrutura de capítulos...');

      // PASSO 1: PLANEJAMENTO EDITORIAL
      const planSuccess = await this.executeStepPlan();
      if (!planSuccess || this.cancelRequested) return false;

      // PASSO 2: ELEMENTOS PRÉ-TEXTUAIS (Apresentação + Introdução)
      this.state.step = 'front_matter';
      this.state.currentStepIndex = 2;
      this.state.stepLabel = '2. Elementos Pré-Textuais';
      this.state.stepProgress = 25;
      this.state.activeAgent = 'Redator Editorial (Pré-Textual)';
      this.emitTelemetry('Gerando Apresentação e Introdução da obra...');

      await this.executeStepFrontMatter();
      if (this.cancelRequested) return false;

      // PASSO 3: REDAÇÃO DOS CAPÍTULOS EM LOTE
      this.state.step = 'writing_chapters';
      this.state.currentStepIndex = 3;
      this.state.stepLabel = '3. Redação Autônoma dos Capítulos';
      this.state.stepProgress = 40;
      this.state.activeAgent = 'Redator Principal de Ficção/Não-Ficção';
      this.emitTelemetry('Iniciando redação sequencial dos capítulos com continuidade...');

      const writingSuccess = await this.executeStepChapters();
      if (!writingSuccess || this.cancelRequested) return false;

      // PASSO 4: ELEMENTOS PÓS-TEXTUAIS (Conclusão + Exercícios + Agradecimentos + Autor)
      this.state.step = 'end_matter';
      this.state.currentStepIndex = 4;
      this.state.stepLabel = '4. Elementos Pós-Textuais';
      this.state.stepProgress = 70;
      this.state.activeAgent = 'Redator Editorial (Pós-Textual)';
      this.emitTelemetry('Gerando Conclusão, Exercícios Práticos e Agradecimentos...');

      await this.executeStepEndMatter();
      if (this.cancelRequested) return false;

      // PASSO 5: LOOP FECHADO DE REVISÃO EDITORIAL & AUTOCORREÇÃO
      this.state.step = 'review_audit';
      this.state.currentStepIndex = 5;
      this.state.stepLabel = '5. Auditoria & Autocorreção Editorial';
      this.state.stepProgress = 85;
      this.state.activeAgent = 'Auditor Editorial Sênior (CISSP Quality)';
      this.emitTelemetry('Iniciando loop de auditoria e otimização da obra...');

      await this.executeStepReviewLoop();
      if (this.cancelRequested) return false;

      // PASSO 6: FINALIZAÇÃO
      this.state.step = 'completed';
      this.state.currentStepIndex = 6;
      this.state.stepLabel = '6. Concluído & Pronto para Download';
      this.state.stepProgress = 100;
      this.state.activeAgent = 'Diagramador & Publicador OMNIA';
      this.emitTelemetry('Obra completa gerada com sucesso e pronta para exportação!');

      return true;
    } catch (err: any) {
      this.state.step = 'failed';
      this.emitTelemetry(`Erro fatal no pipeline: ${err?.message || err}`);
      return false;
    }
  }

  private async executeStepPlan(): Promise<boolean> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.cancelRequested) return false;

      if (attempt > 1) {
        this.emitTelemetry(
          `Tentativa ${attempt} de 3: Reagendando geração do planejamento editorial com tempo expandido...`
        );
        await new Promise((r) => setTimeout(r, 4000));
      }

      try {
        const res = await fetch('/api/editorial/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...this.options.project.metadata,
            aiConfig: this.options.aiConfig,
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

          this.options.onProjectUpdate((prev) => ({
            ...prev,
            plan,
            chapters,
          }));
          this.state.totalChapters = plan.sumario?.length || 7;
          this.emitTelemetry(
            `Planejamento concluído com ${this.state.totalChapters} capítulos no sumário.`
          );
          return true;
        } else {
          this.emitTelemetry(
            `Aviso na tentativa ${attempt} de planejamento: ${data.error || 'Erro no planejamento'}`
          );
        }
      } catch (err: any) {
        this.emitTelemetry(`Erro na tentativa ${attempt} de planejamento: ${err?.message || err}`);
      }
    }

    this.emitTelemetry('Falha no planejamento após 3 tentativas.');
    return false;
  }

  private async executeStepFrontMatter() {
    for (const section of ['apresentacao', 'introducao'] as const) {
      if (this.cancelRequested) break;
      try {
        const res = await fetch('/api/editorial/generate-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: this.options.project.metadata,
            plan: this.options.project.plan,
            sectionType: section,
            aiConfig: this.options.aiConfig,
          }),
        });
        const data = await res.json();
        if (data.success && data.content) {
          this.options.onProjectUpdate((prev) => ({
            ...prev,
            frontMatter: {
              ...prev.frontMatter,
              [section]: data.content,
            },
          }));
          this.emitTelemetry(`Seção pré-textual '${section}' gerada com sucesso.`);
        }
      } catch (err: any) {
        this.emitTelemetry(`Aviso: falha ao gerar pré-textual ${section}: ${err?.message}`);
      }
    }
  }

  private async executeStepChapters(): Promise<boolean> {
    const total = this.state.totalChapters;
    for (let i = 0; i < total; i++) {
      if (this.cancelRequested) return false;

      this.emitTelemetry(`Redigindo Capítulo ${i + 1} de ${total}...`);
      let chapterSuccess = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await fetch('/api/editorial/generate-chapter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              metadata: this.options.project.metadata,
              plan: this.options.project.plan,
              chapterIndex: i,
              memory: this.options.project.bookBibleMemory,
              aiConfig: this.options.aiConfig,
            }),
          });
          const data = await res.json();
          if (data.success && data.content) {
            this.options.onProjectUpdate((prev) => {
              const chapters = [...prev.chapters];
              chapters[i] = {
                numero: data.chapterNumber || i + 1,
                titulo: data.title || chapters[i]?.titulo || `Capítulo ${i + 1}`,
                subtitulo: chapters[i]?.subtitulo,
                content: data.content,
                wordCount: data.wordCount || 0,
                status: 'completed',
              };
              return {
                ...prev,
                chapters,
                bookBibleMemory: data.updatedMemory || prev.bookBibleMemory,
              };
            });

            this.state.completedChapters = i + 1;
            this.state.currentWordCount += data.wordCount || 0;
            this.state.stepProgress = 40 + Math.round(((i + 1) / total) * 30);
            this.emitTelemetry(`Capítulo ${i + 1} concluído (${data.wordCount || 0} palavras).`);
            chapterSuccess = true;
            break;
          }
        } catch (err: any) {
          this.emitTelemetry(`Tentativa ${attempt} falhou no Cap. ${i + 1}: ${err?.message}`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      if (!chapterSuccess) {
        this.emitTelemetry(`Capítulo ${i + 1} falhou nas tentativas. Continuando com o próximo...`);
      }
    }
    return true;
  }

  private async executeStepEndMatter() {
    for (const section of ['conclusao', 'exercicios', 'agradecimentos', 'sobreAutor'] as const) {
      if (this.cancelRequested) break;
      try {
        const res = await fetch('/api/editorial/generate-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: this.options.project.metadata,
            plan: this.options.project.plan,
            sectionType: section,
            aiConfig: this.options.aiConfig,
          }),
        });
        const data = await res.json();
        if (data.success && data.content) {
          this.options.onProjectUpdate((prev) => ({
            ...prev,
            endMatter: {
              ...prev.endMatter,
              [section]: data.content,
            },
          }));
          this.emitTelemetry(`Seção pós-textual '${section}' gerada com sucesso.`);
        }
      } catch (err: any) {
        this.emitTelemetry(`Aviso: falha ao gerar pós-textual ${section}: ${err?.message}`);
      }
    }
  }

  private async executeStepReviewLoop() {
    let iteration = 0;
    const maxIter = this.state.maxReviewIterations;
    const targetScore = this.state.targetScore;

    while (iteration < maxIter && !this.cancelRequested) {
      iteration++;
      this.state.reviewIteration = iteration;
      this.emitTelemetry(`Executando auditoria editorial (Iteração ${iteration} de ${maxIter})...`);

      try {
        const resAudit = await fetch('/api/editorial/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metadata: this.options.project.metadata,
            chapters: this.options.project.chapters,
            frontMatter: this.options.project.frontMatter,
            endMatter: this.options.project.endMatter,
            aiConfig: this.options.aiConfig,
          }),
        });
        const dataAudit = await resAudit.json();
        if (dataAudit.success && dataAudit.report) {
          const report = dataAudit.report;
          const score = report.overallScore || 8.0;
          this.state.currentScore = score;
          this.options.onProjectUpdate((prev) => ({
            ...prev,
            reviewReport: report,
          }));

          this.emitTelemetry(`Auditoria concluída. Nota geral da obra: ${score.toFixed(1)} / 10.`);

          if (score >= targetScore) {
            this.emitTelemetry(
              `Nota ${score.toFixed(1)} atingiu a meta de qualidade (>= ${targetScore}). Loop encerrado.`
            );
            break;
          }

          if (iteration < maxIter) {
            this.state.step = 'review_improving';
            this.emitTelemetry(
              `Aplicando melhorias propostas pela IA (Nota ${score.toFixed(1)} < ${targetScore})...`
            );
            const resImp = await fetch('/api/editorial/apply-review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                metadata: this.options.project.metadata,
                chapters: this.options.project.chapters,
                report,
                aiConfig: this.options.aiConfig,
              }),
            });
            const dataImp = await resImp.json();
            if (dataImp.success && Array.isArray(dataImp.updatedChapters)) {
              this.options.onProjectUpdate((prev) => ({
                ...prev,
                chapters: dataImp.updatedChapters,
              }));
              this.emitTelemetry('Melhorias aplicadas nos capítulos. Executando re-auditoria...');
            }
          }
        } else {
          this.emitTelemetry(`Aviso na auditoria: ${dataAudit.error || 'Falha na revisão'}`);
          break;
        }
      } catch (err: any) {
        this.emitTelemetry(`Aviso durante loop de revisão: ${err?.message}`);
        break;
      }
    }
  }
}
