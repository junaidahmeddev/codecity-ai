import { EffectComposer, Bloom, Scanline, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostProcessingProps {
  bloomIntensity: number;
}

export function PostProcessing({ bloomIntensity }: PostProcessingProps) {
  return (
    <EffectComposer>
      <Bloom
        luminanceThreshold={0.01}
        luminanceSmoothing={0.9}
        intensity={bloomIntensity}
        mipmapBlur
      />
      <Scanline
        blendFunction={BlendFunction.OVERLAY}
        density={2.5}
        opacity={0.12}
      />
      <Vignette
        eskil={false}
        offset={0.4}
        darkness={0.7}
      />
    </EffectComposer>
  );
}
