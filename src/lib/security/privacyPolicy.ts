/**
 * Privacy Policy, Data Minimization & LGPD/GDPR Project Data Retention Policy
 */

export interface PrivacyPolicyManifest {
  version: string;
  lastUpdated: string;
  dataTypesProcessed: string[];
  thirdPartyProviders: string[];
  retentionPeriodDays: number;
  dataRights: string[];
}

export const CURRENT_PRIVACY_POLICY: PrivacyPolicyManifest = {
  version: '2.5.0',
  lastUpdated: '2026-08-02',
  dataTypesProcessed: [
    'Manuscritos e textos de capítulos do livro',
    'Metadados editoriais (Título, Autor, Editora, Gênero)',
    'Prompt de geração de capa e especificações de design',
    'Logs de auditoria e qualidade editorial (Sem gravação de segredos)',
  ],
  thirdPartyProviders: [
    'Google Gemini API (Processamento server-side estrito sem armazenamento permanente)',
    'OpenCode AI (Provedor opcional configurado pelo usuário)',
  ],
  retentionPeriodDays: 30, // Local projects auto-expirable or user-deletable on demand
  dataRights: [
    'Direito de Acesso e Exportação Integral (JSON, EPUB, PDF, HTML, Markdown)',
    'Direito ao Esquecimento e Exclusão Definitiva do Projeto e Assets',
    'Direito de Não-Treinamento (Seus manuscritos não são utilizados para treinar modelos de IA)',
  ],
};

export function sanitizeLogsForPrivacy(text: string): string {
  if (!text) return '';
  // Redact potential PII like full emails or raw API credentials in runtime logs
  return text
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]')
    .replace(/(AIzaSy[A-Za-z0-9_-]{33})/g, '[GEMINI KEY REDACTED]');
}
