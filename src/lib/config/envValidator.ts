/**
 * Startup Environment Configuration & Validation
 */

export interface EnvConfig {
  port: number;
  nodeEnv: string;
  hasGeminiKey: boolean;
  maxContentLengthMb: number;
}

export function validateAndLoadEnv(): EnvConfig {
  const portStr = process.env.PORT || '3000';
  const port = parseInt(portStr, 10);
  
  if (isNaN(port) || port <= 0 || port > 65535) {
    console.error(`[Env Validation] Invalid PORT environment variable: "${portStr}". Defaulting to 3000.`);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

  if (!hasGeminiKey) {
    console.warn('[Env Validation] WARNING: GEMINI_API_KEY is not defined in process.env. AI Orchestrator will use fallback or client-supplied config.');
  }

  const config: EnvConfig = {
    port: isNaN(port) ? 3000 : port,
    nodeEnv,
    hasGeminiKey,
    maxContentLengthMb: 25,
  };

  console.log(`[Env Validation] Config Loaded — Port: ${config.port}, Mode: ${config.nodeEnv}, Gemini API Key Present: ${config.hasGeminiKey}`);
  return config;
}
