import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useCategories as useQueryCategories } from '../api/hooks';
import type { CategoryItem } from '../types';

export interface UseCategoriesResult {
  categories: CategoryItem[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  refresh: () => Promise<void>;
}

interface CategoryContextValue extends UseCategoriesResult {}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const { data: categories = [], isLoading, error: queryError, refetch } = useQueryCategories();

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Không thể tải danh mục') : null;

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading: isLoading,
        error,
        isEmpty: !isLoading && !error && categories.length === 0,
        refresh,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories(): CategoryContextValue {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error('useCategories must be used within CategoryProvider');
  return ctx;
}
