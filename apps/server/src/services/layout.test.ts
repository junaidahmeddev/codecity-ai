import { describe, it, expect } from 'vitest';
import { LayoutService } from './layout.service.js';
import type { UAMSRepository } from '@codecity/shared-types';

describe('LayoutService', () => {
  const service = new LayoutService();

  const mockRepository: UAMSRepository = {
    name: 'test/repo',
    url: 'https://github.com/test/repo.git',
    commitSha: 'a'.repeat(40),
    parsedAt: new Date().toISOString(),
    files: {
      'src/main.ts': {
        id: 'src/main.ts',
        path: 'src/main.ts',
        name: 'main.ts',
        extension: 'ts',
        language: 'typescript',
        loc: 100,
        totalLines: 120,
        complexity: 1.5,
        exportCount: 1,
        importCount: 1,
        dependencies: ['./utils/math.js'], // Unresolved dependency
        dependents: [],
        directoryPath: 'src'
      },
      'src/utils/math.ts': {
        id: 'src/utils/math.ts',
        path: 'src/utils/math.ts',
        name: 'math.ts',
        extension: 'ts',
        language: 'typescript',
        loc: 50,
        totalLines: 60,
        complexity: 0.5,
        exportCount: 2,
        importCount: 0,
        dependencies: [],
        dependents: [],
        directoryPath: 'src/utils'
      }
    },
    directories: {
      'src': {
        path: 'src',
        name: 'src',
        fileIds: ['src/main.ts'],
        childDirectoryPaths: ['src/utils'],
        totalLoc: 100,
        totalFileCount: 1
      },
      'src/utils': {
        path: 'src/utils',
        name: 'utils',
        fileIds: ['src/utils/math.ts'],
        childDirectoryPaths: [],
        totalLoc: 50,
        totalFileCount: 1
      }
    },
    stats: {
      totalFiles: 2,
      totalLoc: 150,
      totalDirectories: 2,
      languageBreakdown: {
        typescript: 2,
        javascript: 0,
        python: 0,
        go: 0,
        c: 0,
        cpp: 0,
        rust: 0,
        java: 0,
        ruby: 0,
        unknown: 0
      }
    }
  };

  it('should normalize dependencies and populate dependents back-edges', () => {
    const layout = service.computeLayout(mockRepository);

    // main.ts should have resolved its dependency to math.ts
    const mainFile = mockRepository.files['src/main.ts']!;
    expect(mainFile.dependencies).toContain('src/utils/math.ts');

    // math.ts should have main.ts as a dependent
    const mathFile = mockRepository.files['src/utils/math.ts']!;
    expect(mathFile.dependents).toContain('src/main.ts');
  });

  it('should compute non-overlapping building coordinates and bounds', () => {
    const layout = service.computeLayout(mockRepository);

    expect(layout.commitSha).toBe(mockRepository.commitSha);
    expect(layout.buildings.length).toBe(2);

    // Bounding boxes should be defined for districts
    expect(layout.districts['src']).toBeDefined();
    expect(layout.districts['src/utils']).toBeDefined();

    const mainBuilding = layout.buildings.find(b => b.fileId === 'src/main.ts')!;
    const mathBuilding = layout.buildings.find(b => b.fileId === 'src/utils/math.ts')!;

    // Height of main.ts building should be larger than math.ts due to more LOC
    expect(mainBuilding.dimensions.height).toBeGreaterThan(mathBuilding.dimensions.height);

    // Main should have a higher glowTier due to dependents/centrality (in-degree)
    expect(mainBuilding.glowTier).toBe('dim');
    expect(mathBuilding.glowTier).toBe('peak'); // max in-degree ratio is 1.0 (highest)
  });
});
