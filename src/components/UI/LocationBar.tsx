import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { searchLocations } from '../../services/api';
import { SearchResult, LatLng } from '../../types';

// Returns the short human-readable label for a result (used in the input and stored in state)
function getShortName(r: SearchResult): string {
  const a = r.address;
  if (a?.house_number && a?.road) return `${a.house_number} ${a.road}`;
  if (a?.road) return a.road;
  if (a?.city || a?.town || a?.village || a?.hamlet) return (a.city ?? a.town ?? a.village ?? a.hamlet)!;
  return r.displayName.split(',')[0].trim();
}

// Returns the two display lines shown in the dropdown
function formatLines(r: SearchResult): { primary: string; secondary: string } {
  const a = r.address;
  if (a?.house_number && a?.road) {
    const place = a.city ?? a.town ?? a.village ?? a.suburb ?? '';
    const post  = a.postcode ?? '';
    return { primary: `${a.house_number} ${a.road}`, secondary: [place, post].filter(Boolean).join(', ') };
  }
  if (a?.road) {
    const place   = a.city ?? a.town ?? a.village ?? '';
    const country = a.country ?? '';
    return { primary: a.road, secondary: [place, country].filter(Boolean).join(', ') };
  }
  const parts = r.displayName.split(',').map(s => s.trim());
  return { primary: parts[0], secondary: parts.slice(1, 3).filter(Boolean).join(', ') };
}

export default function LocationBar() {
  const { state, dispatch } = useApp();
  const { startPoint, startName, endPoint, endName, pickMode, viaPoints, searchHistory } = state;

  return (
    <div className="location-bar">
      <LocationField
        label="A"
        placeholder="Start location — search or click Pick"
        value={startName}
        active={pickMode === 'start'}
        isSet={!!startPoint}
        history={searchHistory}
        onSelect={(r) => {
          const name = getShortName(r);
          dispatch({ type: 'SET_START', point: { lat: r.lat, lng: r.lng }, name });
          if (r.type !== 'history') dispatch({ type: 'ADD_HISTORY', name, point: { lat: r.lat, lng: r.lng } });
          (window as any).__mapPanTo?.(r.lat, r.lng, 15);
        }}
        onClear={() => dispatch({ type: 'SET_START', point: null, name: '' })}
        onPick={() => dispatch({ type: 'SET_PICK_MODE', mode: pickMode === 'start' ? null : 'start' })}
      />

      <div className="loc-sep"><ArrowIcon /></div>

      {viaPoints.map((via, idx) => (
        <div key={idx} style={{ display: 'contents' }}>
          <LocationField
            label="●"
            placeholder={`Via point ${idx + 1}`}
            value={via.name}
            active={pickMode === `via:${idx}`}
            isSet={via.name !== ''}
            history={searchHistory}
            onSelect={(r) => {
              const name = getShortName(r);
              dispatch({ type: 'SET_VIA_POINT', index: idx, point: { lat: r.lat, lng: r.lng }, name });
              if (r.type !== 'history') dispatch({ type: 'ADD_HISTORY', name, point: { lat: r.lat, lng: r.lng } });
              (window as any).__mapPanTo?.(r.lat, r.lng, 15);
            }}
            onClear={() => dispatch({ type: 'REMOVE_VIA_POINT', index: idx })}
            onPick={() => dispatch({ type: 'SET_PICK_MODE', mode: pickMode === `via:${idx}` ? null : `via:${idx}` })}
            onRemove={() => dispatch({ type: 'REMOVE_VIA_POINT', index: idx })}
          />
          <div className="loc-sep"><ArrowIcon /></div>
        </div>
      ))}

      <button
        className="loc-via-add"
        onClick={() => dispatch({ type: 'ADD_VIA_POINT' })}
      >
        <PlusIcon /> Add waypoint
      </button>

      <div className="loc-sep"><ArrowIcon /></div>

      <LocationField
        label="B"
        placeholder="Destination — search or click Pick"
        value={endName}
        active={pickMode === 'end'}
        isSet={!!endPoint}
        history={searchHistory}
        onSelect={(r) => {
          const name = getShortName(r);
          dispatch({ type: 'SET_END', point: { lat: r.lat, lng: r.lng }, name });
          if (r.type !== 'history') dispatch({ type: 'ADD_HISTORY', name, point: { lat: r.lat, lng: r.lng } });
          (window as any).__mapPanTo?.(r.lat, r.lng, 15);
        }}
        onClear={() => dispatch({ type: 'SET_END', point: null, name: '' })}
        onPick={() => dispatch({ type: 'SET_PICK_MODE', mode: pickMode === 'end' ? null : 'end' })}
      />
    </div>
  );
}

interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  active: boolean;
  isSet: boolean;
  history: Array<{ name: string; point: LatLng }>;
  onSelect: (result: SearchResult) => void;
  onClear: () => void;
  onPick: () => void;
  onRemove?: () => void;
}

function LocationField({ label, placeholder, value, active, isSet, history, onSelect, onClear, onPick, onRemove }: FieldProps) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [noResults, setNoResults]   = useState(false);
  const [focused, setFocused]       = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!focused) setQuery(value); }, [value, focused]);

  const historyItems = history.filter(h => h.name !== value).slice(0, 5);
  const showHistory  = focused && query.length === 0 && historyItems.length > 0;
  const showNoResults = noResults && focused && query.trim().length >= 2 && !loading;
  const showDropdown = (open && results.length > 0) || showHistory || showNoResults;
  const totalItems   = query ? results.length : historyItems.length;

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); setNoResults(false); return; }
    setLoading(true);
    setNoResults(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchLocations(q);
        setResults(r);
        setOpen(r.length > 0);
        setNoResults(r.length === 0);
        setSelectedIdx(-1);
      } catch { setResults([]); setNoResults(false); }
      finally { setLoading(false); }
    }, 350);
  }, []);

  const handleResultSelect = (r: SearchResult) => {
    setQuery(getShortName(r));
    setOpen(false);
    setNoResults(false);
    setFocused(false);
    setSelectedIdx(-1);
    onSelect(r);
  };

  const handleHistorySelect = (item: { name: string; point: LatLng }) => {
    handleResultSelect({ id: -1, displayName: item.name, lat: item.point.lat, lng: item.point.lng, type: 'history', importance: 0 });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); setSelectedIdx(-1); return; }
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && totalItems > 0) {
      e.preventDefault();
      const idx = selectedIdx >= 0 ? selectedIdx : 0;
      if (query) { if (results[idx]) handleResultSelect(results[idx]); }
      else        { if (historyItems[idx]) handleHistorySelect(historyItems[idx]); }
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false); setFocused(false); setSelectedIdx(-1);
        if (!value) setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  return (
    <div className={`loc-field ${active ? 'pick-active' : ''}`} ref={wrapRef}>
      <span className="loc-dot">{label}</span>

      <div className="loc-input-wrap">
        <input
          className="loc-input"
          type="text"
          value={focused ? query : (value || '')}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); setSelectedIdx(-1); }}
          onFocus={() => { setFocused(true); setQuery(value); if (results.length) setOpen(true); }}
          onBlur={() => setTimeout(() => { setFocused(false); setSelectedIdx(-1); if (!value) setQuery(''); }, 150)}
          onKeyDown={handleKeyDown}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {loading && <span className="loc-spinner" />}
        {isSet && !loading && (
          <button className="loc-clear" onClick={onClear} title="Clear" onMouseDown={e => e.preventDefault()}>
            <XIcon />
          </button>
        )}
      </div>

      <button
        className={`pick-btn ${active ? 'active' : ''}`}
        onClick={onPick}
        title={active ? 'Cancel pick mode' : 'Pick location on map'}
      >
        <PinIcon /> Pick
      </button>

      {onRemove && (
        <button className="loc-via-remove" onClick={onRemove} title="Remove waypoint">
          <XIcon />
        </button>
      )}

      {showDropdown && (
        <ul className="loc-dropdown" role="listbox">
          {showNoResults ? (
            <li className="loc-no-results" role="presentation">No results for "{query}"</li>
          ) : query ? (
            results.map((r, i) => {
              const { primary, secondary } = formatLines(r);
              return (
                <li
                  key={r.id}
                  role="option"
                  tabIndex={0}
                  className={i === selectedIdx ? 'selected' : ''}
                  onMouseDown={() => handleResultSelect(r)}
                  onKeyDown={(e) => e.key === 'Enter' && handleResultSelect(r)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="loc-result-icon"><ResultTypeIcon type={r.type} address={r.address} /></span>
                  <div>
                    <div className="loc-result-name">{primary}</div>
                    {secondary && <div className="loc-result-sub">{secondary}</div>}
                  </div>
                </li>
              );
            })
          ) : (
            <>
              <li className="loc-history-header" role="presentation">Recent</li>
              {historyItems.map((item, i) => (
                <li
                  key={i}
                  role="option"
                  tabIndex={0}
                  className={i === selectedIdx ? 'selected' : ''}
                  onMouseDown={() => handleHistorySelect(item)}
                  onKeyDown={(e) => e.key === 'Enter' && handleHistorySelect(item)}
                  onMouseEnter={() => setSelectedIdx(i)}
                >
                  <span className="loc-result-icon loc-history-icon"><ClockIcon /></span>
                  <div>
                    <div className="loc-result-name">{item.name}</div>
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

function ResultTypeIcon({ type, address }: { type: string; address?: SearchResult['address'] }) {
  const t = type.toLowerCase();
  if (address?.house_number || t === 'house' || t === 'apartments' || t === 'building') return <HouseIcon />;
  if (['city', 'town', 'village', 'hamlet', 'municipality', 'county', 'state', 'country', 'administrative'].some(k => t === k || t.includes(k))) return <CityIcon />;
  if (['road', 'highway', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'street', 'path', 'cycleway', 'footway'].some(k => t === k || t.includes(k))) return <RoadIcon />;
  return <PlaceIcon />;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity=".4">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
);
const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
const XIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const HouseIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10.5L12 3l9 7.5"/><path d="M5 8.5V20a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V8.5"/>
  </svg>
);
const CityIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="8" height="14"/><rect x="14" y="3" width="8" height="18"/>
    <line x1="6" y1="11" x2="6" y2="11.01"/><line x1="6" y1="15" x2="6" y2="15.01"/>
    <line x1="18" y1="7" x2="18" y2="7.01"/><line x1="18" y1="11" x2="18" y2="11.01"/>
    <line x1="10" y1="21" x2="14" y2="21"/>
  </svg>
);
const RoadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M3 17l3-10 6 6 6-6 3 10"/><line x1="3" y1="17" x2="21" y2="17"/>
  </svg>
);
const PlaceIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);
