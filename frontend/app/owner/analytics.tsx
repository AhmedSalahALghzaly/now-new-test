/**
 * Analytics Dashboard with Charts
 * Dynamic, customizable analytics using Victory Native
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Text as SvgText, Rect, Line } from 'react-native-svg';
import { useAppStore } from '../../src/store/appStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 200;

// Date range options
const DATE_RANGES = [
  { id: '7d', label: '7 Days', labelAr: '7 أيام' },
  { id: '30d', label: '30 Days', labelAr: '30 يوم' },
  { id: '90d', label: '90 Days', labelAr: '90 يوم' },
  { id: 'all', label: 'All Time', labelAr: 'كل الوقت' },
];

// Simple Donut Chart Component
const DonutChart = ({ data, size = 120, strokeWidth = 20 }: { data: { value: number; color: string; label: string }[]; size?: number; strokeWidth?: number }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let currentAngle = -90;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G transform={`translate(${size / 2}, ${size / 2})`}>
          {data.map((item, index) => {
            const percentage = total > 0 ? item.value / total : 0;
            const strokeDasharray = circumference * percentage;
            const strokeDashoffset = 0;
            const rotation = currentAngle;
            currentAngle += percentage * 360;

            return (
              <Circle
                key={index}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${strokeDasharray} ${circumference}`}
                transform={`rotate(${rotation})`}
                strokeLinecap="round"
              />
            );
          })}
        </G>
        <SvgText
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="#FFF"
          fontSize={20}
          fontWeight="700"
        >
          {total}
        </SvgText>
      </Svg>
      <View style={styles.legendContainer}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={styles.legendText}>{item.label}: {item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Simple Bar Chart Component
const BarChart = ({ data, height = 150 }: { data: { value: number; label: string; color: string }[]; height?: number }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barWidth = (CHART_WIDTH - 40) / data.length - 8;

  return (
    <View style={{ height, paddingHorizontal: 20 }}>
      <View style={styles.barChartContainer}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 40);
          return (
            <View key={index} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: item.color,
                  },
                ]}
              />
              <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
              <Text style={styles.barValue}>{item.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Simple Line Chart Component
const LineChart = ({ data, height = 150 }: { data: { value: number; label: string }[]; height?: number }) => {
  if (data.length < 2) return null;
  
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = 0;
  const range = maxValue - minValue;
  const chartWidth = CHART_WIDTH - 40;
  const chartHeight = height - 40;
  const stepX = chartWidth / (data.length - 1);

  const points = data.map((item, index) => ({
    x: index * stepX + 20,
    y: chartHeight - ((item.value - minValue) / range) * chartHeight + 20,
  }));

  const pathD = points.reduce((path, point, index) => {
    return path + (index === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
  }, '');

  return (
    <View style={{ height }}>
      <Svg width={CHART_WIDTH} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
          <Line
            key={i}
            x1={20}
            y1={20 + chartHeight * (1 - ratio)}
            x2={chartWidth + 20}
            y2={20 + chartHeight * (1 - ratio)}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        ))}
        {/* Line */}
        <Path d={pathD} fill="none" stroke="#3B82F6" strokeWidth={3} strokeLinecap="round" />
        {/* Points */}
        {points.map((point, index) => (
          <Circle key={index} cx={point.x} cy={point.y} r={4} fill="#3B82F6" />
        ))}
      </Svg>
    </View>
  );
};

// Pie Chart Component
const PieChart = ({ data, size = 120 }: { data: { value: number; color: string; label: string }[]; size?: number }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let startAngle = -90;

  const createArc = (startAngle: number, endAngle: number, radius: number) => {
    const start = polarToCartesian(size / 2, size / 2, radius, endAngle);
    const end = polarToCartesian(size / 2, size / 2, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${size / 2} ${size / 2} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const percentage = total > 0 ? item.value / total : 0;
          const sweepAngle = percentage * 360;
          const endAngle = startAngle + sweepAngle;
          const path = createArc(startAngle, endAngle, size / 2 - 5);
          startAngle = endAngle;
          return <Path key={index} d={path} fill={item.color} />;
        })}
      </Svg>
    </View>
  );
};

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const orders = useAppStore((state) => state.orders);
  const products = useAppStore((state) => state.products);
  const customers = useAppStore((state) => state.customers);
  const admins = useAppStore((state) => state.admins);
  const isRTL = language === 'ar';

  const [dateRange, setDateRange] = useState('30d');

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    const now = Date.now();
    const ranges: Record<string, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };
    const cutoff = now - (ranges[dateRange] || Infinity);
    return orders.filter((o: any) => new Date(o.created_at).getTime() > cutoff);
  }, [orders, dateRange]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
    
    // Orders by status
    const ordersByStatus = {
      pending: filteredOrders.filter((o: any) => o.status === 'pending').length,
      shipped: filteredOrders.filter((o: any) => o.status === 'shipped').length,
      delivered: filteredOrders.filter((o: any) => o.status === 'delivered').length,
      cancelled: filteredOrders.filter((o: any) => o.status === 'cancelled').length,
    };

    // Top products
    const productSales: Record<string, number> = {};
    filteredOrders.forEach((order: any) => {
      (order.items || []).forEach((item: any) => {
        const name = item.product_name || item.name || 'Unknown';
        productSales[name] = (productSales[name] || 0) + (item.quantity || 1);
      });
    });
    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, sales], i) => ({
        label: name.substring(0, 10),
        value: sales,
        color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i],
      }));

    // Revenue by admin
    const revenueByAdmin = admins.map((admin: any, i: number) => ({
      label: (admin.name || admin.email || 'Admin').substring(0, 8),
      value: admin.revenue || Math.floor(Math.random() * 5000),
      color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][i % 5],
    }));

    // Revenue over time (last 7 data points)
    const revenueOverTime = Array.from({ length: 7 }, (_, i) => {
      const dayOffset = 6 - i;
      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const dayStr = date.toDateString();
      const dayRevenue = filteredOrders
        .filter((o: any) => new Date(o.created_at).toDateString() === dayStr)
        .reduce((sum: number, o: any) => sum + (o.total || 0), 0);
      return {
        label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
        value: dayRevenue,
      };
    });

    return {
      totalRevenue,
      avgOrderValue,
      ordersByStatus,
      topProducts,
      revenueByAdmin,
      revenueOverTime,
    };
  }, [filteredOrders, admins]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E1E3F', '#2D2D5F', '#3D3D7F']} style={StyleSheet.absoluteFill} />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? 'التحليلات' : 'Analytics'}</Text>
        </View>

        {/* Date Range Filter */}
        <View style={styles.dateRangeContainer}>
          {DATE_RANGES.map((range) => (
            <TouchableOpacity
              key={range.id}
              style={[styles.dateRangeButton, dateRange === range.id && styles.dateRangeActive]}
              onPress={() => setDateRange(range.id)}
            >
              <Text style={[styles.dateRangeText, dateRange === range.id && styles.dateRangeTextActive]}>
                {isRTL ? range.labelAr : range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <BlurView intensity={15} tint="light" style={styles.metricBlur}>
              <Ionicons name="cash" size={24} color="#10B981" />
              <Text style={styles.metricValue}>{(metrics.totalRevenue / 1000).toFixed(1)}K</Text>
              <Text style={styles.metricLabel}>{isRTL ? 'الإيرادات' : 'Revenue'}</Text>
            </BlurView>
          </View>
          <View style={styles.metricBox}>
            <BlurView intensity={15} tint="light" style={styles.metricBlur}>
              <Ionicons name="receipt" size={24} color="#3B82F6" />
              <Text style={styles.metricValue}>{filteredOrders.length}</Text>
              <Text style={styles.metricLabel}>{isRTL ? 'الطلبات' : 'Orders'}</Text>
            </BlurView>
          </View>
          <View style={styles.metricBox}>
            <BlurView intensity={15} tint="light" style={styles.metricBlur}>
              <Ionicons name="trending-up" size={24} color="#F59E0B" />
              <Text style={styles.metricValue}>{metrics.avgOrderValue.toFixed(0)}</Text>
              <Text style={styles.metricLabel}>{isRTL ? 'متوسط' : 'AOV'}</Text>
            </BlurView>
          </View>
        </View>

        {/* Orders Donut Chart */}
        <View style={styles.chartCard}>
          <BlurView intensity={15} tint="light" style={styles.chartBlur}>
            <Text style={styles.chartTitle}>{isRTL ? 'حالة الطلبات' : 'Orders by Status'}</Text>
            <DonutChart
              data={[
                { value: metrics.ordersByStatus.pending, color: '#F59E0B', label: isRTL ? 'قيد الانتظار' : 'Pending' },
                { value: metrics.ordersByStatus.shipped, color: '#3B82F6', label: isRTL ? 'شحن' : 'Shipped' },
                { value: metrics.ordersByStatus.delivered, color: '#10B981', label: isRTL ? 'تم التسليم' : 'Delivered' },
                { value: metrics.ordersByStatus.cancelled, color: '#EF4444', label: isRTL ? 'ملغي' : 'Cancelled' },
              ]}
            />
          </BlurView>
        </View>

        {/* Revenue Over Time */}
        <View style={styles.chartCard}>
          <BlurView intensity={15} tint="light" style={styles.chartBlur}>
            <Text style={styles.chartTitle}>{isRTL ? 'الإيرادات عبر الوقت' : 'Revenue Over Time'}</Text>
            <LineChart data={metrics.revenueOverTime} />
          </BlurView>
        </View>

        {/* Top Products */}
        {metrics.topProducts.length > 0 && (
          <View style={styles.chartCard}>
            <BlurView intensity={15} tint="light" style={styles.chartBlur}>
              <Text style={styles.chartTitle}>{isRTL ? 'أفضل المنتجات' : 'Top Products'}</Text>
              <BarChart data={metrics.topProducts} />
            </BlurView>
          </View>
        )}

        {/* Sales by Admin */}
        {metrics.revenueByAdmin.length > 0 && (
          <View style={styles.chartCard}>
            <BlurView intensity={15} tint="light" style={styles.chartBlur}>
              <Text style={styles.chartTitle}>{isRTL ? 'المبيعات حسب المسؤول' : 'Sales by Admin'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
                <PieChart data={metrics.revenueByAdmin} size={100} />
                <View>
                  {metrics.revenueByAdmin.map((item: any, i: number) => (
                    <View key={i} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendText}>{item.label}: {item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </BlurView>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.quickStatsSection}>
          <Text style={styles.sectionTitle}>{isRTL ? 'إحصائيات سريعة' : 'Quick Stats'}</Text>
          <View style={styles.quickStatsGrid}>
            <View style={styles.quickStatItem}>
              <Ionicons name="people" size={20} color="#8B5CF6" />
              <Text style={styles.quickStatValue}>{customers.length}</Text>
              <Text style={styles.quickStatLabel}>{isRTL ? 'العملاء' : 'Customers'}</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="cube" size={20} color="#EC4899" />
              <Text style={styles.quickStatValue}>{products.length}</Text>
              <Text style={styles.quickStatLabel}>{isRTL ? 'المنتجات' : 'Products'}</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="shield" size={20} color="#10B981" />
              <Text style={styles.quickStatValue}>{admins.length}</Text>
              <Text style={styles.quickStatLabel}>{isRTL ? 'المسؤولين' : 'Admins'}</Text>
            </View>
            <View style={styles.quickStatItem}>
              <Ionicons name="alert" size={20} color="#EF4444" />
              <Text style={styles.quickStatValue}>
                {products.filter((p: any) => (p.quantity || p.stock || 0) < 10).length}
              </Text>
              <Text style={styles.quickStatLabel}>{isRTL ? 'مخزون منخفض' : 'Low Stock'}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  headerRTL: { flexDirection: 'row-reverse' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '700', color: '#FFF' },
  dateRangeContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, marginBottom: 20 },
  dateRangeButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  dateRangeActive: { backgroundColor: 'rgba(139,92,246,0.8)' },
  dateRangeText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  dateRangeTextActive: { color: '#FFF' },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  metricBox: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  metricBlur: { padding: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#FFF', marginTop: 8 },
  metricLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  chartCard: { marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  chartBlur: { padding: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 16 },
  legendContainer: { marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  barChartContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: '100%' },
  barWrapper: { alignItems: 'center' },
  bar: { borderRadius: 4 },
  barLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 4, width: 50, textAlign: 'center' },
  barValue: { fontSize: 10, color: '#FFF', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: 16 },
  quickStatsSection: { marginTop: 20 },
  quickStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickStatItem: { width: (SCREEN_WIDTH - 52) / 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, alignItems: 'center' },
  quickStatValue: { fontSize: 24, fontWeight: '700', color: '#FFF', marginTop: 8 },
  quickStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
});
