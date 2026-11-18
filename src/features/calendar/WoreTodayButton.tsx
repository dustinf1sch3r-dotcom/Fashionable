import { StyleSheet, View } from 'react-native';
import type { ID } from '@/core/model/types';
import { Button, type ButtonVariant } from '@/ui/Button';
import { spacing } from '@/ui/theme';
import { useWoreToday } from './useWoreToday';

interface WoreTodayButtonProps {
  itemIds: readonly ID[];
  /** Set when the pieces are exactly a saved outfit. */
  outfitId?: ID;
  /** Suffix for the testIDs, e.g. `outfit` gives `wore-today-outfit`. */
  context: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}

/** "Wore this today" with its confirmation (Undo) and the Replace / Add another sheet. */
export function WoreTodayButton({
  itemIds,
  outfitId,
  context,
  variant = 'secondary',
  disabled,
}: WoreTodayButtonProps) {
  const { request, element } = useWoreToday(context);
  return (
    <View style={styles.wrap}>
      <Button
        label="Wore this today"
        icon="checkmark-circle-outline"
        variant={variant}
        disabled={disabled || itemIds.length === 0}
        onPress={() => request([...itemIds], outfitId)}
        testID={`wore-today-${context}`}
      />
      {element}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.sm } });
