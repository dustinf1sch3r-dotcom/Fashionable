import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { BODY_A } from '@/core/tryon/bodies';
import { Button } from '@/ui/Button';
import type { IconName } from '@/ui/icons';
import { Silhouette } from '@/ui/mannequin';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';

const TIPS: readonly { icon: IconName; text: string }[] = [
  { icon: 'body-outline', text: 'Stand straight, arms slightly away from your body.' },
  { icon: 'resize-outline', text: 'Get your whole body in, from head to feet.' },
  {
    icon: 'shirt-outline',
    text: 'Wear shorts and a fitted tank top, so your own clothes do not show around the outfits.',
  },
  { icon: 'contrast-outline', text: 'Stand in front of a plain background.' },
  {
    icon: 'phone-portrait-outline',
    text: 'Hold the phone at waist height, 2 to 3 metres away. Use the timer or ask a friend.',
  },
];

export const PRIVACY_LINE =
  'Your photo stays on this phone. It is never uploaded; it only leaves if you export a backup yourself.';

interface GuideStepProps {
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  error: string | null;
}

/** Before picking: how to stand, a pose outline, and the privacy promise (docs/TRY_ON.md §11.6). */
export function GuideStep({ onTakePhoto, onChoosePhoto, error }: GuideStepProps) {
  return (
    <View style={styles.wrap} testID="me-guide">
      <View style={styles.card}>
        <View
          style={styles.frame}
          accessibilityRole="image"
          accessibilityLabel="Outline of the pose: standing straight, arms slightly away from the body, head to feet in the frame"
          testID="me-guide-outline"
        >
          <View style={styles.silhouette}>
            <Silhouette body={BODY_A} />
          </View>
        </View>
        <View style={styles.tips} testID="me-guide-tips">
          {TIPS.map((tip) => (
            <View key={tip.text} style={styles.tip}>
              <Ionicons name={tip.icon} size={iconSize.md} color={colors.accent} />
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.privacy} testID="me-privacy">
        <Ionicons name="lock-closed-outline" size={iconSize.md} color={colors.success} />
        <Text style={styles.privacyText}>{PRIVACY_LINE}</Text>
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error} testID="me-error">
          {'⚠ '}
          {error}
        </Text>
      ) : null}
      <Button
        label="Take photo"
        icon="camera-outline"
        size="lg"
        onPress={onTakePhoto}
        testID="me-take-photo"
      />
      <Button
        label="Choose from library"
        icon="images-outline"
        variant="secondary"
        size="lg"
        onPress={onChoosePhoto}
        testID="me-choose-photo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frame: {
    width: 104,
    aspectRatio: 0.5,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  silhouette: { flex: 1, margin: spacing.xs },
  tips: { flex: 1, gap: spacing.md, justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  tipText: { ...typography.caption, color: colors.text, flex: 1 },
  privacy: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  privacyText: { ...typography.caption, color: colors.text, flex: 1 },
  error: { ...typography.label, color: colors.danger },
});
