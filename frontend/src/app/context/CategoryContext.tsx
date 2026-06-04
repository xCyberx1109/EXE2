import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { categoryApi } from '../api/services';
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
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await categoryApi.list();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh mục');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        error,
        isEmpty: !loading && !error && categories.length === 0,
        refresh: fetch,
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
