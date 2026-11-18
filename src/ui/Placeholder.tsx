import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';

interface PlaceholderProps {
  title: string;
  testID: string;
}

export function Placeholder({ title, testID }: PlaceholderProps) {
  return (
    <Screen title={title} testID={testID}>
      <Text style={styles.muted}>Coming soon</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 16, color: colors.textMuted },
});
