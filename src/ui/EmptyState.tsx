import { Ionicons } from '@/ui/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import type { IconName } from '@/ui/icons';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  testID?: string;
}

export function EmptyState({ icon, title, body, action, testID }: EmptyStateProps) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={iconSize.lg} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? (
        <Button label={action.label} onPress={action.onPress} testID={action.testID} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  iconWrap: {
    width: iconSize.xl + spacing.md,
    height: iconSize.xl + spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
