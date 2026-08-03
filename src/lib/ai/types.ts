export type AiTaskType = 'plan' | 'writing' | 'review' | 'general' | 'image';

export interface TextGenerationRequest {
  systemInstruction: string;
  prompt: string;
  taskType: AiTaskType;
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  userMaterials?: string;
  userRestrictions?: string;
  aiConfig?: {
    provider?: 'gemini' | 'opencode';
    geminiModel?: string;
    opencodeApiKey?: string;
    opencodeBaseUrl?: string;
    opencodeModel?: string;
  };
}

export interface StructuredRequest<T> extends TextGenerationRequest {
  validator?: (data: any) => { success: boolean; data?: T; error?: string };
}

export interface ImageGenerationRequest {
  prompt: string;
  aspectRatio?: '3:4' | '1:1' | '16:9';
  model?: string;
  title?: string;
  author?: string;
  subtitle?: string;
  style?: string;
  publisher?: string;
  aiConfig?: any;
}

export interface TextGenerationResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}

export interface ImageResult {
  imageUrl: string;
  provider: string;
  model: string;
  isVectorSvg?: boolean;
  note?: string;
}

export interface ProviderHealth {
  provider: string;
  status: 'ok' | 'degraded' | 'unavailable';
  details?: string;
  modelsAvailable: string[];
}

export interface ModelCapability {
  id: string;
  displayName: string;
  provider: 'gemini' | 'opencode';
  allowedTasks: AiTaskType[];
  maxOutputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  contextWindow: number;
  isDefault?: boolean;
}

export interface AiProvider {
  name: string;
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult>;
  generateStructured<T>(
    request: StructuredRequest<T>
  ): Promise<{ data: T; result: TextGenerationResult }>;
  generateImage?(request: ImageGenerationRequest): Promise<ImageResult>;
  healthCheck(): Promise<ProviderHealth>;
}
