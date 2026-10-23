export function searchHistoryStorageKey(isReducedEdition: boolean) {
  return `erp-search-history-v1-${isReducedEdition ? 'rahyar' : 'erp'}`;
}

export function readSearchHistory(isReducedEdition: boolean): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(searchHistoryStorageKey(isReducedEdition)) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
  } catch { return []; }
}

export function saveSearchHistory(query: string, isReducedEdition: boolean): string[] {
  const normalized = query.trim();
  if (!normalized) return readSearchHistory(isReducedEdition);
  const next = [normalized, ...readSearchHistory(isReducedEdition).filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())].slice(0, 8);
  window.localStorage.setItem(searchHistoryStorageKey(isReducedEdition), JSON.stringify(next));
  return next;
}

export function clearSearchHistory(isReducedEdition: boolean) {
  window.localStorage.removeItem(searchHistoryStorageKey(isReducedEdition));
}
