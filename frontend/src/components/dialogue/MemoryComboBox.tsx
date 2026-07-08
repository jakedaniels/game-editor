

import { useEffect, useMemo, useRef, useState } from 'react';
import type { StateEntry } from '../../api/client';

type MemoryComboBoxProps = {
  entries: StateEntry[];
  value: string;
  placeholder?: string;
  onChange: (stateKey: string) => void;
};

export function MemoryComboBox({
  entries,
  value,
  placeholder = 'Search memory...',
  onChange,
}: MemoryComboBoxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedEntry = entries.find((entry) => entry.id === value) ?? null;
  const [query, setQuery] = useState(selectedEntry?.label ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedEntry?.label ?? '');
  }, [selectedEntry?.label]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;

    return entries.filter((entry) => entry.label.toLowerCase().includes(normalizedQuery));
  }, [entries, query]);

  return (
    <div className="memory-combobox" ref={rootRef}>
      <input
        className="dialogue-effects__input memory-combobox__input"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          onChange('');
        }}
      />

      {open && (
        <div className="memory-combobox__menu">
          {filteredEntries.length ? (
            filteredEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="memory-combobox__option"
                onClick={() => {
                  setQuery(entry.label);
                  onChange(entry.id);
                  setOpen(false);
                }}
              >
                {entry.label}
              </button>
            ))
          ) : (
            <div className="memory-combobox__empty">No matching memories</div>
          )}
        </div>
      )}
    </div>
  );
}