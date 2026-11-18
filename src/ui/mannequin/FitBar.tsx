import { Ionicons } from '@/ui/Ionicons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { FitAdjust } from '@/core/model/types';
import { Button } from '@/ui/Button';
import type { IconName } from '@/ui/icons';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { canStep, isIdentityFit, stepFit, type FitStep } from './fit';

interface FitBarProps {
  /** Name of the garment being adjusted. */
  title: string;
  /** The fit being shown on the mannequin right now. */
  fit: FitAdjust;
  onChange: (fit: FitAdjust) => void;
  /** Clears the adjustment (back to the default placement). */
  onReset: () => void;
  /** Writes the fit to the item itself, so every outfit gets it. Omit to hide the button. */
  onSaveItem?: () => void;
  /** Keeps the fit for the outfit being edited only. Omit to hide the button. */
  onSaveOutfit?: () => void;
  /** Whether the fit differs from what is saved (enables the save buttons). */
  dirty?: boolean;
  /** Short status such as "Saved for this item". */
  message?: string;
  onDone?: () => void;
  /** Root testID. */
  testID?: string;
  /** Prefix of the control testIDs (`fit-scale-up`, `fit-reset`, …). */
  idPrefix?: string;
}

interface StepButtonProps {
  step: FitStep;
  icon: IconName;
  label: string;
  fit: FitAdjust;
  onPress: (step: FitStep) => void;
  mirror?: boolean;
  id: string;
  testID: string;
}

function StepButton({ step, icon, label, fit, onPress, mirror, id, testID }: StepButtonProps) {
  const disabled = !canStep(fit, step);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onPress(step)}
      testID={`${testID}-${id}`}
      style={({ pressed }) => [styles.step, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons
        name={icon}
        size={iconSize.md}
        color={colors.text}
        style={mirror ? MIRROR : undefined}
      />
    </Pressable>
  );
}

const MIRROR: ViewStyle = { transform: [{ scaleX: -1 }] };

/**
 * On-screen controls for the selected garment (docs/TRY_ON.md §6): the only way to fit-adjust
 * with a mouse, and a precise alternative to gestures on a phone. testIDs: `${testID}` root (default `fit-bar`); controls use `${idPrefix}`,
 * `-scale-down|up`, `-rotate-left|right`, `-nudge-up|down|left|right`, `-reset`, `-save-item`,
 * `-save-outfit`, `-done`, `-scale-value`, `-rotation-value`, `-message`.
 */
export function FitBar({
  title,
  fit,
  onChange,
  onReset,
  onSaveItem,
  onSaveOutfit,
  dirty = false,
  message,
  onDone,
  testID = 'fit-bar',
  idPrefix = 'fit',
}: FitBarProps) {
  const press = (step: FitStep) => onChange(stepFit(fit, step));
  const common = { fit, onPress: press, testID: idPrefix } as const;
  return (
    <View style={styles.root} testID={testID} accessibilityLabel={`Adjust fit: ${title}`}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {`Adjust: ${title}`}
        </Text>
        {onDone ? (
          <Button label="Done" variant="ghost" onPress={onDone} testID={`${idPrefix}-done`} />
        ) : null}
      </View>
      <View style={styles.controls}>
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Size</Text>
          <View style={styles.row}>
            <StepButton
              {...common}
              id="scale-down"
              step="scale-down"
              icon="remove"
              label="Smaller"
            />
            <Text style={styles.value} testID={`${idPrefix}-scale-value`}>
              {`${Math.round(fit.scale * 100)}%`}
            </Text>
            <StepButton {...common} id="scale-up" step="scale-up" icon="add" label="Larger" />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Tilt</Text>
          <View style={styles.row}>
            <StepButton
              {...common}
              id="rotate-left"
              step="rotate-left"
              icon="refresh"
              mirror
              label="Rotate left"
            />
            <Text style={styles.value} testID={`${idPrefix}-rotation-value`}>
              {`${fit.rotation}°`}
            </Text>
            <StepButton
              {...common}
              id="rotate-right"
              step="rotate-right"
              icon="refresh"
              label="Rotate right"
            />
          </View>
        </View>
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Move</Text>
          <View style={styles.row}>
            <StepButton
              {...common}
              id="nudge-left"
              step="left"
              icon="chevron-back"
              label="Move left"
            />
            <StepButton {...common} id="nudge-up" step="up" icon="chevron-up" label="Move up" />
            <StepButton
              {...common}
              id="nudge-down"
              step="down"
              icon="chevron-down"
              label="Move down"
            />
            <StepButton
              {...common}
              id="nudge-right"
              step="right"
              icon="chevron-forward"
              label="Move right"
            />
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Reset"
          variant="ghost"
          onPress={onReset}
          disabled={isIdentityFit(fit)}
          testID={`${idPrefix}-reset`}
        />
        {onSaveOutfit ? (
          <Button
            label="Just this outfit"
            variant="secondary"
            onPress={onSaveOutfit}
            disabled={!dirty}
            testID={`${idPrefix}-save-outfit`}
          />
        ) : null}
        {onSaveItem ? (
          <Button
            label="Save for this item"
            onPress={onSaveItem}
            disabled={!dirty}
            testID={`${idPrefix}-save-item`}
          />
        ) : null}
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={styles.message}
          testID={`${idPrefix}-message`}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.label, color: colors.text, flex: 1 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  group: { alignItems: 'center', gap: 2 },
  groupLabel: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center' },
  step: {
    width: minTouch,
    height: minTouch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    margin: 2,
  },
  pressed: { backgroundColor: colors.accentSoft },
  disabled: { opacity: 0.4 },
  value: { ...typography.label, color: colors.text, minWidth: 52, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  message: { ...typography.caption, color: colors.success, textAlign: 'center' },
});
