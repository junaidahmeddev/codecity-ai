import path from 'path';
import type { 
  UAMSFile, 
  UAMSDirectory, 
  UAMSRepository, 
  CityLayout, 
  BuildingLayout 
} from '@codecity/shared-types';

export class LayoutService {
  /**
   * Performs Graph Normalization: Resolves raw dependency imports to target file keys,
   * populates dependents list, computes centrality scores, and generates procedural 3D layout coordinates.
   */
  computeLayout(repository: UAMSRepository): CityLayout {
    const files = repository.files;
    const fileKeys = Object.keys(files);

    // ── 1. Graph Normalization (Dependency Resolution) ──────
    // Reset all dependents list
    for (const key of fileKeys) {
      files[key]!.dependents = [];
    }

    for (const key of fileKeys) {
      const file = files[key]!;
      const resolvedDeps: string[] = [];

      for (const dep of file.dependencies) {
        const resolvedKey = this.resolveDependency(file.path, dep, fileKeys);
        if (resolvedKey && resolvedKey !== key) {
          resolvedDeps.push(resolvedKey);
          // Add back-edge (dependent)
          if (!files[resolvedKey]!.dependents.includes(key)) {
            files[resolvedKey]!.dependents.push(key);
          }
        }
      }
      file.dependencies = resolvedDeps;
    }

    // ── 2. Centrality & Glow Tier Determination ────────────
    const inDegrees = fileKeys.map(key => files[key]!.dependents.length);
    const maxInDegree = inDegrees.length > 0 ? Math.max(...inDegrees) : 0;

    // Define tiers based on relative centrality
    const buildings: BuildingLayout[] = [];
    const districtsMap: Record<string, { files: UAMSFile[]; path: string }> = {};

    // Group files by parent directory
    for (const key of fileKeys) {
      const file = files[key]!;
      const dirPath = file.directoryPath || '/';
      if (!districtsMap[dirPath]) {
        districtsMap[dirPath] = { files: [], path: dirPath };
      }
      districtsMap[dirPath].files.push(file);
    }

    // ── 3. Layout Solver: Procedural District Packing ────────
    // We position districts on a 2D grid plane. 
    // Within each district, we pack buildings in a non-overlapping grid layout.
    const districtPaths = Object.keys(districtsMap);
    const districtsLayout: Record<string, { path: string; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } }> = {};

    // First, layout buildings inside each district locally (starting at local 0,0)
    const localDistrictLayouts: Record<string, {
      placements: { file: UAMSFile; localX: number; localZ: number; w: number; d: number; h: number; glowTier: "dim" | "core" | "bright" | "peak" }[];
      width: number;
      depth: number;
    }> = {};

    for (const distPath of districtPaths) {
      const district = districtsMap[distPath]!;
      const placements: typeof localDistrictLayouts[string]['placements'] = [];

      // Sort files by LOC descending for aesthetic height staging in the center of the district
      const sortedFiles = [...district.files].sort((a, b) => b.loc - a.loc);

      // Grid layout inside the district
      const cols = Math.ceil(Math.sqrt(sortedFiles.length));
      const spacing = 4; // Spacing between buildings in a district

      let maxColWidth = 0;
      let maxRowDepth = 0;
      let currentX = 0;
      let currentZ = 0;

      const rowDepths: number[] = [];
      const colWidths: number[] = [];

      // Calculate sizes first
      const fileSizes = sortedFiles.map(file => {
        // Footprint width & depth derived from dependency weight
        const depWeight = file.dependencies.length + file.dependents.length;
        const w = Math.max(2, Math.min(8, 2 + Math.log2(depWeight + 1)));
        const d = w; // Square footprint
        // Height derived from log-scaled LOC
        const h = Math.max(1, Math.log2(file.loc + 1) * 8);

        // Compute glow tier
        const inDegree = file.dependents.length;
        let glowTier: "dim" | "core" | "bright" | "peak" = "dim";
        if (maxInDegree > 0) {
          const ratio = inDegree / maxInDegree;
          if (ratio >= 0.85) glowTier = "peak";
          else if (ratio >= 0.5) glowTier = "bright";
          else if (inDegree > 0) glowTier = "core";
        }

        return { file, w, d, h, glowTier };
      });

      // Position in grid rows
      for (let i = 0; i < fileSizes.length; i++) {
        const item = fileSizes[i]!;
        const col = i % cols;
        const row = Math.floor(i / cols);

        if (col === 0 && row > 0) {
          currentX = 0;
          currentZ += (rowDepths[row - 1] || 4) + spacing;
        }

        colWidths[col] = Math.max(colWidths[col] || 0, item.w);
        rowDepths[row] = Math.max(rowDepths[row] || 0, item.d);

        placements.push({
          file: item.file,
          localX: currentX + item.w / 2,
          localZ: currentZ + item.d / 2,
          w: item.w,
          d: item.d,
          h: item.h,
          glowTier: item.glowTier,
        });

        currentX += item.w + spacing;
      }

      const totalWidth = colWidths.reduce((sum, w) => sum + w + spacing, 0);
      const totalDepth = rowDepths.reduce((sum, d) => sum + d + spacing, 0);

      localDistrictLayouts[distPath] = {
        placements,
        width: totalWidth,
        depth: totalDepth,
      };
    }

    // Position districts on the global ground plane (concentric circle or simple grid)
    let globalX = 0;
    let globalZ = 0;
    const districtSpacing = 20; // Distance between different districts

    // Sort districts by size to place larger ones near center or logically
    const sortedDistrictPaths = [...districtPaths].sort((a, b) => {
      const sizeA = localDistrictLayouts[a]!.width * localDistrictLayouts[a]!.depth;
      const sizeB = localDistrictLayouts[b]!.width * localDistrictLayouts[b]!.depth;
      return sizeB - sizeA;
    });

    const gridCols = Math.ceil(Math.sqrt(sortedDistrictPaths.length));
    let currentRowHeight = 0;

    for (let i = 0; i < sortedDistrictPaths.length; i++) {
      const distPath = sortedDistrictPaths[i]!;
      const localLayout = localDistrictLayouts[distPath]!;
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);

      if (col === 0 && row > 0) {
        globalX = 0;
        globalZ += currentRowHeight + districtSpacing;
        currentRowHeight = 0;
      }

      currentRowHeight = Math.max(currentRowHeight, localLayout.depth);

      // Translate local coordinates to global layout
      for (const placement of localLayout.placements) {
        buildings.push({
          fileId: placement.file.id,
          position: {
            x: globalX + placement.localX,
            y: placement.h / 2, // bottom aligns to ground plane
            z: globalZ + placement.localZ,
          },
          dimensions: {
            width: placement.w,
            depth: placement.d,
            height: placement.h,
          },
          glowTier: placement.glowTier,
          geometryArchetype: placement.file.language,
          districtPath: distPath,
        });
      }

      // Record global bounds of the district
      districtsLayout[distPath] = {
        path: distPath,
        bounds: {
          minX: globalX,
          maxX: globalX + localLayout.width,
          minZ: globalZ,
          maxZ: globalZ + localLayout.depth,
        },
      };

      globalX += localLayout.width + districtSpacing;
    }

    return {
      commitSha: repository.commitSha,
      buildings,
      districts: districtsLayout,
    };
  }

  /**
   * Helper to resolve relative and modular imports against a flat checklist of repository keys.
   */
  private resolveDependency(filePath: string, importPath: string, fileKeys: string[]): string | null {
    // 1. Resolve relative import path
    if (importPath.startsWith('.') || importPath.startsWith('..')) {
      const dir = path.dirname(filePath);
      const absoluteResolved = path.posix.normalize(path.join(dir, importPath).replace(/\\/g, '/'));
      const baseResolved = absoluteResolved.replace(/\.(js|jsx|ts|tsx)$/i, '');

      // Try resolving directly or with file extension suffixes
      const candidates = [
        absoluteResolved,
        baseResolved,
        `${baseResolved}.ts`,
        `${baseResolved}.tsx`,
        `${baseResolved}.js`,
        `${baseResolved}.jsx`,
        `${baseResolved}/index.ts`,
        `${baseResolved}/index.tsx`,
        `${baseResolved}/index.js`,
      ];

      for (const candidate of candidates) {
        // Match path ignoring leading/trailing slashes
        const match = fileKeys.find(key => key.toLowerCase() === candidate.toLowerCase());
        if (match) return match;
      }
    }

    // 2. Try partial match for absolute/modular paths inside project
    const candidates = [importPath, `${importPath}.ts`, `${importPath}.js`];
    for (const candidate of candidates) {
      const match = fileKeys.find(key => key.endsWith(candidate));
      if (match) return match;
    }

    return null;
  }
}
