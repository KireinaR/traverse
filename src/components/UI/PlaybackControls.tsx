import { useApp } from '../../context/AppContext';

interface Props {
  onVisualize: () => void;
  onCompare: () => void;
}

export default function PlaybackControls({ onVisualize, onCompare }: Props) {
  const { state } = useApp();
  const { playback, startPoint, endPoint, graphLoading, compareMode, result } = state;
  const controls = (window as any).__vizControls ?? {};

  const canVisualize = startPoint && endPoint && !graphLoading;
  const isRunning = playback === 'running';
  const isPaused = playback === 'paused';
  const isDone = playback === 'done';
  const isActive = isRunning || isPaused || isDone;

  return (
    <div className="playback-controls">
      {!isActive && (
        <>
          <button
            className="btn btn-primary"
            onClick={onVisualize}
            disabled={!canVisualize}
            title={!canVisualize ? 'Select start and destination first' : 'Run visualization'}
          >
            {graphLoading ? (
              <><span className="spinner-sm" /> Loading map…</>
            ) : (
              <><PlayIcon /> Visualize</>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onCompare}
            disabled={!canVisualize}
            title="Compare Dijkstra vs A*"
          >
            <CompareIcon /> Compare
          </button>
        </>
      )}

      {isActive && (
        <div className="playback-row">
          {isRunning && (
            <button className="btn btn-sm" onClick={controls.pause} title="Pause">
              <PauseIcon />
            </button>
          )}
          {isPaused && (
            <button className="btn btn-sm btn-primary" onClick={controls.resume} title="Resume">
              <PlayIcon />
            </button>
          )}
          {(isRunning || isPaused) && (
            <button className="btn btn-sm" onClick={controls.stop} title="Stop">
              <StopIcon />
            </button>
          )}
          <button className="btn btn-sm" onClick={controls.reset} title="Reset">
            <ResetIcon />
          </button>
          <span className="playback-status">
            {isRunning && <><span className="status-dot running" /> Running</>}
            {isPaused && <><span className="status-dot paused" /> Paused</>}
            {isDone && <><span className="status-dot done" /> Done</>}
          </span>
        </div>
      )}
    </div>
  );
}

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
  </svg>
);
const StopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" />
  </svg>
);
const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
const CompareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
