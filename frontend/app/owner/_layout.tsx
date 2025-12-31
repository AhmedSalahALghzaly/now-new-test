/**
 * Owner Interface Layout
 * Wraps all owner screens with consistent styling
 */
import React from 'react';
import { Stack } from 'expo-router';

export default function OwnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="customers" />
      <Stack.Screen name="admins" />
      <Stack.Screen name="collection" />
      <Stack.Screen name="subscriptions" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="suppliers" />
      <Stack.Screen name="distributors" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="orders" />
    </Stack>
  );
}
