export interface SimpleProgressState {
  isGenerating: boolean;
  currentStepMessage: string; // Ex: "Escrevendo Capítulo 3 de 10..."
  percentage: number; // 0 a 100
  activeAgentRole?: string;
  wordCount?: number;
}
