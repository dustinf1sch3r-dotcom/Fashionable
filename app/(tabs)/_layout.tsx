import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { colors } from '@/ui/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Closet', icon: 'shirt-outline' },
  { name: 'outfits', title: 'Outfits', icon: 'albums-outline' },
  { name: 'mix', title: 'Mix', icon: 'shuffle-outline' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-outline' },
  { name: 'profile', title: 'Profile', icon: 'person-outline' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ focused, size }) => (
              <Ionicons
                name={icon}
                size={size}
                color={focused ? colors.accent : colors.textMuted}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
