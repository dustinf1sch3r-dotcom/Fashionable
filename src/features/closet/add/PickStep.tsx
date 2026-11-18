import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { colors, spacing, typography } from '@/ui/theme';

const TIPS = [
  'Use a plain, contrasting background.',
  'Lay the piece flat or hang it up.',
  'Shoot straight on, from above.',
];

interface PickStepProps {
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  error: string | null;
}

export function PickStep({ onTakePhoto, onChoosePhoto, error }: PickStepProps) {
  return (
    <View style={styles.wrap} testID="add-item-pick">
      <Text style={styles.lead}>Snap it, confirm the colour, tap a few tags. Done.</Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error} testID="add-item-error">
          {'⚠ '}
          {error}
        </Text>
      ) : null}
      <Button
        label="Take photo"
        icon="camera-outline"
        size="lg"
        onPress={onTakePhoto}
        testID="add-item-take-photo"
      />
      <Button
        label="Choose from library"
        icon="images-outline"
        variant="secondary"
        size="lg"
        onPress={onChoosePhoto}
        testID="add-item-choose-photo"
      />
      <Card testID="add-item-tips">
        <Text style={styles.tipsTitle}>For the best result</Text>
        {TIPS.map((tip) => (
          <Text key={tip} style={styles.tip}>
            {'• '}
            {tip}
          </Text>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  lead: { ...typography.body, color: colors.textMuted },
  error: { ...typography.label, color: colors.danger },
  tipsTitle: { ...typography.label, color: colors.text },
  tip: { ...typography.body, color: colors.textMuted },
});
