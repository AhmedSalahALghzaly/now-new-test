/**
 * useInfiniteProducts Hook
 * Implements cursor-based pagination for efficient product loading
 * Integrates with Zustand store for caching and offline support
 * v1.0.0
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { productsApi } from '../services/api';
import { useAppStore } from '../store/appStore';
import { useDataCacheStore } from '../store/useDataCacheStore';

export interface ProductFilters {
  category_id?: string;
  product_brand_id?: string;
  car_model_id?: string;
  car_brand_id?: string;
  min_price?: number;
  max_price?: number;
}

export interface UseInfiniteProductsOptions {
  pageSize?: number;
  filters?: ProductFilters;
  enabled?: boolean;
}

export interface UseInfiniteProductsResult {
  products: any[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  fetchNextPage: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export function useInfiniteProducts(options: UseInfiniteProductsOptions = {}): UseInfiniteProductsResult {
  const { pageSize = 20, filters = {}, enabled = true } = options;
  
  // State
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  
  // Refs for pagination
  const nextCursorRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  
  // Global store access
  const setGlobalProducts = useAppStore((state) => state.setProducts);
  const isOnline = useDataCacheStore((state) => state.isOnline);
  const cachedProducts = useDataCacheStore((state) => state.products);
  
  // Build filter params
  const buildParams = useCallback((cursor?: string | null) => {
    const params: Record<string, any> = {
      limit: pageSize,
    };
    
    if (cursor) {
      params.cursor = cursor;
      params.direction = 'next';
    }
    
    // Apply filters
    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.product_brand_id) params.product_brand_id = filters.product_brand_id;
    if (filters.car_model_id) params.car_model_id = filters.car_model_id;
    if (filters.car_brand_id) params.car_brand_id = filters.car_brand_id;
    if (filters.min_price !== undefined) params.min_price = filters.min_price;
    if (filters.max_price !== undefined) params.max_price = filters.max_price;
    
    return params;
  }, [pageSize, filters]);
  
  // Fetch products
  const fetchProducts = useCallback(async (cursor?: string | null, isRefresh = false) => {
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    
    if (isRefresh) {
      setIsRefreshing(true);
    } else if (cursor) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
    setError(null);
    
    try {
      const params = buildParams(cursor);
      const response = await productsApi.getAll(params);
      
      const newProducts = response.data?.products || [];
      const nextCursor = response.data?.next_cursor;
      const moreAvailable = response.data?.has_more ?? newProducts.length >= pageSize;
      const totalCount = response.data?.total || 0;
      
      // Update state
      setProducts((prev) => {
        if (isRefresh || !cursor) {
          return newProducts;
        }
        // Append new products, avoiding duplicates
        const existingIds = new Set(prev.map(p => p.id));
        const uniqueNew = newProducts.filter((p: any) => !existingIds.has(p.id));
        return [...prev, ...uniqueNew];
      });
      
      nextCursorRef.current = nextCursor;
      setHasMore(moreAvailable);
      setTotal(totalCount);
      
      // Update global store with latest products (first page only for cache)
      if (!cursor || isRefresh) {
        setGlobalProducts(newProducts);
      }
      
    } catch (err: any) {
      console.error('[useInfiniteProducts] Error fetching:', err);
      setError(err.message || 'Failed to fetch products');
      
      // Fallback to cached products if offline
      if (!isOnline && cachedProducts.length > 0) {
        setProducts(cachedProducts);
        setHasMore(false);
        setTotal(cachedProducts.length);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [buildParams, pageSize, setGlobalProducts, isOnline, cachedProducts]);
  
  // Fetch next page
  const fetchNextPage = useCallback(async () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    await fetchProducts(nextCursorRef.current);
  }, [hasMore, isLoadingMore, isLoading, fetchProducts]);
  
  // Refresh (reload from start)
  const refresh = useCallback(async () => {
    nextCursorRef.current = null;
    setHasMore(true);
    await fetchProducts(null, true);
  }, [fetchProducts]);
  
  // Reset to initial state
  const reset = useCallback(() => {
    setProducts([]);
    setIsLoading(true);
    setIsLoadingMore(false);
    setIsRefreshing(false);
    setError(null);
    setHasMore(true);
    setTotal(0);
    nextCursorRef.current = null;
    isLoadingRef.current = false;
  }, []);
  
  // Initial fetch and filter changes
  useEffect(() => {
    if (enabled) {
      nextCursorRef.current = null;
      fetchProducts(null);
    }
  }, [enabled, JSON.stringify(filters)]);
  
  return {
    products,
    isLoading,
    isLoadingMore,
    isRefreshing,
    error,
    hasMore,
    total,
    fetchNextPage,
    refresh,
    reset,
  };
}

export default useInfiniteProducts;
