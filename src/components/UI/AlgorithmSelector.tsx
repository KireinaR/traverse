import { AlgorithmId } from '../../types';
import { ALGORITHM_LIST } from '../../lib/algorithmMeta';
import { useApp } from '../../context/AppContext';

export default function AlgorithmSelector() {
  const { state, dispatch } = useApp();
  const { selectedAlgorithm, compareMode } = state;

  return (
    <div className="algo-selector">
      <label className="label-sm">Algorithm</label>
      <div className="algo-tabs">
        {ALGORITHM_LIST.map((algo) => (
          <button
            key={algo.id}
            className={`algo-tab ${selectedAlgorithm === algo.id && !compareMode ? 'active' : ''}`}
            style={
              selectedAlgorithm === algo.id && !compareMode
                ? { borderColor: algo.color, background: algo.color + '18', color: algo.color }
                : {}
            }
            onClick={() => dispatch({ type: 'SET_ALGORITHM', id: algo.id as AlgorithmId })}
            disabled={compareMode}
            title={algo.description}
          >
            {algo.shortName ?? algo.name.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="algo-badge" style={{ background: ALGORITHM_LIST.find(a => a.id === selectedAlgorithm)?.color + '22' }}>
        <span style={{ color: ALGORITHM_LIST.find(a => a.id === selectedAlgorithm)?.color, fontSize: 12, fontWeight: 600 }}>
          {ALGORITHM_LIST.find(a => a.id === selectedAlgorithm)?.name}
        </span>
      </div>
    </div>
  );
}
