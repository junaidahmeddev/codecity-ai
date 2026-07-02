import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Creates a sharp sheared/chiseled glass skyscraper geometry for JS/TS.
 */
export function createTypeScriptGeometry(): THREE.BufferGeometry {
  // Base tower
  const baseGeo = new THREE.BoxGeometry(1, 0.8, 1);
  baseGeo.translate(0, 0.4, 0);

  // Sheared chiseled top roof shape
  const topGeo = new THREE.ConeGeometry(0.5, 0.2, 4);
  topGeo.rotateY(Math.PI / 4);
  topGeo.translate(0, 0.9, 0);

  const merged = BufferGeometryUtils.mergeGeometries([baseGeo, topGeo]);
  baseGeo.dispose();
  topGeo.dispose();
  return merged;
}

/**
 * Creates stacked setbacks (tiered steps) geometry for Python.
 */
export function createPythonGeometry(): THREE.BufferGeometry {
  // Tier 1 (bottom)
  const tier1 = new THREE.BoxGeometry(1, 0.4, 1);
  tier1.translate(0, 0.2, 0);

  // Tier 2 (middle)
  const tier2 = new THREE.BoxGeometry(0.75, 0.3, 0.75);
  tier2.translate(0, 0.55, 0);

  // Tier 3 (top)
  const tier3 = new THREE.BoxGeometry(0.5, 0.3, 0.5);
  tier3.translate(0, 0.85, 0);

  const merged = BufferGeometryUtils.mergeGeometries([tier1, tier2, tier3]);
  tier1.dispose();
  tier2.dispose();
  tier3.dispose();
  return merged;
}

/**
 * Creates a clean rectangular chiseled monolith geometry for Go.
 */
export function createGoGeometry(): THREE.BufferGeometry {
  const monolith = new THREE.BoxGeometry(1, 1, 1);
  monolith.translate(0, 0.5, 0);
  return monolith;
}

/**
 * Creates a hexagonal industrial lattice column for C/C++.
 */
export function createCppGeometry(): THREE.BufferGeometry {
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
  cylinder.translate(0, 0.5, 0);
  return cylinder;
}

/**
 * Creates a standard chiseled box geometry for Fallback/Unknown.
 */
export function createFallbackGeometry(): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  return box;
}
