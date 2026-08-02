import { BookMetadata } from '../../../types';

export interface CoverageReport {
  topicsCovered: { topic: string; found: boolean }[];
  mandatoryInfoCovered: { info: string; found: boolean }[];
  forbiddenTermsViolated: string[];
  coverageScore: number; // 0 to 100
}

export function checkChapterCoverage(
  content: string,
  topics: string[],
  metadata: BookMetadata
): CoverageReport {
  const lowerContent = (content || '').toLowerCase();

  const topicsCovered = (topics || []).map((topic) => {
    const keywords = topic
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const found = keywords.some((kw) => lowerContent.includes(kw));
    return { topic, found };
  });

  const mandatoryItems = (metadata.informacoesObrigatorias || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const mandatoryInfoCovered = mandatoryItems.map((info) => {
    const keywords = info
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const found = keywords.some((kw) => lowerContent.includes(kw));
    return { info, found };
  });

  const forbiddenItems = (metadata.restricoes || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const forbiddenTermsViolated = forbiddenItems.filter((term) =>
    lowerContent.includes(term.toLowerCase())
  );

  const totalChecks = topicsCovered.length + mandatoryInfoCovered.length;
  const foundChecks =
    topicsCovered.filter((t) => t.found).length +
    mandatoryInfoCovered.filter((m) => m.found).length;

  const coverageScore = totalChecks > 0 ? Math.round((foundChecks / totalChecks) * 100) : 100;

  return {
    topicsCovered,
    mandatoryInfoCovered,
    forbiddenTermsViolated,
    coverageScore,
  };
}
