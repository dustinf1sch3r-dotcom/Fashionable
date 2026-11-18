import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, minTouch, spacing, typography } from '@/ui/theme';

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void; testID?: string };
  testID?: string;
}

export function SectionHeader({ title, action, testID }: SectionHeaderProps) {
  return (
    <View style={styles.row} testID={testID}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          testID={action.testID}
          style={styles.action}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: minTouch,
  },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  action: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionLabel: { ...typography.label, color: colors.accent },
});
