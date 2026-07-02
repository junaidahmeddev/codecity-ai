import type { Parser, Tree } from 'web-tree-sitter';
import type { LanguageAdapter, ParseResult } from './base.adapter.js';

export class FallbackAdapter implements LanguageAdapter {
  languageKey = 'unknown';
  extensions = []; // Matcher will route manually

  async parse(
    content: string,
    _tree: Tree | null,
    _parserInstance: Parser | null,
    _filePath: string
  ): Promise<ParseResult> {
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    // Simple line-based fallback
    let loc = 0;
    for (const line of lines) {
      if (line.trim()) loc++;
    }

    return {
      loc,
      totalLines,
      complexity: 1,
      exportCount: 0,
      importCount: 0,
      dependencies: [],
    };
  }
}
