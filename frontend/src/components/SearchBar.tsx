import React, { useEffect, useState, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  showHint?: boolean;
}

/**
 * Global Search Bar - For searching within the app
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search...',
  onFocus,
  onBlur,
  showHint = true,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Debounce search callback
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  const clearSearch = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  // Keyboard shortcut: Cmd+K or Ctrl+K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        maxWidth: '500px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: isFocused ? 'white' : '#f8fafc',
          border: isFocused ? '2px solid #3b82f6' : '1px solid #e2e8f0',
          borderRadius: '8px',
          transition: 'all 0.2s',
          boxShadow: isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
        }}
      >
        <Search size={18} style={{ color: '#94a3b8' }} />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '0.95rem',
            color: '#1e293b',
          }}
        />

        {/* Clear button */}
        {query && (
          <button
            onClick={clearSearch}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              padding: '0.25rem',
            }}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}

        {/* Keyboard hint */}
        {!query && showHint && (
          <div
            style={{
              fontSize: '0.75rem',
              color: '#cbd5e1',
              padding: '0.25rem 0.5rem',
              background: '#f1f5f9',
              borderRadius: '4px',
              marginLeft: '0.5rem',
            }}
          >
            ⌘K
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Filter Chip - Display and manage individual filters
 */
interface FilterChipProps {
  label: string;
  value: string;
  onRemove: () => void;
  color?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  value,
  onRemove,
  color = '#3b82f6',
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.4rem 0.8rem',
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: '6px',
        fontSize: '0.875rem',
        color: color,
      }}
    >
      <span>{label}: {value}</span>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color,
          display: 'flex',
          alignItems: 'center',
          padding: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
};

/**
 * Filter Bar - Display active filters with clear button
 */
interface FilterBarProps {
  filters: Array<{ id: string; label: string; value: string }>;
  onRemoveFilter: (id: string) => void;
  onClearAll: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onRemoveFilter,
  onClearAll,
}) => {
  if (filters.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem',
        background: '#f8fafc',
        borderRadius: '8px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>
        Filters:
      </span>
      {filters.map(filter => (
        <FilterChip
          key={filter.id}
          label={filter.label}
          value={filter.value}
          onRemove={() => onRemoveFilter(filter.id)}
        />
      ))}
      <button
        onClick={onClearAll}
        style={{
          marginLeft: 'auto',
          padding: '0.4rem 0.8rem',
          background: 'none',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          cursor: 'pointer',
          color: '#64748b',
          fontSize: '0.875rem',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f1f5f9';
          e.currentTarget.style.borderColor = '#94a3b8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.borderColor = '#cbd5e1';
        }}
      >
        Clear All
      </button>
    </div>
  );
};
