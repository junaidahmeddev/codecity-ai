import { describe, it, expect } from 'vitest';
import { SupportedLanguageSchema, UAMSFileSchema } from './index.js';

describe('UAMS Schema Validators', () => {
  it('should validate supported languages correctly', () => {
    const validLangs = ['typescript', 'javascript', 'python', 'go', 'unknown'];
    validLangs.forEach((lang) => {
      expect(SupportedLanguageSchema.safeParse(lang).success).toBe(true);
    });

    const invalidLangs = ['php', 'c#', 'swift', 'kotlin']; // languages not in the schema
    invalidLangs.forEach((lang) => {
      expect(SupportedLanguageSchema.safeParse(lang).success).toBe(false);
    });
  });

  it('should validate correct UAMS file structures', () => {
    const validFile = {
      id: 'src/main.ts',
      path: 'src/main.ts',
      name: 'main.ts',
      extension: 'ts',
      language: 'typescript',
      loc: 120,
      totalLines: 150,
      complexity: 2.5,
      exportCount: 2,
      importCount: 3,
      dependencies: ['fs', 'path'],
      dependents: [],
      directoryPath: 'src'
    };
    expect(UAMSFileSchema.safeParse(validFile).success).toBe(true);
  });
});
