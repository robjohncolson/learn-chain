/**
 * Question Loader Service
 * Loads and indexes questions from curriculum.json
 */

import type { Question } from '../types';

class QuestionLoader {
  private questions: Map<string, Question> = new Map();
  private loaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Load questions from curriculum.json
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoad();
    await this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    try {
      const response = await fetch('./assets/curriculum.json');
      if (!response.ok) {
        throw new Error(`Failed to load curriculum: ${response.status}`);
      }

      const data = await response.json();
      
      // Index questions by ID
      if (Array.isArray(data)) {
        data.forEach((q: any) => {
          if (q.id) {
            // Transform to our Question format
            const question: Question = {
              id: q.id,
              type: q.type || 'multiple-choice',
              text: q.prompt || q.text || q.question || '',
              choices: q.choices || this.parseChoices(q),
              attachments: q.attachments || {},
              solution: q.solution,
              answerKey: q.answerKey,
              unit: q.unit,
              topic: q.topic,
              difficulty: q.difficulty
            };
            this.questions.set(q.id, question);
          }
        });
      }

      this.loaded = true;
      console.log(`Loaded ${this.questions.size} questions from curriculum`);
    } catch (error) {
      console.error('Error loading curriculum:', error);
      throw error;
    }
  }

  /**
   * Parse choices from different formats
   */
  private parseChoices(question: any): any[] {
    // If choices are explicitly provided
    if (question.choices) return question.choices;
    
    // For MCQ, generate from answerKey pattern
    if (question.type === 'multiple-choice' && question.answerKey) {
      // Default MCQ choices if not provided
      return [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
        { id: 'C', text: 'Option C' },
        { id: 'D', text: 'Option D' },
        { id: 'E', text: 'Option E' }
      ];
    }

    return [];
  }

  /**
   * Get a question by ID
   */
  async getQuestion(questionId: string): Promise<Question | null> {
    await this.load();
    return this.questions.get(questionId) || null;
  }

  /**
   * Get questions by unit and topic
   */
  async getQuestionsByTopic(unitId: string, topicId: string): Promise<Question[]> {
    await this.load();
    const questions: Question[] = [];
    
    this.questions.forEach((q) => {
      // Match by unit/topic pattern in ID (e.g., U1-L2-Q01)
      if (q.id.startsWith(`${unitId}-${topicId}`)) {
        questions.push(q);
      }
    });

    return questions;
  }

  /**
   * Get all questions
   */
  async getAllQuestions(): Promise<Question[]> {
    await this.load();
    return Array.from(this.questions.values());
  }

  /**
   * Get question count
   */
  async getQuestionCount(): Promise<number> {
    await this.load();
    return this.questions.size;
  }
}

// Export singleton instance
export const questionLoader = new QuestionLoader();