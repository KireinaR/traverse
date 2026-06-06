import { useApp } from '../../context/AppContext';
import { SpeedMultiplier } from '../../types';

const SPEED_STEPS: SpeedMultiplier[] = [0.25, 0.5, 1, 2, 4, 'instant'];
const SPEED_IDX: Record<string, number> = { '0.25': 0, '0.5': 1, '1': 2, '2': 3, '4': 4, 'instant': 5 };
const SPEED_LABELS: Record<string, string> = { '0.25': '¼×', '0.5': '½×', '1': '1×', '2': '2×', '4': '4×', 'instant': '⚡' };

export default function BottomBar() {
  const { state, dispatch } = useApp();
  const { playback, speed, result, compareResults } = state;

  const isActive   = playback === 'running' || playback === 'paused' || playback === 'done';
  const canScrub   = (playback === 'paused' || playback === 'done') && !!result && !compareResults;
  const showCompare = !!compareResults;

  if (!isActive && !showCompare) return null;

  const ctrl = () => (window as any).__vizControls ?? {};
  const controls = {
    pause:  () => ctrl().pause?.(),
    resume: () => ctrl().resume?.(),
    stop:   () => ctrl().stop?.(),
    reset:  () => ctrl().reset?.(),
  };

  const currentSpeedIdx = SPEED_IDX[String(speed)] ?? 2;
  const totalSteps      = result?.steps.length ?? 0;
  const scrubUnit       = Math.max(1, Math.floor(totalSteps / 100));

  const handleSpeedSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_SPEED', speed: SPEED_STEPS[parseInt(e.target.value)] });
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value);
    ctrl().scrubStep?.(n);
  };

  const stepBack = () => {
    const n = Math.max(0, state.currentStep - scrubUnit);
    ctrl().scrubStep?.(n);
  };

  const stepFwd = () => {
    const n = Math.min(totalSteps, state.currentStep + scrubUnit);
    ctrl().scrubStep?.(n);
  };

  return (
    <div className="bottom-bar">
      {isActive && (
        <div className="bb-controls">
          {playback === 'running' && (
            <button className="bb-btn" onClick={controls.pause} title="Pause">
              <PauseIcon /> Pause
            </button>
          )}
          {playback === 'paused' && (
            <button className="bb-btn primary" onClick={controls.resume} title="Resume">
              <PlayIcon /> Resume
            </button>
          )}
          {(playback === 'running' || playback === 'paused') && (
            <button className="bb-btn" onClick={controls.stop} title="Stop">
              <StopIcon /> Stop
            </button>
          )}
          <button className="bb-btn" onClick={controls.reset} title="Reset">
            <ResetIcon /> Reset
          </button>

          <div className="bb-sep" />

          {/* Scrubbing controls — shown when paused or done (single algo only) */}
          {canScrub ? (
            <div className="bb-scrub">
              <button className="bb-step-btn" onClick={stepBack} title="Step back">
                <StepBackIcon />
              </button>
              <input
                type="range"
                min={0}
                max={totalSteps}
                step={1}
                value={state.currentStep}
                onChange={handleScrub}
                className="bb-scrub-slider"
                title={`Step ${state.currentStep} / ${totalSteps}`}
              />
              <button className="bb-step-btn" onClick={stepFwd} title="Step forward">
                <StepFwdIcon />
              </button>
              <span className="bb-step-count">{state.currentStep} / {totalSteps}</span>
            </div>
          ) : (
            <div className="bb-status">
              <span className={`bb-dot ${playback}`} />
              {playback === 'running' && (compareResults ? 'Comparing…' : `Step ${state.currentStep}${result ? ` / ${result.steps.length}` : ''}`)}
              {playback === 'paused'  && 'Paused'}
              {playback === 'done'    && (compareResults ? 'Comparison done' : (result ? `Done — ${result.nodesExplored.toLocaleString()} nodes` : 'Done'))}
            </div>
          )}

          <div className="bb-sep" />

          {/* Speed */}
          <div className="bb-speed">
            <SpeedIcon />
            <input
              type="range"
              min={0}
              max={SPEED_STEPS.length - 1}
              step={1}
              value={currentSpeedIdx}
              onChange={handleSpeedSlider}
              className="bb-slider"
              title={`Speed: ${SPEED_LABELS[String(speed)]}`}
            />
            <span className="bb-speed-label">{SPEED_LABELS[String(speed)]}</span>
          </div>
        </div>
      )}

      {showCompare && !isActive && (
        <div className="bb-compare-summary">
          <CompareIcon />
          <span className="bb-compare-label">Compare results in Info panel</span>
          <button className="bb-btn" onClick={() => {
            dispatch({ type: 'SET_COMPARE_MODE', enabled: false });
            dispatch({ type: 'RESET' });
          }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

const PlayIcon     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>;
const PauseIcon    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const StopIcon     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16"/></svg>;
const StepBackIcon = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="6" x2="9" y2="18"/></svg>;
const StepFwdIcon  = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/><line x1="15" y1="6" x2="15" y2="18"/></svg>;
const ResetIcon    = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
  </svg>
);
const SpeedIcon    = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity=".6">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);
const CompareIcon  = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
