import path from 'path';
import type { Parser, Tree, Node } from 'web-tree-sitter';
import type { LanguageAdapter, ParseResult } from './base.adapter.js';

export class PythonAdapter implements LanguageAdapter {
  languageKey = 'python';
  extensions = ['py'];

  async parse(
    content: string,
    tree: Tree,
    _parserInstance: Parser,
    filePath: string
  ): Promise<ParseResult> {
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;

    // Calculate LOC
    let loc = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('"""') && !trimmed.startsWith("'''")) {
        loc++;
      }
    }

    let importCount = 0;
    let exportCount = 0;
    let complexity = 1;
    const dependencies: string[] = [];

    // Helper to resolve Python imports
    // e.g. from .utils import foo -> resolved relative to current directory
    const resolvePythonImport = (moduleName: string, level = 0) => {
      let resolved = moduleName.replace(/\./g, '/');
      if (level > 0) {
        const dir = path.dirname(filePath);
        // Step up directory based on import dot level (e.g. . = level 1, .. = level 2)
        let baseDir = dir;
        for (let i = 1; i < level; i++) {
          baseDir = path.dirname(baseDir);
        }
        resolved = path.join(baseDir, resolved).replace(/\\/g, '/');
      }
      return resolved;
    };

    const traverse = (node: Node) => {
      // ── Imports ───────────────────────────────────────────
      if (node.type === 'import_statement') {
        importCount++;
        // import foo, bar
        const names = node.descendantsOfType('dotted_name');
        for (const nameNode of names) {
          dependencies.push(resolvePythonImport(nameNode.text));
        }
      }

      if (node.type === 'import_from_statement') {
        importCount++;
        // from .foo import bar
        const dotNodes = node.descendantsOfType('relative_import');
        let level = 0;
        if (dotNodes.length > 0) {
          // Count dot count prefixing the import
          const match = dotNodes[0]?.text.match(/^\.+/);
          if (match) level = match[0].length;
        }

        const nameNode = node.childForFieldName('module');
        if (nameNode) {
          dependencies.push(resolvePythonImport(nameNode.text, level));
        }
      }

      // ── Exports (Functions, classes, top-level vars) ──────
      if (
        node.parent?.type === 'module' && // Must be top-level
        (node.type === 'function_definition' || node.type === 'class_definition')
      ) {
        const nameNode = node.childForFieldName('name');
        if (nameNode && !nameNode.text.startsWith('_')) {
          exportCount++;
        }
      }

      // ── Complexity ────────────────────────────────────────
      if (
        node.type === 'if_statement' ||
        node.type === 'for_statement' ||
        node.type === 'while_statement' ||
        node.type === 'except_clause' ||
        node.type === 'conditional_expression'
      ) {
        complexity++;
      }

      if (node.type === 'boolean_operator') {
        complexity++;
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
