import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store/useStore.js';
import gsap from 'gsap';

export function CameraRig() {
  const { camera } = useThree();
  const cameraTarget = useStore((state) => state.cameraTarget);
  const cameraPosition = useStore((state) => state.cameraPosition);
  const introPlaying = useStore((state) => state.introPlaying);
  const setIntroPlaying = useStore((state) => state.setIntroPlaying);

  const tweenRef = useRef<gsap.core.Timeline | null>(null);

  // Scripted Intro Sequence (Section 4, Requirement 6)
  useEffect(() => {
    if (introPlaying) {
      // Kill any active transitions
      if (tweenRef.current) tweenRef.current.kill();

      // Configure start position (low street-level entry point)
      camera.position.set(0, 5, 250);
      
      const tl = gsap.timeline({
        onComplete: () => {
          setIntroPlaying(false);
        }
      });

      tweenRef.current = tl;

      // 1. Street-level flyover down the main avenue
      tl.to(camera.position, {
        x: 0,
        y: 10,
        z: 40,
        duration: 3,
        ease: 'power2.inOut',
      });

      // 2. Rise up into the high-angle isometric city layout view
      tl.to(camera.position, {
        x: 100,
        y: 80,
        z: 150,
        duration: 2.5,
        ease: 'power1.out',
      });
    }
  }, [introPlaying, camera, setIntroPlaying]);

  // Handle Zustand-triggered camera transitions (e.g. search click selection)
  useEffect(() => {
    if (!introPlaying && cameraTarget) {
      if (tweenRef.current) tweenRef.current.kill();

      const tl = gsap.timeline();
      tweenRef.current = tl;

      // Calculate an offset position relative to the target building coordinates
      const targetPos = cameraPosition || [
        cameraTarget[0] + 40,
        cameraTarget[1] + 30,
        cameraTarget[2] + 40,
      ];

      // Smoothly pan camera to target position
      tl.to(camera.position, {
        x: targetPos[0],
        y: targetPos[1],
        z: targetPos[2],
        duration: 1.5,
        ease: 'power2.out',
      });
    }
  }, [cameraTarget, cameraPosition, introPlaying, camera]);

  return null;
}
