import type { Parser, Tree, Node } from 'web-tree-sitter';
import type { LanguageAdapter, ParseResult } from './base.adapter.js';

export class GoAdapter implements LanguageAdapter {
  languageKey = 'go';
  extensions = ['go'];

  async parse(
    content: string,
    tree: Tree,
    _parserInstance: Parser,
    _filePath: string
  ): Promise<ParseResult> {
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    // Calculate LOC
    let loc = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
        loc++;
      }
    }

    let importCount = 0;
    let exportCount = 0;
    let complexity = 1;
    const dependencies: string[] = [];

    const traverse = (node: Node) => {
      // ── Imports ───────────────────────────────────────────
      if (node.type === 'import_spec') {
        importCount++;
        const pathNode = node.childForFieldName('path');
        if (pathNode) {
          const rawPath = pathNode.text.replace(/"/g, '');
          dependencies.push(rawPath);
        }
      }

      // ── Exports (Upper-case top-level definitions) ────────
      if (
        node.parent?.type === 'source_file' &&
        (node.type === 'function_declaration' ||
          node.type === 'type_declaration' ||
          node.type === 'const_declaration' ||
          node.type === 'var_declaration')
      ) {
        // Go exports are determined by capitalization of identifier
        let nameNode = node.childForFieldName('name');
        if (node.type === 'type_declaration') {
          nameNode = node.descendantsOfType('type_spec')[0]?.childForFieldName('name') || null;
        }
        if (nameNode) {
          const firstChar = nameNode.text.charAt(0);
          if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
            exportCount++;
          }
        }
      }

      // ── Complexity ────────────────────────────────────────
      if (
        node.type === 'if_statement' ||
        node.type === 'for_statement' ||
        node.type === 'expression_case_clause' ||
        node.type === 'type_case_clause' ||
        node.type === 'communication_case_clause'
      ) {
        complexity++;
      }

      if (node.type === 'binary_expression') {
        const operator = node.childForFieldName('operator')?.text;
        if (operator === '&&' || operator === '||') {
          complexity++;
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) traverse(child);
      }
    };

    traverse(tree.rootNode);

    return {
      loc,
      totalLines,
      complexity,
      exportCount,
      importCount,
      dependencies,
    };
  }
}
