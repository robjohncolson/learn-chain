/**
 * Pattern Detector
 * Advanced pattern detection for collusion, sybil attacks, and gaming strategies
 */

import { Transaction, AttestationData } from '../core/types';
import { QuestionAttestation } from '../questions/types';

export interface CollusionReport {
  detected: boolean;
  groups: string[][]; // Groups of colluding users
  confidence: number;
  evidence: string[];
}

export interface SybilReport {
  detected: boolean;
  suspectedSybils: string[]; // List of suspected sybil accounts
  masterAccount?: string;
  confidence: number;
  patterns: string[];
}

export interface StrategyReport {
  userId: string;
  strategies: GamingStrategy[];
  riskScore: number; // 0-100
  recommendations: string[];
}

export enum GamingStrategy {
  COPY_PASTE = 'COPY_PASTE',           // Copying answers from others
  RAPID_FIRE = 'RAPID_FIRE',           // Answering too quickly
  ALWAYS_EXTREME = 'ALWAYS_EXTREME',   // Always choosing extreme values
  ALWAYS_MIDDLE = 'ALWAYS_MIDDLE',     // Always choosing middle values
  PATTERN_ANSWER = 'PATTERN_ANSWER',   // Following a pattern (A,B,C,D,E,A,B...)
  TIME_CLUSTERING = 'TIME_CLUSTERING', // All answers at similar times
  SCORE_MANIPULATION = 'SCORE_MANIPULATION' // Trying to manipulate consensus
}

export class PatternDetector {
  private readonly COLLUSION_THRESHOLD = 0.8; // 80% similarity
  private readonly SYBIL_THRESHOLD = 0.9;     // 90% similarity
  private readonly TIME_WINDOW_MS = 60000;    // 1 minute for time clustering

  /**
   * Detect collusion between users
   */
  detectCollusion(
    users: string[], 
    attestations: QuestionAttestation[]
  ): CollusionReport {
    const groups: string[][] = [];
    const evidence: string[] = [];
    let maxSimilarity = 0;

    // Group attestations by user
    const userAttestations = this.groupByUser(attestations);

    // Compare each pair of users
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const user1 = users[i];
        const user2 = users[j];

        const similarity = this.calculateSimilarity(
          userAttestations.get(user1) || [],
          userAttestations.get(user2) || []
        );

        if (similarity > this.COLLUSION_THRESHOLD) {
          // Check if either user is already in a group
          let added = false;
          for (const group of groups) {
            if (group.includes(user1) || group.includes(user2)) {
              if (!group.includes(user1)) group.push(user1);
              if (!group.includes(user2)) group.push(user2);
              added = true;
              break;
            }
          }

          if (!added) {
            groups.push([user1, user2]);
          }

          evidence.push(`Users ${user1} and ${user2} have ${(similarity * 100).toFixed(1)}% similar answers`);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }
    }

    // Check for time-based collusion
    const timeCollusion = this.detectTimeBasedCollusion(attestations);
    if (timeCollusion.detected) {
      evidence.push(...timeCollusion.evidence);
      groups.push(...timeCollusion.groups);
    }

    return {
      detected: groups.length > 0,
      groups,
      confidence: maxSimilarity,
      evidence
    };
  }

  /**
   * Detect Sybil attacks
   */
  detectSybilPatterns(transactions: Transaction[]): SybilReport {
    const patterns: string[] = [];
    const suspectedSybils: string[] = [];
    
    // Group transactions by user
    const userTransactions = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      const txs = userTransactions.get(tx.attesterPubkey) || [];
      txs.push(tx);
      userTransactions.set(tx.attesterPubkey, txs);
    }

    // Look for similar transaction patterns
    const users = Array.from(userTransactions.keys());
    let maxSimilarity = 0;
    let masterCandidate: string | undefined;

    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const txs1 = userTransactions.get(users[i])!;
        const txs2 = userTransactions.get(users[j])!;

        // Check timing patterns
        const timingSimilarity = this.calculateTimingSimilarity(txs1, txs2);
        
        // Check answer patterns
        const answerSimilarity = this.calculateAnswerSimilarity(txs1, txs2);
        
        const overallSimilarity = (timingSimilarity + answerSimilarity) / 2;

        if (overallSimilarity > this.SYBIL_THRESHOLD) {
          suspectedSybils.push(users[i], users[j]);
          patterns.push(`Users ${users[i]} and ${users[j]} show sybil-like behavior`);
          
          // The user with more transactions might be the master
          if (txs1.length > txs2.length) {
            masterCandidate = users[i];
          } else {
            masterCandidate = users[j];
          }
          
          maxSimilarity = Math.max(maxSimilarity, overallSimilarity);
        }
      }
    }

    // Check for sequential key generation (common in sybil attacks)
    const sequentialKeys = this.detectSequentialKeys(users);
    if (sequentialKeys.length > 0) {
      patterns.push(`Sequential key generation detected: ${sequentialKeys.join(', ')}`);
      suspectedSybils.push(...sequentialKeys);
    }

    // Remove duplicates
    const uniqueSybils = Array.from(new Set(suspectedSybils));

    return {
      detected: uniqueSybils.length > 0,
      suspectedSybils: uniqueSybils,
      masterAccount: masterCandidate,
      confidence: maxSimilarity,
      patterns
    };
  }

  /**
   * Detect gaming strategies for a specific user
   */
  detectGamingStrategies(userId: string, history: Transaction[]): StrategyReport {
    const strategies: GamingStrategy[] = [];
    const userTxs = history.filter(tx => tx.attesterPubkey === userId);
    
    if (userTxs.length < 3) {
      return {
        userId,
        strategies: [],
        riskScore: 0,
        recommendations: ['Insufficient data for pattern detection']
      };
    }

    // Check for copy-paste behavior
    if (this.detectCopyPaste(userTxs)) {
      strategies.push(GamingStrategy.COPY_PASTE);
    }

    // Check for rapid-fire answering
    if (this.detectRapidFire(userTxs)) {
      strategies.push(GamingStrategy.RAPID_FIRE);
    }

    // Check for extreme value preference
    const valuePattern = this.detectValuePattern(userTxs);
    if (valuePattern === 'extreme') {
      strategies.push(GamingStrategy.ALWAYS_EXTREME);
    } else if (valuePattern === 'middle') {
      strategies.push(GamingStrategy.ALWAYS_MIDDLE);
    }

    // Check for pattern answering
    if (this.detectPatternAnswering(userTxs)) {
      strategies.push(GamingStrategy.PATTERN_ANSWER);
    }

    // Check for time clustering
    if (this.detectTimeClustering(userTxs)) {
      strategies.push(GamingStrategy.TIME_CLUSTERING);
    }

    // Check for score manipulation
    if (this.detectScoreManipulation(userTxs)) {
      strategies.push(GamingStrategy.SCORE_MANIPULATION);
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(strategies);

    // Generate recommendations
    const recommendations = this.generateRecommendations(strategies);

    return {
      userId,
      strategies,
      riskScore,
      recommendations
    };
  }

  /**
   * Calculate similarity between two sets of attestations
   */
  private calculateSimilarity(
    atts1: QuestionAttestation[],
    atts2: QuestionAttestation[]
  ): number {
    if (atts1.length === 0 || atts2.length === 0) {
      return 0;
    }

    let matches = 0;
    let comparisons = 0;

    for (const a1 of atts1) {
      const a2 = atts2.find(a => a.questionId === a1.questionId);
      if (a2) {
        comparisons++;
        
        // Compare MCQ answers
        if (a1.type === 'MCQ' && a2.type === 'MCQ') {
          if (a1.answerHash === a2.answerHash) {
            matches++;
          }
        }
        
        // Compare FRQ scores
        if (a1.type === 'FRQ' && a2.type === 'FRQ') {
          const scoreDiff = Math.abs(a1.score! - a2.score!);
          if (scoreDiff <= 0.5) {
            matches++;
          }
        }
      }
    }

    return comparisons > 0 ? matches / comparisons : 0;
  }

  /**
   * Detect time-based collusion
   */
  private detectTimeBasedCollusion(attestations: QuestionAttestation[]): {
    detected: boolean;
    groups: string[][];
    evidence: string[];
  } {
    const groups: string[][] = [];
    const evidence: string[] = [];

    // Group by question and time window
    const questionGroups = new Map<string, QuestionAttestation[]>();
    for (const att of attestations) {
      const group = questionGroups.get(att.questionId) || [];
      group.push(att);
      questionGroups.set(att.questionId, group);
    }

    // Check each question for time clustering
    for (const [questionId, atts] of questionGroups) {
      // Sort by timestamp
      const sorted = atts.sort((a, b) => a.timestamp - b.timestamp);
      
      // Find clusters
      const clusters: QuestionAttestation[][] = [];
      let currentCluster: QuestionAttestation[] = [sorted[0]];
      
      for (let i = 1; i < sorted.length; i++) {
        const timeDiff = sorted[i].timestamp - sorted[i - 1].timestamp;
        
        if (timeDiff <= this.TIME_WINDOW_MS) {
          currentCluster.push(sorted[i]);
        } else {
          if (currentCluster.length >= 3) {
            clusters.push(currentCluster);
          }
          currentCluster = [sorted[i]];
        }
      }
      
      if (currentCluster.length >= 3) {
        clusters.push(currentCluster);
      }

      // Report clusters
      for (const cluster of clusters) {
        const users = cluster.map(a => a.userId);
        groups.push(users);
        evidence.push(`${users.length} users answered question ${questionId} within 1 minute`);
      }
    }

    return {
      detected: groups.length > 0,
      groups,
      evidence
    };
  }

  /**
   * Calculate timing similarity between transaction sets
   */
  private calculateTimingSimilarity(txs1: Transaction[], txs2: Transaction[]): number {
    if (txs1.length === 0 || txs2.length === 0) {
      return 0;
    }

    // Calculate average time between transactions
    const intervals1 = this.calculateIntervals(txs1);
    const intervals2 = this.calculateIntervals(txs2);

    if (intervals1.length === 0 || intervals2.length === 0) {
      return 0;
    }

    const avg1 = intervals1.reduce((a, b) => a + b, 0) / intervals1.length;
    const avg2 = intervals2.reduce((a, b) => a + b, 0) / intervals2.length;

    // Similar timing patterns
    const difference = Math.abs(avg1 - avg2);
    const maxAvg = Math.max(avg1, avg2);
    
    return maxAvg > 0 ? 1 - (difference / maxAvg) : 0;
  }

  /**
   * Calculate answer similarity between transaction sets
   */
  private calculateAnswerSimilarity(txs1: Transaction[], txs2: Transaction[]): number {
    const attestations1 = txs1.filter(tx => tx.txType === 'Attestation');
    const attestations2 = txs2.filter(tx => tx.txType === 'Attestation');

    if (attestations1.length === 0 || attestations2.length === 0) {
      return 0;
    }

    let matches = 0;
    let comparisons = 0;

    for (const tx1 of attestations1) {
      const data1 = tx1.data as AttestationData;
      
      for (const tx2 of attestations2) {
        const data2 = tx2.data as AttestationData;
        
        if (data1.questionId === data2.questionId) {
          comparisons++;
          
          if (data1.answerHash === data2.answerHash || 
              (data1.score && data2.score && Math.abs(data1.score - data2.score) <= 0.5)) {
            matches++;
          }
        }
      }
    }

    return comparisons > 0 ? matches / comparisons : 0;
  }

  /**
   * Detect sequential keys (common in sybil attacks)
   */
  private detectSequentialKeys(keys: string[]): string[] {
    const sequential: string[] = [];
    
    // Sort keys
    const sorted = [...keys].sort();
    
    for (let i = 1; i < sorted.length; i++) {
      // Check if keys are very similar (differ by only a few characters)
      const similarity = this.stringSimilarity(sorted[i - 1], sorted[i]);
      if (similarity > 0.95) {
        sequential.push(sorted[i - 1], sorted[i]);
      }
    }

    return Array.from(new Set(sequential));
  }

  /**
   * Calculate string similarity
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Detect copy-paste behavior
   */
  private detectCopyPaste(txs: Transaction[]): boolean {
    const frqTexts: string[] = [];
    
    for (const tx of txs) {
      if (tx.txType === 'Attestation') {
        const data = tx.data as AttestationData;
        if (data.answerText) {
          frqTexts.push(data.answerText);
        }
      }
    }

    // Check for duplicate texts
    const unique = new Set(frqTexts);
    return frqTexts.length > 2 && unique.size < frqTexts.length * 0.7;
  }

  /**
   * Detect rapid-fire answering
   */
  private detectRapidFire(txs: Transaction[]): boolean {
    if (txs.length < 3) return false;

    const sorted = [...txs].sort((a, b) => a.timestamp - b.timestamp);
    const intervals = this.calculateIntervals(sorted);
    
    // Check if average interval is less than 10 seconds
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval < 10000; // 10 seconds
  }

  /**
   * Calculate time intervals between transactions
   */
  private calculateIntervals(txs: Transaction[]): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < txs.length; i++) {
      intervals.push(txs[i].timestamp - txs[i - 1].timestamp);
    }
    
    return intervals;
  }

  /**
   * Detect value patterns (extreme or middle preference)
   */
  private detectValuePattern(txs: Transaction[]): 'extreme' | 'middle' | 'none' {
    const scores: number[] = [];
    const choices: string[] = [];

    for (const tx of txs) {
      if (tx.txType === 'Attestation') {
        const data = tx.data as AttestationData;
        if (data.score) scores.push(data.score);
        if (data.answer) choices.push(data.answer);
      }
    }

    // Check FRQ scores
    if (scores.length >= 3) {
      const extremeCount = scores.filter(s => s === 1 || s === 5).length;
      const middleCount = scores.filter(s => s >= 2.5 && s <= 3.5).length;
      
      if (extremeCount / scores.length > 0.7) return 'extreme';
      if (middleCount / scores.length > 0.7) return 'middle';
    }

    // Check MCQ choices
    if (choices.length >= 3) {
      const extremeCount = choices.filter(c => c === 'A' || c === 'E').length;
      const middleCount = choices.filter(c => c === 'C').length;
      
      if (extremeCount / choices.length > 0.7) return 'extreme';
      if (middleCount / choices.length > 0.7) return 'middle';
    }

    return 'none';
  }

  /**
   * Detect pattern answering (A,B,C,D,E,A,B...)
   */
  private detectPatternAnswering(txs: Transaction[]): boolean {
    const choices: string[] = [];

    for (const tx of txs) {
      if (tx.txType === 'Attestation') {
        const data = tx.data as AttestationData;
        if (data.answer) choices.push(data.answer);
      }
    }

    if (choices.length < 5) return false;

    // Check for repeating patterns
    for (let patternLength = 2; patternLength <= 5; patternLength++) {
      let matches = true;
      
      for (let i = patternLength; i < choices.length; i++) {
        if (choices[i] !== choices[i % patternLength]) {
          matches = false;
          break;
        }
      }
      
      if (matches) return true;
    }

    return false;
  }

  /**
   * Detect time clustering
   */
  private detectTimeClustering(txs: Transaction[]): boolean {
    if (txs.length < 3) return false;

    // Group by hour of day
    const hourCounts = new Map<number, number>();
    
    for (const tx of txs) {
      const hour = new Date(tx.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Check if all transactions are in a narrow time window
    const activeHours = Array.from(hourCounts.keys());
    const range = Math.max(...activeHours) - Math.min(...activeHours);
    
    return activeHours.length <= 3 && txs.length >= 5;
  }

  /**
   * Detect score manipulation attempts
   */
  private detectScoreManipulation(txs: Transaction[]): boolean {
    const attestations = txs.filter(tx => tx.txType === 'Attestation');
    if (attestations.length < 3) return false;

    // Check if user always disagrees with consensus
    // This would require access to consensus data
    // For now, check if answers are consistently different from others
    
    return false; // Placeholder - would need consensus data
  }

  /**
   * Calculate risk score based on detected strategies
   */
  private calculateRiskScore(strategies: GamingStrategy[]): number {
    if (strategies.length === 0) return 0;

    const weights: Record<GamingStrategy, number> = {
      [GamingStrategy.COPY_PASTE]: 30,
      [GamingStrategy.RAPID_FIRE]: 20,
      [GamingStrategy.ALWAYS_EXTREME]: 15,
      [GamingStrategy.ALWAYS_MIDDLE]: 10,
      [GamingStrategy.PATTERN_ANSWER]: 25,
      [GamingStrategy.TIME_CLUSTERING]: 15,
      [GamingStrategy.SCORE_MANIPULATION]: 40
    };

    let totalScore = 0;
    for (const strategy of strategies) {
      totalScore += weights[strategy] || 10;
    }

    return Math.min(100, totalScore);
  }

  /**
   * Generate recommendations based on detected strategies
   */
  private generateRecommendations(strategies: GamingStrategy[]): string[] {
    const recommendations: string[] = [];

    if (strategies.includes(GamingStrategy.COPY_PASTE)) {
      recommendations.push('Provide original responses, not copied content');
    }

    if (strategies.includes(GamingStrategy.RAPID_FIRE)) {
      recommendations.push('Take time to consider questions carefully');
    }

    if (strategies.includes(GamingStrategy.ALWAYS_EXTREME)) {
      recommendations.push('Consider using the full range of scoring options');
    }

    if (strategies.includes(GamingStrategy.PATTERN_ANSWER)) {
      recommendations.push('Evaluate each question independently');
    }

    if (strategies.length === 0) {
      recommendations.push('Good attestation behavior detected');
    }

    return recommendations;
  }

  /**
   * Group attestations by user
   */
  private groupByUser(attestations: QuestionAttestation[]): Map<string, QuestionAttestation[]> {
    const grouped = new Map<string, QuestionAttestation[]>();
    
    for (const att of attestations) {
      const userAtts = grouped.get(att.userId) || [];
      userAtts.push(att);
      grouped.set(att.userId, userAtts);
    }
    
    return grouped;
  }
}

// Export singleton instance
export const patternDetector = new PatternDetector();