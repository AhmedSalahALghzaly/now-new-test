/**
 * FavoritesTab - Favorites list display tab
 * Shows user's favorite products with actions
 * FIXED: Proper scroll handling - items are touchable and scrollable
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState } from '../ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { NEON_NIGHT_THEME } from '../../store/appStore';

interface FavoritesTabProps {
  favorites: any[];
  isRTL: boolean;
  isAdminView: boolean;
  onAddToCart: (product: any) => void;
  onToggleFavorite: (productId: string) => void;
}

export const FavoritesTab: React.FC<FavoritesTabProps> = ({
  favorites,
  isRTL,
  isAdminView,
  onAddToCart,
  onToggleFavorite,
}) => {
  const { colors } = useTheme();
  const { language } = useTranslation();
  const router = useRouter();

  const safeFavorites = Array.isArray(favorites) ? favorites : [];

  // Render each favorite item - using regular map instead of FlashList
  // This allows proper scroll propagation to parent ScrollView
  const renderFavoriteItem = (item: any, index: number) => (
    <Pressable
      key={item.product_id || item.id || index}
      style={({ pressed }) => [
        styles.productCard,
        { borderColor: colors.border },
        pressed && { opacity: 0.7, backgroundColor: colors.surface }
      ]}
      onPress={() => router.push(`/product/${item.product_id || item.product?.id}`)}
    >
      <View style={[styles.productThumb, { backgroundColor: colors.surface }]}>
        {item.product?.image_url ? (
          <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
        ) : (
          <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
          {language === 'ar' ? item.product?.name_ar : item.product?.name}
        </Text>
        {item.product?.sku && (
          <Text style={[styles.productSku, { color: colors.textSecondary }]}>
            SKU: {item.product.sku}
          </Text>
        )}
        <Text style={[styles.productPrice, { color: NEON_NIGHT_THEME.primary }]}>
          {item.product?.price?.toFixed(0)} ج.م
        </Text>
      </View>

      <View style={styles.productActions}>
        <Pressable
          style={({ pressed }) => [
            styles.iconActionBtn,
            { backgroundColor: NEON_NIGHT_THEME.primary },
            pressed && { opacity: 0.7 }
          ]}
          onPress={() => onAddToCart(item.product)}
        >
          <Ionicons name="cart-outline" size={18} color="#FFF" />
        </Pressable>
        {!isAdminView && (
          <Pressable
            style={({ pressed }) => [
              styles.iconActionBtn,
              { backgroundColor: '#EF4444' },
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => onToggleFavorite(item.product_id || item.product?.id)}
          >
            <Ionicons name="heart-dislike-outline" size={18} color="#FFF" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {language === 'ar' ? 'المنتجات المفضلة' : 'Favorite Products'}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
          <Text style={styles.countBadgeText}>{safeFavorites.length}</Text>
        </View>
      </View>

      {safeFavorites.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title={language === 'ar' ? 'لا توجد منتجات مفضلة' : 'No favorites yet'}
        />
      ) : (
        <View style={styles.listContainer}>
          {safeFavorites.map(renderFavoriteItem)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  listContainer: {
    minHeight: 50,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: 56,
    height: 56,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 11,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FavoritesTab;
