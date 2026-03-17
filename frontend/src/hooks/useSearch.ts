import { useState, useCallback, useMemo } from 'react';

export interface SearchFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: Date;
}

/**
 * Hook for managing search and filter state
 */
export const useSearch = (pageId: string) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [savedFilters, setSavedFilters] = useState<SearchFilter[]>(() => {
    const stored = localStorage.getItem(`filters_${pageId}`);
    return stored ? JSON.parse(stored) : [];
  });

  // Save/load filters from localStorage
  const saveFilter = useCallback((name: string, filters: Record<string, any>) => {
    const newFilter: SearchFilter = {
      id: Date.now().toString(),
      name,
      filters,
      createdAt: new Date(),
    };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(`filters_${pageId}`, JSON.stringify(updated));
    return newFilter;
  }, [pageId, savedFilters]);

  const deleteFilter = useCallback((filterId: string) => {
    const updated = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem(`filters_${pageId}`, JSON.stringify(updated));
  }, [pageId, savedFilters]);

  const loadFilter = useCallback((filter: SearchFilter) => {
    setActiveFilters(filter.filters);
  }, []);

  const applyFilters = useCallback((filters: Record<string, any>) => {
    setActiveFilters(filters);
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setSearchQuery('');
  }, []);

  const hasActiveFilters = useMemo(
    () => Object.keys(activeFilters).length > 0 || searchQuery.length > 0,
    [activeFilters, searchQuery]
  );

  return {
    searchQuery,
    setSearchQuery,
    activeFilters,
    applyFilters,
    clearFilters,
    hasActiveFilters,
    savedFilters,
    saveFilter,
    deleteFilter,
    loadFilter,
  };
};

/**
 * Hook for debounced search
 */
export const useDebouncedSearch = (query: string, delay: number = 300) => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce timer
  setTimeout(() => {
    setDebouncedQuery(query);
  }, delay);

  return debouncedQuery;
};

/**
 * Advanced search filter that works with any data array
 */
export const useFilteredData = <T extends Record<string, any>>(
  data: T[],
  searchQuery: string,
  filters: Record<string, any>,
  searchableFields: string[] = []
) => {
  return useMemo(() => {
    let filtered = [...data];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        return searchableFields.some(field => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(query);
        });
      });
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        filtered = filtered.filter(item => value.includes(item[key]));
      } else if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
          // Range filter
          filtered = filtered.filter(
            item => item[key] >= value.min && item[key] <= value.max
          );
        } else {
          // Exact match
          filtered = filtered.filter(item => item[key] === value);
        }
      }
    });

    return filtered;
  }, [data, searchQuery, filters, searchableFields]);
};

/**
 * Hook for building a search index
 */
export const useSearchIndex = <T extends Record<string, any>>(
  data: T[],
  indexFields: string[]
) => {
  const index = useMemo(() => {
    const searchIndex = new Map<string, Set<number>>();

    data.forEach((item, idx) => {
      indexFields.forEach(field => {
        const value = item[field];
        if (value) {
          const tokens = String(value).toLowerCase().split(/\s+/);
          tokens.forEach(token => {
            if (!searchIndex.has(token)) {
              searchIndex.set(token, new Set());
            }
            searchIndex.get(token)!.add(idx);
          });
        }
      });
    });

    return searchIndex;
  }, [data, indexFields]);

  const search = useCallback((query: string): T[] => {
    if (!query.trim()) return data;

    const tokens = query.toLowerCase().split(/\s+/);
    let results: Set<number> | null = null;

    tokens.forEach(token => {
      const matches = index.get(token) || new Set();
      if (results === null) {
        results = new Set(matches);
      } else {
        // Intersect: only keep indices that match all tokens
        results = new Set([...results].filter(idx => matches.has(idx)));
      }
    });

    if (!results) return [];
    
    const indices = Array.from(results) as number[];
    return indices.map((idx: number) => data[idx as never]);
  }, [data, index]);

  return { search, index };
};
