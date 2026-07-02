import { create } from 'zustand';
import type { CityLayout, UAMSRepository } from '@codecity/shared-types';

interface StoreState {
  repository: UAMSRepository | null;
  layout: CityLayout | null;
  hoveredBuildingId: string | null;
  selectedBuildingId: string | null;
  cameraTarget: [number, number, number] | null;
  cameraPosition: [number, number, number] | null;
  currentBreadcrumb: string[];
  
  // Settings / Controls
  isFlyMode: boolean;
  highContrastMode: boolean;
  bloomOverride: number;
  lodOverride: number;
  introPlaying: boolean;
  
  // AI Insights Overlay
  insights: { fileId: string; type: 'warning' | 'info'; message: string }[] | null;
  showInsights: boolean;

  // Actions
  setMetropolisData: (repo: UAMSRepository, layout: CityLayout) => void;
  setHoveredBuildingId: (id: string | null) => void;
  setSelectedBuildingId: (id: string | null) => void;
  setCameraTarget: (target: [number, number, number] | null, position?: [number, number, number] | null) => void;
  setFlyMode: (active: boolean) => void;
  setHighContrastMode: (active: boolean) => void;
  setBloomOverride: (intensity: number) => void;
  setLodOverride: (distance: number) => void;
  setIntroPlaying: (playing: boolean) => void;
  setInsights: (insights: { fileId: string; type: 'warning' | 'info'; message: string }[] | null) => void;
  setShowInsights: (show: boolean) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set) => ({
  repository: null,
  layout: null,
  hoveredBuildingId: null,
  selectedBuildingId: null,
  cameraTarget: null,
  cameraPosition: null,
  currentBreadcrumb: [],
  isFlyMode: false,
  highContrastMode: false,
  bloomOverride: 1.6,
  lodOverride: 150,
  introPlaying: false,
  insights: null,
  showInsights: false,

  setMetropolisData: (repo, layout) => {
    set({
      repository: repo,
      layout,
      introPlaying: true,
      currentBreadcrumb: [repo.name],
    });
  },

  setHoveredBuildingId: (id) => {
    set((state) => {
      if (!id) return { hoveredBuildingId: null };
      const building = state.layout?.buildings.find((b) => b.fileId === id);
      if (!building) return { hoveredBuildingId: null };

      // Update breadcrumb to follow the active file's parent directory split
      const parts = building.fileId.split('/');
      const breadcrumbs = state.repository ? [state.repository.name, ...parts] : parts;

      return {
        hoveredBuildingId: id,
        currentBreadcrumb: breadcrumbs,
      };
    });
  },

  setSelectedBuildingId: (id) => {
    set((state) => {
      if (!id) return { selectedBuildingId: null };
      const building = state.layout?.buildings.find((b) => b.fileId === id);
      if (!building) return { selectedBuildingId: null };

      const parts = building.fileId.split('/');
      const breadcrumbs = state.repository ? [state.repository.name, ...parts] : parts;

      return {
        selectedBuildingId: id,
        currentBreadcrumb: breadcrumbs,
      };
    });
  },

  setCameraTarget: (target, position = null) => {
    set({ cameraTarget: target, cameraPosition: position });
  },

  setFlyMode: (active) => set({ isFlyMode: active }),
  setHighContrastMode: (active) => {
    if (active) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    set({ highContrastMode: active });
  },
  setBloomOverride: (intensity) => set({ bloomOverride: intensity }),
  setLodOverride: (distance) => set({ lodOverride: distance }),
  setIntroPlaying: (playing) => set({ introPlaying: playing }),
  setInsights: (insights) => set({ insights }),
  setShowInsights: (show) => set({ showInsights: show }),

  reset: () =>
    set({
      repository: null,
      layout: null,
      hoveredBuildingId: null,
      selectedBuildingId: null,
      cameraTarget: null,
      cameraPosition: null,
      currentBreadcrumb: [],
      introPlaying: false,
      insights: null,
      showInsights: false,
    }),
}));
