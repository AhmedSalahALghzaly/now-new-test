/**
 * Custom Sync Adapter for WatermelonDB
 * Handles synchronization between local WatermelonDB and remote PostgreSQL
 */
import { synchronize } from '@nozbe/watermelondb/sync';
import database, {
  carBrandsCollection,
  carModelsCollection,
  productBrandsCollection,
  categoriesCollection,
  productsCollection,
  favoritesCollection,
  syncMetadataCollection,
} from '../database';
import { api } from '../services/api';

export interface SyncResult {
  success: boolean;
  error?: string;
  timestamp?: number;
}

// Convert server record to WatermelonDB format
function serverToLocal(table: string, record: any) {
  const base = {
    server_id: record.id,
    created_at: new Date(record.created_at).getTime(),
    updated_at: new Date(record.updated_at).getTime(),
  };

  switch (table) {
    case 'car_brands':
      return {
        ...base,
        name: record.name,
        name_ar: record.name_ar,
        logo: record.logo,
      };
    case 'car_models':
      return {
        ...base,
        brand_id: record.brand_id,
        name: record.name,
        name_ar: record.name_ar,
        year_start: record.year_start,
        year_end: record.year_end,
        image_url: record.image_url,
        description: record.description,
        description_ar: record.description_ar,
        variants: record.variants ? JSON.stringify(record.variants) : null,
      };
    case 'product_brands':
      return {
        ...base,
        name: record.name,
        name_ar: record.name_ar,
        logo: record.logo,
        country_of_origin: record.country_of_origin,
        country_of_origin_ar: record.country_of_origin_ar,
      };
    case 'categories':
      return {
        ...base,
        name: record.name,
        name_ar: record.name_ar,
        parent_id: record.parent_id,
        icon: record.icon,
        sort_order: record.sort_order || 0,
      };
    case 'products':
      return {
        ...base,
        name: record.name,
        name_ar: record.name_ar,
        description: record.description,
        description_ar: record.description_ar,
        price: record.price,
        sku: record.sku,
        product_brand_id: record.product_brand_id,
        category_id: record.category_id,
        image_url: record.image_url,
        images: record.images ? JSON.stringify(record.images) : null,
        car_model_ids: record.car_model_ids ? JSON.stringify(record.car_model_ids) : null,
        stock_quantity: record.stock_quantity || 0,
        hidden_status: record.hidden_status || false,
      };
    case 'favorites':
      return {
        ...base,
        user_id: record.user_id,
        product_id: record.product_id,
      };
    default:
      return base;
  }
}

// Get last sync timestamp for a table
async function getLastPulledAt(tableName: string): Promise<number> {
  try {
    const metadata = await syncMetadataCollection
      .query()
      .fetch();
    const tableMetadata = metadata.find((m: any) => m.tableName === tableName);
    return tableMetadata?.lastPulledAt || 0;
  } catch (error) {
    console.error('Error getting last pulled at:', error);
    return 0;
  }
}

// Update last sync timestamp for a table
async function setLastPulledAt(tableName: string, timestamp: number): Promise<void> {
  await database.write(async () => {
    const metadata = await syncMetadataCollection
      .query()
      .fetch();
    const existing = metadata.find((m: any) => m.tableName === tableName);

    if (existing) {
      await existing.update((record: any) => {
        record.lastPulledAt = timestamp;
      });
    } else {
      await syncMetadataCollection.create((record: any) => {
        record.tableName = tableName;
        record.lastPulledAt = timestamp;
      });
    }
  });
}

// Pull changes from server
async function pullChanges(tables: string[] = ['car_brands', 'car_models', 'product_brands', 'categories', 'products']): Promise<{
  changes: any;
  timestamp: number;
}> {
  // Get minimum last_pulled_at across all tables
  const lastPulledAts = await Promise.all(
    tables.map(async (table) => ({
      table,
      lastPulledAt: await getLastPulledAt(table),
    }))
  );
  
  const minLastPulledAt = Math.min(...lastPulledAts.map((l) => l.lastPulledAt));

  try {
    const response = await api.post('/sync/pull', {
      last_pulled_at: minLastPulledAt,
      tables,
    });

    const { changes: serverChanges, timestamp } = response.data;
    
    // Transform server changes to WatermelonDB format
    const changes: any = {};
    
    for (const table of tables) {
      const tableChanges = serverChanges[table] || { created: [], updated: [], deleted: [] };
      
      changes[table] = {
        created: tableChanges.created.map((record: any) => serverToLocal(table, record)),
        updated: tableChanges.updated.map((record: any) => ({
          ...serverToLocal(table, record),
          id: record.id, // Use server ID as local ID for updates
        })),
        deleted: tableChanges.deleted,
      };
    }

    return { changes, timestamp };
  } catch (error) {
    console.error('Pull changes error:', error);
    throw error;
  }
}

// Push local changes to server
async function pushChanges(changes: any): Promise<void> {
  const pushData: any = { changes: {} };
  
  // Only push user-specific tables (favorites, cart items will be handled differently)
  const pushableTables = ['favorites'];
  
  for (const table of pushableTables) {
    if (changes[table]) {
      pushData.changes[table] = {
        created: changes[table].created || [],
        updated: changes[table].updated || [],
        deleted: changes[table].deleted || [],
      };
    }
  }

  try {
    await api.post('/sync/push', pushData);
  } catch (error) {
    console.error('Push changes error:', error);
    throw error;
  }
}

// Main sync function
export async function syncDatabase(): Promise<SyncResult> {
  const tables = ['car_brands', 'car_models', 'product_brands', 'categories', 'products'];
  
  try {
    // Pull changes
    const { changes, timestamp } = await pullChanges(tables);
    
    // Apply changes to local database
    await database.write(async () => {
      for (const table of tables) {
        const tableChanges = changes[table];
        if (!tableChanges) continue;

        const collection = getCollectionByName(table);
        if (!collection) continue;

        // Handle created records
        for (const record of tableChanges.created) {
          try {
            // Check if record already exists by server_id
            const existing = await collection
              .query()
              .fetch();
            const existingRecord = existing.find((r: any) => r.serverId === record.server_id);
            
            if (!existingRecord) {
              await collection.create((newRecord: any) => {
                Object.keys(record).forEach((key) => {
                  if (key !== 'id') {
                    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                    newRecord[camelKey] = record[key];
                  }
                });
              });
            }
          } catch (e) {
            console.warn(`Error creating ${table} record:`, e);
          }
        }

        // Handle updated records
        for (const record of tableChanges.updated) {
          try {
            const existing = await collection
              .query()
              .fetch();
            const existingRecord = existing.find((r: any) => r.serverId === record.server_id);
            
            if (existingRecord) {
              await existingRecord.update((r: any) => {
                Object.keys(record).forEach((key) => {
                  if (key !== 'id' && key !== 'server_id') {
                    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
                    r[camelKey] = record[key];
                  }
                });
              });
            }
          } catch (e) {
            console.warn(`Error updating ${table} record:`, e);
          }
        }

        // Handle deleted records
        for (const serverId of tableChanges.deleted) {
          try {
            const existing = await collection
              .query()
              .fetch();
            const existingRecord = existing.find((r: any) => r.serverId === serverId);
            
            if (existingRecord) {
              await existingRecord.markAsDeleted();
            }
          } catch (e) {
            console.warn(`Error deleting ${table} record:`, e);
          }
        }
      }
    });

    // Update sync timestamps
    for (const table of tables) {
      await setLastPulledAt(table, timestamp);
    }

    return { success: true, timestamp };
  } catch (error: any) {
    console.error('Sync error:', error);
    return { success: false, error: error.message || 'Sync failed' };
  }
}

// Get collection by table name
function getCollectionByName(tableName: string) {
  switch (tableName) {
    case 'car_brands':
      return carBrandsCollection;
    case 'car_models':
      return carModelsCollection;
    case 'product_brands':
      return productBrandsCollection;
    case 'categories':
      return categoriesCollection;
    case 'products':
      return productsCollection;
    case 'favorites':
      return favoritesCollection;
    default:
      return null;
  }
}

// Initial data load (for first app launch)
export async function initialSync(): Promise<SyncResult> {
  console.log('Starting initial sync...');
  return syncDatabase();
}

// Check if database has data
export async function hasLocalData(): Promise<boolean> {
  try {
    const products = await productsCollection.query().fetch();
    return products.length > 0;
  } catch (error) {
    return false;
  }
}

// Export sync status types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
