import { SpeedMultiplier } from '../../types';
import { useApp } from '../../context/AppContext';

const SPEEDS: SpeedMultiplier[] = [0.25, 0.5, 1, 2, 4, 'instant'];
const SPEED_LABELS: Record<string, string> = {
  '0.25': '¼×', '0.5': '½×', '1': '1×', '2': '2×', '4': '4×', 'instant': '⚡',
};

export default function SpeedControl() {
  const { state, dispatch } = useApp();
  const { speed } = state;

  return (
    <div className="speed-control">
      <label className="label-sm">Speed</label>
      <div className="speed-pills">
        {SPEEDS.map((s) => (
          <button
            key={String(s)}
            className={`speed-pill ${speed === s ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_SPEED', speed: s })}
            title={s === 'instant' ? 'Instant — skip animation' : `${s}× speed`}
          >
            {SPEED_LABELS[String(s)]}
          </button>
        ))}
      </div>
    </div>
  );
}
