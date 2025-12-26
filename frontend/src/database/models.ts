/**
 * WatermelonDB Models for Al-Ghazaly Auto Parts
 * Each model represents a table in the local database
 */
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json, text } from '@nozbe/watermelondb/decorators';

// Car Brand Model
export class CarBrand extends Model {
  static table = 'car_brands';

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('name_ar') nameAr!: string;
  @field('logo') logo?: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

// Car Model Model
export class CarModel extends Model {
  static table = 'car_models';

  @field('server_id') serverId!: string;
  @field('brand_id') brandId!: string;
  @field('name') name!: string;
  @field('name_ar') nameAr!: string;
  @field('year_start') yearStart?: number;
  @field('year_end') yearEnd?: number;
  @field('image_url') imageUrl?: string;
  @field('description') description?: string;
  @field('description_ar') descriptionAr?: string;
  @text('variants') variants?: string; // JSON string
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  get variantsParsed(): any[] {
    try {
      return this.variants ? JSON.parse(this.variants) : [];
    } catch {
      return [];
    }
  }
}

// Product Brand Model
export class ProductBrand extends Model {
  static table = 'product_brands';

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('name_ar') nameAr?: string;
  @field('logo') logo?: string;
  @field('country_of_origin') countryOfOrigin?: string;
  @field('country_of_origin_ar') countryOfOriginAr?: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

// Category Model
export class Category extends Model {
  static table = 'categories';

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('name_ar') nameAr!: string;
  @field('parent_id') parentId?: string;
  @field('icon') icon?: string;
  @field('sort_order') sortOrder!: number;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

// Product Model
export class Product extends Model {
  static table = 'products';

  @field('server_id') serverId!: string;
  @field('name') name!: string;
  @field('name_ar') nameAr!: string;
  @field('description') description?: string;
  @field('description_ar') descriptionAr?: string;
  @field('price') price!: number;
  @field('sku') sku!: string;
  @field('product_brand_id') productBrandId?: string;
  @field('category_id') categoryId?: string;
  @field('image_url') imageUrl?: string;
  @text('images') images?: string; // JSON array
  @text('car_model_ids') carModelIds?: string; // JSON array
  @field('stock_quantity') stockQuantity!: number;
  @field('hidden_status') hiddenStatus!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  get imagesParsed(): string[] {
    try {
      return this.images ? JSON.parse(this.images) : [];
    } catch {
      return [];
    }
  }

  get carModelIdsParsed(): string[] {
    try {
      return this.carModelIds ? JSON.parse(this.carModelIds) : [];
    } catch {
      return [];
    }
  }
}

// Favorite Model
export class Favorite extends Model {
  static table = 'favorites';

  @field('server_id') serverId?: string;
  @field('user_id') userId!: string;
  @field('product_id') productId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

// Cart Item Model (local-only until checkout)
export class CartItem extends Model {
  static table = 'cart_items';

  @field('product_id') productId!: string;
  @field('quantity') quantity!: number;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}

// Sync Metadata Model
export class SyncMetadata extends Model {
  static table = 'sync_metadata';

  @field('table_name') tableName!: string;
  @field('last_pulled_at') lastPulledAt!: number;
}
