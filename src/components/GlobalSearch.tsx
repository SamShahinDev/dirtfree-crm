// Global Search Component
// Unified search across CRM, Portal, and Website

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Loader2, User, Briefcase, FileText, Globe, X, Command } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SearchResult {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description?: string;
  url: string;
  platform: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface SearchResponse {
  success: boolean;
  query: string;
  total: number;
  results: SearchResult[];
  grouped: {
    crm: SearchResult[];
    portal: SearchResult[];
    website: SearchResult[];
  };
}

// ============================================================================
// Component
// ============================================================================

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // Search Effect
  // ==========================================================================

  useEffect(() => {
    async function performSearch() {
      if (debouncedQuery.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}&platform=crm&limit=10`
        );
        const data: SearchResponse = await response.json();

        if (data.success) {
          setResults(data.results || []);
          setOpen(true);
          setSelectedIndex(0);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }

    performSearch();
  }, [debouncedQuery]);

  // ==========================================================================
  // Keyboard Shortcuts
  // ==========================================================================

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Escape to close
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }

      // Arrow keys for navigation
      if (open && results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }

        // Enter to navigate to selected result
        if (e.key === 'Enter' && results[selectedIndex]) {
          window.location.href = results[selectedIndex].url;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex]);

  // ==========================================================================
  // Click Outside to Close
  // ==========================================================================

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'customer':
        return <User className="h-4 w-4" />;
      case 'job':
        return <Briefcase className="h-4 w-4" />;
      case 'invoice':
        return <FileText className="h-4 w-4" />;
      case 'page':
      case 'service':
        return <Globe className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getEntityColor = (entityType: string) => {
    switch (entityType) {
      case 'customer':
        return 'bg-blue-100 text-blue-700';
      case 'job':
        return 'bg-green-100 text-green-700';
      case 'invoice':
        return 'bg-purple-100 text-purple-700';
      case 'page':
      case 'service':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search customers, jobs, invoices..."
          className="w-full rounded-lg border border-input bg-background pl-10 pr-20 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
        />

        {/* Right Side Icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {query && !loading && (
            <button
              onClick={clearSearch}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Keyboard Hint */}
          {!query && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <Command className="h-3 w-3" />
              <span>K</span>
            </div>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full rounded-lg border border-border bg-popover shadow-lg z-50 max-h-[400px] overflow-y-auto"
        >
          <div className="p-2">
            {results.map((result, index) => (
              <Link
                key={`${result.entity_type}-${result.entity_id}`}
                href={result.url}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-md hover:bg-accent transition-colors',
                  index === selectedIndex && 'bg-accent'
                )}
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {/* Entity Icon */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center',
                    getEntityColor(result.entity_type)
                  )}
                >
                  {getEntityIcon(result.entity_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{result.title}</div>

                  {result.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {result.description}
                    </div>
                  )}

                  {/* Tags & Entity Type */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary capitalize">
                      {result.entity_type.replace('_', ' ')}
                    </span>

                    {result.tags && result.tags.length > 0 && (
                      <div className="flex items-center gap-1">
                        {result.tags.slice(0, 2).map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">↵</kbd>
                  Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">Esc</kbd>
                  Close
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Results */}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-2 w-full rounded-lg border border-border bg-popover shadow-lg z-50 p-6 text-center"
        >
          <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No results found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try searching for customers, jobs, or invoices
          </p>
        </div>
      )}
    </div>
  );
}
