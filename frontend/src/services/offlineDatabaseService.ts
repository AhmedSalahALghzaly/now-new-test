/**
 * Offline Database Service
 * Enhanced SQLite-based local database for persistent offline-first storage
 * Supports 3GB+ storage with intelligent sync management
 */
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Database configuration
const DB_NAME = 'alghazaly_offline.db';
const STORAGE_LIMIT_GB = 3; // Soft limit in GB
const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_GB * 1024 * 1024 * 1024;

export interface SyncMetadata {
  lastSyncTimestamp: number;
  serverVersion: number;
  localVersion: number;
  isDeleted: boolean;
  needsSync: boolean;
}

export interface LocalProduct {
  id: string;
  data: string; // JSON stringified product
  syncMetadata: SyncMetadata;
  createdAt: number;
  updatedAt: number;
}

export interface LocalCategory {
  id: string;
  data: string;
  syncMetadata: SyncMetadata;
  createdAt: number;
  updatedAt: number;
}

class OfflineDatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private isInitialized = false;

  /**
   * Initialize the SQLite database
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.db) {
      return true;
    }

    try {
      // Open database
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      
      // Create tables
      await this.createTables();
      
      this.isInitialized = true;
      console.log('[OfflineDB] Database initialized successfully');
      return true;
    } catch (error) {
      console.error('[OfflineDB] Failed to initialize database:', error);
      return false;
    }
  }

  /**
   * Create all necessary tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) return;

    await this.db.execAsync(`
      -- Products table
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        last_sync_timestamp INTEGER DEFAULT 0,
        server_version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        needs_sync INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        last_sync_timestamp INTEGER DEFAULT 0,
        server_version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        needs_sync INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Car Brands table
      CREATE TABLE IF NOT EXISTS car_brands (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        last_sync_timestamp INTEGER DEFAULT 0,
        server_version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        needs_sync INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Car Models table
      CREATE TABLE IF NOT EXISTS car_models (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        last_sync_timestamp INTEGER DEFAULT 0,
        server_version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        needs_sync INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Product Brands table
      CREATE TABLE IF NOT EXISTS product_brands (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        last_sync_timestamp INTEGER DEFAULT 0,
        server_version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        needs_sync INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Orders table
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        last_sync_timestamp INTEGER DEFAULT 0,
        server_version INTEGER DEFAULT 1,
        local_version INTEGER DEFAULT 1,
        is_deleted INTEGER DEFAULT 0,
        needs_sync INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Offline Queue table for pending actions
      CREATE TABLE IF NOT EXISTS offline_queue (
        id TEXT PRIMARY KEY NOT NULL,
        action_type TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        payload TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- User session table for auto-logout tracking
      CREATE TABLE IF NOT EXISTS user_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        last_activity_timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        session_token TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at);
      CREATE INDEX IF NOT EXISTS idx_products_needs_sync ON products(needs_sync);
      CREATE INDEX IF NOT EXISTS idx_categories_updated ON categories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_offline_queue_status ON offline_queue(status);
    `);

    console.log('[OfflineDB] Tables created successfully');
  }

  /**
   * Get database storage size
   */
  async getStorageSize(): Promise<number> {
    try {
      const dbPath = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
      const info = await FileSystem.getInfoAsync(dbPath);
      return info.exists ? (info.size || 0) : 0;
    } catch (error) {
      console.error('[OfflineDB] Error getting storage size:', error);
      return 0;
    }
  }

  /**
   * Check if storage limit is exceeded
   */
  async isStorageLimitExceeded(): Promise<boolean> {
    const size = await this.getStorageSize();
    return size > STORAGE_LIMIT_BYTES;
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo(): Promise<{ used: number; limit: number; percentage: number }> {
    const used = await this.getStorageSize();
    return {
      used,
      limit: STORAGE_LIMIT_BYTES,
      percentage: (used / STORAGE_LIMIT_BYTES) * 100,
    };
  }

  // ==================== Products ====================

  async saveProducts(products: any[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    
    for (const product of products) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO products (id, data, last_sync_timestamp, server_version, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [product.id, JSON.stringify(product), now, product._version || 1, now]
      );
    }
    
    console.log(`[OfflineDB] Saved ${products.length} products`);
  }

  async getProducts(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync(
      'SELECT data FROM products WHERE is_deleted = 0 ORDER BY updated_at DESC'
    );
    
    return rows.map((row: any) => JSON.parse(row.data));
  }

  async getProductById(id: string): Promise<any | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    const row = await this.db.getFirstAsync(
      'SELECT data FROM products WHERE id = ? AND is_deleted = 0',
      [id]
    );
    
    return row ? JSON.parse((row as any).data) : null;
  }

  async deleteProduct(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?', [Date.now(), id]);
  }

  /**
   * Sync products from server - handles deletions intelligently
   */
  async syncProducts(serverProducts: any[], serverDeletedIds: string[] = []): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    const serverProductIds = new Set(serverProducts.map(p => p.id));

    // Update or insert server products
    for (const product of serverProducts) {
      const existingRow = await this.db.getFirstAsync(
        'SELECT local_version, needs_sync FROM products WHERE id = ?',
        [product.id]
      ) as any;

      if (existingRow && existingRow.needs_sync) {
        // Conflict: local changes exist
        // Last-write wins based on timestamp
        const serverUpdated = new Date(product.updated_at).getTime();
        if (serverUpdated > existingRow.local_version) {
          // Server wins
          await this.db.runAsync(
            `UPDATE products SET data = ?, server_version = ?, last_sync_timestamp = ?, needs_sync = 0, updated_at = ?
             WHERE id = ?`,
            [JSON.stringify(product), product._version || 1, now, now, product.id]
          );
        }
        // Otherwise local wins - keep local data
      } else {
        // No conflict, just update
        await this.db.runAsync(
          `INSERT OR REPLACE INTO products (id, data, server_version, last_sync_timestamp, updated_at, is_deleted, needs_sync)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          [product.id, JSON.stringify(product), product._version || 1, now, now]
        );
      }
    }

    // Handle deleted products from server
    for (const deletedId of serverDeletedIds) {
      await this.db.runAsync('UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, deletedId]);
    }

    // Mark products not in server response as potentially deleted
    // (Only if we received a complete list)
    if (serverProducts.length > 0) {
      const localProducts = await this.db.getAllAsync('SELECT id FROM products WHERE is_deleted = 0');
      for (const local of localProducts as any[]) {
        if (!serverProductIds.has(local.id) && !serverDeletedIds.includes(local.id)) {
          // Product exists locally but not on server - mark as deleted
          await this.db.runAsync('UPDATE products SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, local.id]);
        }
      }
    }

    console.log(`[OfflineDB] Synced ${serverProducts.length} products, deleted ${serverDeletedIds.length}`);
  }

  // ==================== Categories ====================

  async saveCategories(categories: any[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const category of categories) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO categories (id, data, last_sync_timestamp, updated_at)
         VALUES (?, ?, ?, ?)`,
        [category.id, JSON.stringify(category), now, now]
      );
    }
  }

  async getCategories(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync('SELECT data FROM categories WHERE is_deleted = 0');
    return rows.map((row: any) => JSON.parse(row.data));
  }

  async syncCategories(serverCategories: any[], serverDeletedIds: string[] = []): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const category of serverCategories) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO categories (id, data, server_version, last_sync_timestamp, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [category.id, JSON.stringify(category), category._version || 1, now, now]
      );
    }

    for (const deletedId of serverDeletedIds) {
      await this.db.runAsync('UPDATE categories SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, deletedId]);
    }
  }

  // ==================== Car Brands ====================

  async saveCarBrands(brands: any[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const brand of brands) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO car_brands (id, data, last_sync_timestamp, updated_at)
         VALUES (?, ?, ?, ?)`,
        [brand.id, JSON.stringify(brand), now, now]
      );
    }
  }

  async getCarBrands(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync('SELECT data FROM car_brands WHERE is_deleted = 0');
    return rows.map((row: any) => JSON.parse(row.data));
  }

  async syncCarBrands(serverBrands: any[], serverDeletedIds: string[] = []): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const brand of serverBrands) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO car_brands (id, data, last_sync_timestamp, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, 0)`,
        [brand.id, JSON.stringify(brand), now, now]
      );
    }

    for (const deletedId of serverDeletedIds) {
      await this.db.runAsync('UPDATE car_brands SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, deletedId]);
    }
  }

  // ==================== Car Models ====================

  async saveCarModels(models: any[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const model of models) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO car_models (id, data, last_sync_timestamp, updated_at)
         VALUES (?, ?, ?, ?)`,
        [model.id, JSON.stringify(model), now, now]
      );
    }
  }

  async getCarModels(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync('SELECT data FROM car_models WHERE is_deleted = 0');
    return rows.map((row: any) => JSON.parse(row.data));
  }

  async syncCarModels(serverModels: any[], serverDeletedIds: string[] = []): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const model of serverModels) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO car_models (id, data, last_sync_timestamp, updated_at, is_deleted)
         VALUES (?, ?, ?, ?, 0)`,
        [model.id, JSON.stringify(model), now, now]
      );
    }

    for (const deletedId of serverDeletedIds) {
      await this.db.runAsync('UPDATE car_models SET is_deleted = 1, updated_at = ? WHERE id = ?', [now, deletedId]);
    }
  }

  // ==================== Product Brands ====================

  async saveProductBrands(brands: any[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const brand of brands) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO product_brands (id, data, last_sync_timestamp, updated_at)
         VALUES (?, ?, ?, ?)`,
        [brand.id, JSON.stringify(brand), now, now]
      );
    }
  }

  async getProductBrands(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync('SELECT data FROM product_brands WHERE is_deleted = 0');
    return rows.map((row: any) => JSON.parse(row.data));
  }

  // ==================== Orders ====================

  async saveOrders(orders: any[]): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    for (const order of orders) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO orders (id, data, last_sync_timestamp, updated_at)
         VALUES (?, ?, ?, ?)`,
        [order.id, JSON.stringify(order), now, now]
      );
    }
  }

  async getOrders(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync('SELECT data FROM orders WHERE is_deleted = 0 ORDER BY updated_at DESC');
    return rows.map((row: any) => JSON.parse(row.data));
  }

  // ==================== Sync Metadata ====================

  async setLastSyncTime(time: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('last_sync_time', ?, ?)`,
      [time.toString(), Date.now()]
    );
  }

  async getLastSyncTime(): Promise<number | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    const row = await this.db.getFirstAsync(
      'SELECT value FROM sync_metadata WHERE key = ?',
      ['last_sync_time']
    ) as any;
    
    return row ? parseInt(row.value, 10) : null;
  }

  // ==================== User Session (Auto-Logout) ====================

  async updateLastActivity(userId: string): Promise<void> {
    if (!this.db) await this.initialize();
    if (!this.db) return;

    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO user_session (id, user_id, last_activity_timestamp)
       VALUES (1, ?, ?)`,
      [userId, now]
    );
  }

  async getLastActivityTimestamp(): Promise<number | null> {
    if (!this.db) await this.initialize();
    if (!this.db) return null;

    const row = await this.db.getFirstAsync(
      'SELECT last_activity_timestamp FROM user_session WHERE id = 1'
    ) as any;
    
    return row ? row.last_activity_timestamp : null;
  }

  /**
   * Check if user should be auto-logged out (3 months = 90 days inactivity)
   */
  async shouldAutoLogout(): Promise<boolean> {
    const lastActivity = await this.getLastActivityTimestamp();
    if (!lastActivity) return false;

    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    return (now - lastActivity) > NINETY_DAYS_MS;
  }

  // ==================== Offline Queue ====================

  async addToOfflineQueue(action: {
    type: string;
    endpoint: string;
    method: string;
    payload?: any;
  }): Promise<string> {
    if (!this.db) await this.initialize();
    if (!this.db) return '';

    const id = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.runAsync(
      `INSERT INTO offline_queue (id, action_type, endpoint, method, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [id, action.type, action.endpoint, action.method, action.payload ? JSON.stringify(action.payload) : null]
    );
    
    return id;
  }

  async getOfflineQueue(): Promise<any[]> {
    if (!this.db) await this.initialize();
    if (!this.db) return [];

    const rows = await this.db.getAllAsync(
      'SELECT * FROM offline_queue WHERE status = ? ORDER BY created_at ASC',
      ['pending']
    );
    
    return rows.map((row: any) => ({
      ...row,
      payload: row.payload ? JSON.parse(row.payload) : null,
    }));
  }

  async updateOfflineQueueItem(id: string, updates: { status?: string; error_message?: string; retry_count?: number }): Promise<void> {
    if (!this.db) return;
    
    const setClauses: string[] = [];
    const values: any[] = [];
    
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.error_message !== undefined) {
      setClauses.push('error_message = ?');
      values.push(updates.error_message);
    }
    if (updates.retry_count !== undefined) {
      setClauses.push('retry_count = ?');
      values.push(updates.retry_count);
    }
    
    if (setClauses.length > 0) {
      values.push(id);
      await this.db.runAsync(
        `UPDATE offline_queue SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  async removeFromOfflineQueue(id: string): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync('DELETE FROM offline_queue WHERE id = ?', [id]);
  }

  // ==================== Cleanup ====================

  async cleanupOldData(maxAgeDays: number = 30): Promise<void> {
    if (!this.db) return;
    
    const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
    
    // Delete old deleted items
    await this.db.runAsync('DELETE FROM products WHERE is_deleted = 1 AND updated_at < ?', [cutoffTime]);
    await this.db.runAsync('DELETE FROM categories WHERE is_deleted = 1 AND updated_at < ?', [cutoffTime]);
    await this.db.runAsync('DELETE FROM car_brands WHERE is_deleted = 1 AND updated_at < ?', [cutoffTime]);
    await this.db.runAsync('DELETE FROM car_models WHERE is_deleted = 1 AND updated_at < ?', [cutoffTime]);
    await this.db.runAsync('DELETE FROM product_brands WHERE is_deleted = 1 AND updated_at < ?', [cutoffTime]);
    
    // Cleanup failed queue items
    await this.db.runAsync('DELETE FROM offline_queue WHERE status = ? AND created_at < ?', ['failed', cutoffTime]);
    
    console.log('[OfflineDB] Cleaned up old data');
  }

  /**
   * Vacuum the database to reclaim space
   */
  async vacuum(): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync('VACUUM');
    console.log('[OfflineDB] Database vacuumed');
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.isInitialized = false;
      console.log('[OfflineDB] Database closed');
    }
  }
}

export const offlineDatabaseService = new OfflineDatabaseService();
export default offlineDatabaseService;
