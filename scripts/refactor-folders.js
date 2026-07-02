import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const moves = [
  { from: 'packages/shared', to: 'packages/shared-types' },
  { from: 'apps/backend', to: 'apps/server' },
  { from: 'apps/frontend', to: 'apps/web' },
];

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function refactor() {
  console.log('🏁 Starting monorepo directory migration...');
  for (const move of moves) {
    const srcPath = path.join(rootDir, move.from);
    const destPath = path.join(rootDir, move.to);

    if (fs.existsSync(srcPath)) {
      console.log(`🚚 Copying: ${move.from} ➔ ${move.to}`);
      copyRecursiveSync(srcPath, destPath);
      
      console.log(`🧹 Deleting old folder: ${move.from}`);
      try {
        fs.rmSync(srcPath, { recursive: true, force: true });
        console.log(`✅ Success: Migrated ${move.from}`);
      } catch (err) {
        console.warn(`⚠️ Warning: Could not delete ${move.from} directly (locked). Scheduling retry...`);
        // Retry delete with short delay
        setTimeout(() => {
          try {
            fs.rmSync(srcPath, { recursive: true, force: true });
            console.log(`✅ Success (delayed delete): ${move.from}`);
          } catch (e) {
            console.error(`❌ Failed to delete ${move.from}. Please delete it manually later.`);
          }
        }, 1000);
      }
    } else {
      console.log(`ℹ️ Skip: Source ${move.from} does not exist`);
    }
  }
  console.log('🎉 Migration completed!');
}

refactor();
