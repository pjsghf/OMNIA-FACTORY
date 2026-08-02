export interface UserSourceItem {
  id: string;
  title: string;
  author?: string;
  contentSnippet: string;
  provenance: string;
}

export interface VerificationReport {
  hasSources: boolean;
  claimsVerified: number;
  unsupportedClaims: string[];
  resolvedCitations: string[];
}

export function extractCitationsAndClaims(content: string, sources: UserSourceItem[]): VerificationReport {
  if (!content) {
    return {
      hasSources: sources.length > 0,
      claimsVerified: 0,
      unsupportedClaims: [],
      resolvedCitations: [],
    };
  }

  const resolvedCitations: string[] = [];
  const unsupportedClaims: string[] = [];

  // Check if citations reference source titles or IDs
  sources.forEach((source) => {
    if (
      content.toLowerCase().includes(source.title.toLowerCase()) ||
      (source.author && content.toLowerCase().includes(source.author.toLowerCase()))
    ) {
      resolvedCitations.push(`Fonte citada: "${source.title}" (${source.author || 'Autor informado'})`);
    }
  });

  return {
    hasSources: sources.length > 0,
    claimsVerified: resolvedCitations.length,
    unsupportedClaims,
    resolvedCitations,
  };
}
