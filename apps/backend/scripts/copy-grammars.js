import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../../../node_modules/tree-sitter-wasms/out');
const DEST_DIR = path.resolve(__dirname, '../grammars');

const REQUIRED_LANGUAGES = [
  'c',
  'cpp',
  'go',
  'java',
  'javascript',
  'python',
  'ruby',
  'rust',
  'typescript',
  'tsx'
];

async function copyGrammars() {
  try {
    if (!fs.existsSync(DEST_DIR)) {
      fs.mkdirSync(DEST_DIR, { recursive: true });
    }

    console.log(`📂 Copying WASM grammars from ${SOURCE_DIR} to ${DEST_DIR}...`);

    for (const lang of REQUIRED_LANGUAGES) {
      const filename = `tree-sitter-${lang}.wasm`;
      const srcPath = path.join(SOURCE_DIR, filename);
      const destPath = path.join(DEST_DIR, filename);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`✅ Copied ${filename}`);
      } else {
        console.warn(`⚠️ Warning: Grammar source not found for ${lang} (${srcPath})`);
      }
    }
    console.log('🎉 All grammars copied successfully!');
  } catch (err) {
    console.error('❌ Failed to copy grammars:', err);
    process.exit(1);
  }
}

copyGrammars();
