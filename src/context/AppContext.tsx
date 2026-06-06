import {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  Dispatch,
} from 'react';
import {
  LatLng,
  AlgorithmId,
  RoadGraph,
  PathResult,
  PlaybackState,
  SpeedMultiplier,
  CompareResult,
  PanelTab,
  PickMode,
  Waypoint,
} from '../types';

interface AppState {
  startPoint: LatLng | null;
  endPoint: LatLng | null;
  startName: string;
  endName: string;
  viaPoints: Waypoint[];
  selectedAlgorithm: AlgorithmId;
  graph: RoadGraph | null;
  graphLoading: boolean;
  graphError: string | null;
  result: PathResult | null;
  playback: PlaybackState;
  currentStep: number;
  speed: SpeedMultiplier;
  compareResults: CompareResult[] | null;
  compareMode: boolean;
  panelOpen: boolean;
  panelTab: PanelTab;
  pickMode: PickMode;
  searchHistory: Array<{ name: string; point: LatLng }>;
}

type Action =
  | { type: 'SET_START'; point: LatLng | null; name?: string }
  | { type: 'SET_END'; point: LatLng | null; name?: string }
  | { type: 'ADD_VIA_POINT' }
  | { type: 'REMOVE_VIA_POINT'; index: number }
  | { type: 'SET_VIA_POINT'; index: number; point: LatLng; name: string }
  | { type: 'SET_ALGORITHM'; id: AlgorithmId }
  | { type: 'SET_GRAPH_LOADING' }
  | { type: 'SET_GRAPH'; graph: RoadGraph }
  | { type: 'SET_GRAPH_ERROR'; error: string }
  | { type: 'SET_RESULT'; result: PathResult }
  | { type: 'SET_PLAYBACK'; state: PlaybackState }
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_SPEED'; speed: SpeedMultiplier }
  | { type: 'SET_COMPARE'; results: CompareResult[] }
  | { type: 'SET_COMPARE_MODE'; enabled: boolean }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'SET_PANEL_TAB'; tab: PanelTab }
  | { type: 'SET_PICK_MODE'; mode: PickMode }
  | { type: 'RESET' }
  | { type: 'ADD_HISTORY'; name: string; point: LatLng };

const INITIAL: AppState = {
  startPoint: null,
  endPoint: null,
  startName: '',
  endName: '',
  viaPoints: [],
  selectedAlgorithm: 'dijkstra',
  graph: null,
  graphLoading: false,
  graphError: null,
  result: null,
  playback: 'idle',
  currentStep: 0,
  speed: 1,
  compareResults: null,
  compareMode: false,
  panelOpen: false,
  panelTab: 'route',
  pickMode: null,
  searchHistory: JSON.parse(localStorage.getItem('pathscope-history') ?? '[]').slice(0, 10),
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_START':
      return {
        ...state,
        startPoint: action.point,
        startName: action.name ?? '',
        result: null,
        playback: 'idle',
        currentStep: 0,
        pickMode: null,
      };
    case 'SET_END':
      return {
        ...state,
        endPoint: action.point,
        endName: action.name ?? '',
        result: null,
        playback: 'idle',
        currentStep: 0,
        pickMode: null,
      };
    case 'ADD_VIA_POINT':
      return {
        ...state,
        viaPoints: [...state.viaPoints, { point: { lat: 0, lng: 0 }, name: '' }],
        result: null,
        playback: 'idle',
        currentStep: 0,
      };
    case 'REMOVE_VIA_POINT': {
      const viaPoints = state.viaPoints.filter((_, i) => i !== action.index);
      return { ...state, viaPoints, result: null, playback: 'idle', currentStep: 0, pickMode: null };
    }
    case 'SET_VIA_POINT': {
      const viaPoints = state.viaPoints.map((v, i) =>
        i === action.index ? { point: action.point, name: action.name } : v
      );
      return { ...state, viaPoints, result: null, playback: 'idle', currentStep: 0, pickMode: null };
    }
    case 'SET_ALGORITHM':
      return { ...state, selectedAlgorithm: action.id, result: null, playback: 'idle', currentStep: 0 };
    case 'SET_GRAPH_LOADING':
      return { ...state, graphLoading: true, graphError: null, graph: null };
    case 'SET_GRAPH':
      return { ...state, graphLoading: false, graph: action.graph };
    case 'SET_GRAPH_ERROR':
      return { ...state, graphLoading: false, graphError: action.error };
    case 'SET_RESULT':
      return { ...state, result: action.result, playback: 'running', currentStep: 0 };
    case 'SET_PLAYBACK':
      return { ...state, playback: action.state };
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_SPEED':
      return { ...state, speed: action.speed };
    case 'SET_COMPARE':
      return { ...state, compareResults: action.results, playback: 'running', currentStep: 0 };
    case 'SET_COMPARE_MODE':
      return { ...state, compareMode: action.enabled, compareResults: null };
    case 'TOGGLE_PANEL':
      return { ...state, panelOpen: !state.panelOpen };
    case 'SET_PANEL_TAB':
      return { ...state, panelTab: action.tab };
    case 'SET_PICK_MODE':
      return { ...state, pickMode: action.mode };
    case 'RESET':
      return {
        ...state,
        graph: null,
        result: null,
        compareResults: null,
        playback: 'idle',
        currentStep: 0,
        graphError: null,
        pickMode: null,
      };
    case 'ADD_HISTORY': {
      const h = [{ name: action.name, point: action.point }, ...state.searchHistory].slice(0, 10);
      localStorage.setItem('pathscope-history', JSON.stringify(h));
      return { ...state, searchHistory: h };
    }
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextValue>({
  state: INITIAL,
  dispatch: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
export type { AppState, Action };
