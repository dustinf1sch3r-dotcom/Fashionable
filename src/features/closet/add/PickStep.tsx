import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES } from '@/core/model/taxonomy';
import type { Category } from '@/core/model/types';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { colors, spacing, typography } from '@/ui/theme';
import { CATEGORY_LABELS } from '../labels';
import { CaptureGuide } from './CaptureGuide';

interface PickStepProps {
  /** What the user says they are adding; pre-selects the category in the tag form. */
  kind: Category;
  onKindChange: (kind: Category) => void;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  error: string | null;
}

export function PickStep({ kind, onKindChange, onTakePhoto, onChoosePhoto, error }: PickStepProps) {
  return (
    <View style={styles.wrap} testID="add-item-pick">
      <View style={styles.kinds}>
        <Text style={styles.label}>What are you adding?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel="What are you adding?"
          testID="add-item-kind"
        >
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={CATEGORY_LABELS[category]}
              role="radio"
              selected={kind === category}
              onPress={() => onKindChange(category)}
              testID={`add-item-kind-${category}`}
            />
          ))}
        </ScrollView>
      </View>
      <CaptureGuide category={kind} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  kinds: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  error: { ...typography.label, color: colors.danger },
});
