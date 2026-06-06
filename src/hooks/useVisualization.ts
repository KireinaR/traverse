// The animation loop now lives entirely in MapView (canvas + rAF).
// This hook just re-exports the controls that MapView registers on window.__vizControls,
// so callers don't need to reference window directly.

export function useVisualization() {
  const controls = () => (window as any).__vizControls ?? {};

  return {
    pause:  () => controls().pause?.(),
    resume: () => controls().resume?.(),
    stop:   () => controls().stop?.(),
    reset:  () => controls().reset?.(),
  };
}
