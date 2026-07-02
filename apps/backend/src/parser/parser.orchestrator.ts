import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ParserClass from 'web-tree-sitter';
import type { Parser as ParserType, Tree, Language } from 'web-tree-sitter';
import { loadConfig } from '@codecity/shared';
import type { LanguageAdapter, ParseResult } from './adapters/base.adapter.js';
import { TypeScriptAdapter } from './adapters/typescript.adapter.js';
import { PythonAdapter } from './adapters/python.adapter.js';
import { GoAdapter } from './adapters/go.adapter.js';
import { FallbackAdapter } from './adapters/fallback.adapter.js';

const Parser = ParserClass as any;
const config = loadConfig();

export class ParserOrchestrator {
  private initialized = false;
  private grammarsDir: string;
  private adapters: Map<string, LanguageAdapter> = new Map();
  private extMap: Map<string, LanguageAdapter> = new Map();
  private languageCache: Map<string, Language> = new Map();
  private fallbackAdapter = new FallbackAdapter();

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.grammarsDir = path.resolve(__dirname, '../../grammars');

    // Register adapters
    this.registerAdapter(new TypeScriptAdapter());
    this.registerAdapter(new PythonAdapter());
    this.registerAdapter(new GoAdapter());
  }

  private registerAdapter(adapter: LanguageAdapter) {
    this.adapters.set(adapter.languageKey, adapter);
    for (const ext of adapter.extensions) {
      this.extMap.set(ext, adapter);
    }
  }

  /**
   * Initializes tree-sitter. Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await Parser.init();
    this.initialized = true;
  }

  /**
   * Map file extension to UAMS SupportedLanguage string
   */
  getLanguageKey(ext: string): string {
    const adapter = this.extMap.get(ext);
    return adapter ? adapter.languageKey : 'unknown';
  }

  /**
   * Lazy load tree-sitter WASM grammars from local files.
   */
  private async getLanguage(langKey: string): Promise<Language | null> {
    if (this.languageCache.has(langKey)) {
      return this.languageCache.get(langKey) || null;
    }

    const wasmPath = path.join(this.grammarsDir, `tree-sitter-${langKey}.wasm`);
    if (!fs.existsSync(wasmPath)) {
      return null;
    }

    try {
      const lang = await Parser.Language.load(wasmPath);
      this.languageCache.set(langKey, lang);
      return lang;
    } catch (err) {
      console.error(`Failed to load tree-sitter grammar for ${langKey}:`, err);
      return null;
    }
  }

  /**
   * Parses file content with absolute execution timeout (Section 3, Contract 4).
   */
  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    await this.init();

    const ext = path.extname(filePath).slice(1).toLowerCase();
    const adapter = this.extMap.get(ext) || this.fallbackAdapter;
    const langKey = adapter.languageKey;

    let tree: Tree | null = null;
    const parserInstance = new Parser();

    if (langKey !== 'unknown') {
      const lang = await this.getLanguage(langKey);
      if (lang) {
        parserInstance.setLanguage(lang);
      }
    }

    // Wrap execution with safety timeout
    const parsePromise = async (): Promise<ParseResult> => {
      try {
        if (langKey !== 'unknown' && parserInstance.getLanguage()) {
          tree = parserInstance.parse(content);
        }
        return await adapter.parse(content, tree!, parserInstance as ParserType, filePath);
      } finally {
        if (tree) tree.delete();
      }
    };

    return Promise.race([
      parsePromise(),
      new Promise<ParseResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Parse timeout exceeded for file: ${filePath}`)),
          config.guardrails.parseTimeoutPerFileMs
        )
      ),
    ]);
  }
}
