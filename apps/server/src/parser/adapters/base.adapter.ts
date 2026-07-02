import type { Parser, Tree } from 'web-tree-sitter';

export interface ParseResult {
  loc: number;
  totalLines: number;
  complexity: number;
  exportCount: number;
  importCount: number;
  dependencies: string[];
}

export interface LanguageAdapter {
  languageKey: string;
  extensions: string[];
  
  /**
   * Parses the file content using tree-sitter AST queries
   * to extract imports, exports, complexity, and dependencies.
   */
  parse(
    content: string,
    tree: Tree,
    parserInstance: Parser,
    filePath: string
  ): Promise<ParseResult>;
}
