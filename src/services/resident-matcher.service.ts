import { Unit } from '../types';

export interface ResidentMatchResult {
  matchedUnit: Unit | null;
  confidenceScore: number; // 0 to 100
  isHighConfidence: boolean; // >= 85
  matchReason: string;
  matchType: 'EXACT_UNIT' | 'EXACT_NAME' | 'FUZZY_NAME_AND_UNIT' | 'FUZZY_NAME_ONLY' | 'UNIT_ONLY' | 'NONE';
  alternativeMatches: Array<{
    unit: Unit;
    confidenceScore: number;
    reason: string;
  }>;
}

export class ResidentMatcherService {
  /**
   * Normalizes strings by lowercasing, stripping diacritics/accents, and removing punctuation
   */
  public normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics
      .replace(/[^a-z0-9\s]/g, ' ') // remove special chars
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculates Levenshtein edit distance between two strings
   */
  public calculateLevenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    const n = a.length;
    const m = b.length;

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = 0; i <= n; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= m; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[n][m];
  }

  /**
   * Computes string similarity ratio between 0 and 1
   */
  public calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeText(str1);
    const s2 = this.normalizeText(str2);

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const dist = this.calculateLevenshtein(s1, s2);
    return Math.max(0, (maxLen - dist) / maxLen);
  }

  /**
   * Computes token-based Jaccard similarity between names
   * (handles name inversion: "Lima, Beatriz" vs "Beatriz Lima" or middle names)
   */
  public calculateNameTokenSimilarity(extractedName: string, residentName: string): number {
    const normExtracted = this.normalizeText(extractedName);
    const normResident = this.normalizeText(residentName);

    if (normExtracted === normResident) return 1.0;

    const tokensExtracted = normExtracted.split(/\s+/).filter((t) => t.length > 1);
    const tokensResident = normResident.split(/\s+/).filter((t) => t.length > 1);

    if (tokensExtracted.length === 0 || tokensResident.length === 0) return 0;

    let matchedTokens = 0;
    let totalWeight = 0;

    for (const tExt of tokensExtracted) {
      // Ignore common Portuguese particles
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(tExt)) continue;
      totalWeight++;

      // Check for exact token match or close substring match
      const hasMatch = tokensResident.some((tRes) => {
        if (tExt === tRes) return true;
        if (tExt.length >= 3 && tRes.length >= 3) {
          return this.calculateSimilarity(tExt, tRes) >= 0.82;
        }
        return false;
      });

      if (hasMatch) {
        matchedTokens++;
      }
    }

    if (totalWeight === 0) return 0;
    const tokenScore = matchedTokens / totalWeight;
    const wholeStringSim = this.calculateSimilarity(normExtracted, normResident);

    return Math.max(tokenScore * 0.9, wholeStringSim);
  }

  /**
   * Performs smart multi-tier matching against the resident database
   */
  public matchResident(
    units: Unit[],
    extractedBlock?: string | null,
    extractedApartment?: number | null,
    extractedName?: string | null
  ): ResidentMatchResult {
    const candidates: Array<{
      unit: Unit;
      score: number;
      reason: string;
      matchType: ResidentMatchResult['matchType'];
    }> = [];

    const normName = extractedName ? this.normalizeText(extractedName) : '';

    // CASE 1: BOTH BLOCK AND APARTMENT ARE DETECTED
    if (extractedBlock && extractedApartment) {
      const exactUnit = units.find(
        (u) => u.block === extractedBlock && u.apartment === extractedApartment
      );

      if (exactUnit) {
        let score = 90;
        let reason = `Correspondência exata de Bloco ${extractedBlock} e Apartamento ${extractedApartment}`;
        let matchType: ResidentMatchResult['matchType'] = 'EXACT_UNIT';

        if (normName) {
          const nameSim = this.calculateNameTokenSimilarity(normName, exactUnit.residentName);
          if (nameSim >= 0.8) {
            score = 99;
            reason = `Correspondência 100% de Unidade (Bl ${extractedBlock} - Apt ${extractedApartment}) e Nome '${exactUnit.residentName}'`;
            matchType = 'EXACT_UNIT';
          } else if (nameSim >= 0.5) {
            score = 92;
            reason = `Unidade confirmada (Bl ${extractedBlock} - Apt ${extractedApartment}) com similaridade parcial de nome`;
          } else {
            score = 86;
            reason = `Unidade confirmada (Bl ${extractedBlock} - Apt ${extractedApartment}), destinatário '${extractedName}' pode ser dependente`;
          }
        }

        candidates.push({
          unit: exactUnit,
          score,
          reason,
          matchType
        });
      }
    }

    // CASE 2: NAME SEARCH ACROSS ALL UNITS (FUZZY & EXACT)
    if (normName && normName.length >= 3) {
      for (const unit of units) {
        // Skip if already in candidate as exact unit with high score
        if (candidates.some((c) => c.unit.id === unit.id)) continue;

        const nameSim = this.calculateNameTokenSimilarity(normName, unit.residentName);

        if (nameSim >= 0.85) {
          // High name match
          let score = Math.round(nameSim * 92);
          let reason = `Nome '${unit.residentName}' compatível (${Math.round(nameSim * 100)}% similaridade)`;
          let matchType: ResidentMatchResult['matchType'] = 'FUZZY_NAME_ONLY';

          // Bonus if extracted block or apartment matches
          if (extractedBlock && unit.block === extractedBlock) {
            score = Math.min(98, score + 10);
            reason += ` + Bloco ${unit.block} confirmado`;
            matchType = 'FUZZY_NAME_AND_UNIT';
          } else if (extractedApartment && unit.apartment === extractedApartment) {
            score = Math.min(98, score + 10);
            reason += ` + Apartamento ${unit.apartment} confirmado`;
            matchType = 'FUZZY_NAME_AND_UNIT';
          }

          candidates.push({
            unit,
            score,
            reason,
            matchType
          });
        } else if (nameSim >= 0.65) {
          // Moderate name match
          const score = Math.round(nameSim * 70);
          candidates.push({
            unit,
            score,
            reason: `Possível morador: ${unit.residentName} (${Math.round(nameSim * 100)}% de match)`,
            matchType: 'FUZZY_NAME_ONLY'
          });
        }
      }
    }

    // Sort candidates by score descending
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return {
        matchedUnit: null,
        confidenceScore: 0,
        isHighConfidence: false,
        matchReason: 'Nenhuma unidade ou morador correspondente identificado.',
        matchType: 'NONE',
        alternativeMatches: []
      };
    }

    const topMatch = candidates[0];
    const alternatives = candidates.slice(1, 5).map((c) => ({
      unit: c.unit,
      confidenceScore: c.score,
      reason: c.reason
    }));

    return {
      matchedUnit: topMatch.unit,
      confidenceScore: topMatch.score,
      isHighConfidence: topMatch.score >= 85,
      matchReason: topMatch.reason,
      matchType: topMatch.matchType,
      alternativeMatches: alternatives
    };
  }
}

export const residentMatcherService = new ResidentMatcherService();
