import { useState, useEffect, useRef } from 'react';
import { SearchResult, LatLng } from '../../types';
import { searchLocations } from '../../services/api';

interface Props {
  placeholder: string;
  value: string;
  onSelect: (result: SearchResult) => void;
  color: string;
}

export default function SearchBox({ placeholder, value, onSelect, color }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const search = (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchLocations(q);
        setResults(r);
        setOpen(r.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelect = (r: SearchResult) => {
    setQuery(r.displayName.split(',')[0]);
    setOpen(false);
    onSelect(r);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && <div className="spinner" />}
      </div>

      {open && results.length > 0 && (
        <ul className="search-dropdown" role="listbox">
          {results.map((r) => (
            <li
              key={r.id}
              role="option"
              tabIndex={0}
              onMouseDown={() => handleSelect(r)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(r)}
            >
              <span className="search-result-name">{r.displayName.split(',')[0]}</span>
              <span className="search-result-detail">{r.displayName.split(',').slice(1, 3).join(',')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
