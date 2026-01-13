/**
 * CartTab - Shopping cart display and management tab
 * Shows cart items with quantity controls and order summary
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlassCard } from '../ui/GlassCard';
import { EmptyState } from '../ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { NEON_NIGHT_THEME } from '../../store/appStore';

const SHIPPING_COST = 150;

interface CartTabProps {
  cartItems: any[];
  isRTL: boolean;
  getSubtotal: () => number;
  getOriginalTotal: () => number;
  getTotalSavings: () => number;
  getItemCount: () => number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

export const CartTab: React.FC<CartTabProps> = ({
  cartItems,
  isRTL,
  getSubtotal,
  getOriginalTotal,
  getTotalSavings,
  getItemCount,
  onUpdateQuantity,
  onRemove,
  onCheckout,
}) => {
  const { colors } = useTheme();
  const { language } = useTranslation();
  const router = useRouter();

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];

  return (
    <>
      <GlassCard>
        <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
          </Text>
          <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
            <Text style={styles.countBadgeText}>{getItemCount()}</Text>
          </View>
        </View>

        {safeCartItems.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title={language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}
            actionLabel={language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
            onAction={() => router.push('/')}
          />
        ) : (
          safeCartItems.map((item, index) => {
            const originalPrice = item.original_unit_price || item.product?.price || 0;
            const finalPrice = item.final_unit_price || item.product?.price || 0;
            const hasDiscount = originalPrice > finalPrice;
            const lineTotal = finalPrice * item.quantity;

            return (
              <View key={item.product_id || index} style={[styles.cartItem, { borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.productThumb, { backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/product/${item.product_id}`)}
                >
                  {item.product?.image_url ? (
                    <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
                  ) : (
                    <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
                  )}
                  {item.bundle_group_id && (
                    <View style={[styles.bundleBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
                      <Ionicons name="gift" size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.cartItemInfo}>
                  <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                    {language === 'ar' ? item.product?.name_ar : item.product?.name}
                  </Text>
                  {item.product?.sku && (
                    <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                      SKU: {item.product.sku}
                    </Text>
                  )}

                  <View style={[styles.priceRow, isRTL && styles.rowReverse]}>
                    {hasDiscount && (
                      <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                        {originalPrice.toFixed(0)} ج.م
                      </Text>
                    )}
                    <Text style={[styles.finalPrice, { color: NEON_NIGHT_THEME.primary }]}>
                      {finalPrice.toFixed(0)} ج.م
                    </Text>
                    {hasDiscount && (
                      <View style={[styles.discountTag, { backgroundColor: '#10B981' }]}>
                        <Text style={styles.discountTagText}>
                          -{Math.round(((originalPrice - finalPrice) / originalPrice) * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.quantityRow, isRTL && styles.rowReverse]}>
                    <View style={[styles.quantityControls, { borderColor: colors.border }]}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.removeBtn, { borderColor: '#EF4444' }]}
                      onPress={() => onRemove(item.product_id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.lineTotal, { color: colors.text }]}>
                    {language === 'ar' ? 'الإجمالي:' : 'Total:'} {lineTotal.toFixed(0)} ج.م
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </GlassCard>

      {/* Order Summary */}
      {safeCartItems.length > 0 && (
        <GlassCard style={{ marginTop: 12 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
            {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
          </Text>

          {getTotalSavings() > 0 && (
            <>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'المجموع الأصلي' : 'Original Total'}
                </Text>
                <Text style={[styles.summaryValueStrike, { color: colors.textSecondary }]}>
                  {getOriginalTotal().toFixed(0)} ج.م
                </Text>
              </View>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <View style={[styles.savingsRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="sparkles" size={16} color="#10B981" />
                  <Text style={[styles.savingsLabel, { color: '#10B981' }]}>
                    {language === 'ar' ? 'التوفير' : 'You Save'}
                  </Text>
                </View>
                <Text style={[styles.savingsValue, { color: '#10B981' }]}>
                  -{getTotalSavings().toFixed(0)} ج.م
                </Text>
              </View>
            </>
          )}

          <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {getSubtotal().toFixed(0)} ج.م
            </Text>
          </View>

          <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الشحن' : 'Shipping'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {SHIPPING_COST.toFixed(0)} ج.م
            </Text>
          </View>

          <View style={[styles.totalRow, { borderTopColor: colors.border }, isRTL && styles.rowReverse]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              {language === 'ar' ? 'الإجمالي' : 'Total'}
            </Text>
            <Text style={[styles.totalValue, { color: NEON_NIGHT_THEME.primary }]}>
              {(getSubtotal() + SHIPPING_COST).toFixed(0)} ج.م
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
            onPress={onCheckout}
          >
            <Ionicons name="card-outline" size={20} color="#FFF" />
            <Text style={styles.checkoutBtnText}>
              {language === 'ar' ? 'المتابعة للدفع' : 'Proceed to Checkout'}
            </Text>
            <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
          </TouchableOpacity>
        </GlassCard>
      )}
    </>
  );
};

const styles = StyleSheet.create({
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
  cartItem: {
    flexDirection: 'row',
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
  bundleBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemInfo: {
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  discountTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  removeBtn: {
    padding: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  lineTotal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValueStrike: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CartTab;
