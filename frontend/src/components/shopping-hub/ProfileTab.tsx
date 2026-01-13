/**
 * ProfileTab - Profile information display tab
 * Shows user account details and quick stats
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '../ui/GlassCard';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { NEON_NIGHT_THEME } from '../../store/appStore';

interface ProfileTabProps {
  profileData: any;
  ordersCount: number;
  favoritesCount: number;
  cartItemsCount: number;
  isRTL: boolean;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profileData,
  ordersCount,
  favoritesCount,
  cartItemsCount,
  isRTL,
}) => {
  const { colors } = useTheme();
  const { language } = useTranslation();

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const detailRows = [
    {
      icon: 'person-outline',
      label: language === 'ar' ? 'الاسم' : 'Name',
      value: profileData?.name || '-',
      hasBorder: true,
    },
    {
      icon: 'mail-outline',
      label: language === 'ar' ? 'البريد الإلكتروني' : 'Email',
      value: profileData?.email || '-',
      hasBorder: true,
    },
    {
      icon: 'call-outline',
      label: language === 'ar' ? 'رقم الهاتف' : 'Phone',
      value: profileData?.phone || '-',
      hasBorder: true,
    },
    {
      icon: 'calendar-outline',
      label: language === 'ar' ? 'تاريخ الانضمام' : 'Joined',
      value: formatDate(profileData?.created_at),
      hasBorder: false,
    },
  ];

  return (
    <GlassCard>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {language === 'ar' ? 'معلومات الحساب' : 'Account Information'}
      </Text>

      <View style={styles.profileDetails}>
        {detailRows.map((row, index) => (
          <View
            key={index}
            style={[
              styles.detailRow,
              row.hasBorder && { borderBottomColor: colors.border },
              !row.hasBorder && { borderBottomWidth: 0 },
            ]}
          >
            <Ionicons
              name={row.icon as any}
              size={20}
              color={NEON_NIGHT_THEME.primary}
            />
            <View style={styles.detailInfo}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                {row.label}
              </Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {row.value}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Quick Stats */}
      <View style={[styles.statsGrid, { marginTop: 16 }]}>
        <View style={[styles.statCard, { backgroundColor: '#3B82F6' + '20' }]}>
          <Text style={[styles.statValue, { color: '#3B82F6' }]}>
            {ordersCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الطلبات' : 'Orders'}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#EF4444' + '20' }]}>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>
            {favoritesCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'المفضلة' : 'Favorites'}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10B981' + '20' }]}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>
            {cartItemsCount}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'السلة' : 'In Cart'}
          </Text>
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  profileDetails: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
});

export default ProfileTab;
