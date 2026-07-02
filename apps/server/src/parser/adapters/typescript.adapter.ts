import path from 'path';
import type { Parser, Tree, Node } from 'web-tree-sitter';
import type { LanguageAdapter, ParseResult } from './base.adapter.js';

export class TypeScriptAdapter implements LanguageAdapter {
  languageKey = 'typescript';
  extensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];

  async parse(
    content: string,
    tree: Tree,
    _parserInstance: Parser,
    filePath: string
  ): Promise<ParseResult> {
    const lines = content.split(/\r?\n/);
    const totalLines = lines.length;
    
    // Calculate LOC (excluding blanks and comments)
    let loc = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
        loc++;
      }
    }

    let importCount = 0;
    let exportCount = 0;
    let complexity = 1; // Base complexity
    const dependencies: string[] = [];

    // Helper to resolve relative imports to relative paths from repo root
    const resolveDependency = (importPath: string) => {
      if (importPath.startsWith('.') || importPath.startsWith('..')) {
        const dir = path.dirname(filePath);
        // Normalize path
        const resolved = path.join(dir, importPath)
          .replace(/\\/g, '/')
          // Strip extension if present or let it match original extension during graph normalization
          .replace(/\.(ts|tsx|js|jsx)$/, '');
        return resolved;
      }
      return importPath; // Exclude non-relative npm deps or handle them differently
    };

    // Traverse AST tree recursively
    const traverse = (node: Node) => {
      // ── Imports ───────────────────────────────────────────
      if (
        node.type === 'import_statement' ||
        node.type === 'import_require_declarator'
      ) {
        importCount++;
        // Find string literal in import statement
        const sourceNode = node.childForFieldName('source') || node.descendantsOfType('string_literal')[0];
        if (sourceNode) {
          const rawPath = sourceNode.text.replace(/['"]/g, '');
          const resolved = resolveDependency(rawPath);
          if (resolved.startsWith('.') || resolved.includes('/')) {
            dependencies.push(resolved);
          }
        }
      }

      // Dynamic import()
      if (node.type === 'call_expression') {
        const functionNode = node.childForFieldName('function');
        if (functionNode && functionNode.type === 'import') {
          importCount++;
          const argNode = node.childForFieldName('arguments')?.firstNamedChild;
          if (argNode && argNode.type === 'string_literal') {
            const rawPath = argNode.text.replace(/['"]/g, '');
            const resolved = resolveDependency(rawPath);
            dependencies.push(resolved);
          }
        }
      }

      // ── Exports ───────────────────────────────────────────
      if (
        node.type === 'export_statement' ||
        node.type === 'export_assignment' ||
        node.type === 'export_declaration'
      ) {
        exportCount++;
      }

      // ── Complexity ────────────────────────────────────────
      // Cyclomatic complexity estimator (decisions)
      if (
        node.type === 'if_statement' ||
        node.type === 'for_statement' ||
        node.type === 'for_in_statement' ||
        node.type === 'while_statement' ||
        node.type === 'do_statement' ||
        node.type === 'catch_clause' ||
        node.type === 'conditional_expression' // Ternary
      ) {
        complexity++;
      }

      // Logical operators in binary expressions increase decisions
      if (node.type === 'binary_expression') {
        const operator = node.childForFieldName('operator')?.text;
        if (operator === '&&' || operator === '||' || operator === '??') {
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
