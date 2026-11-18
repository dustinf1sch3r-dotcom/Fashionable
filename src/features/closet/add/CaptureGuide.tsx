import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Category } from '@/core/model/types';
import { categoryOutline } from '@/ui/mannequin/archetypeArt';
import type { IconName } from '@/ui/icons';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import { CATEGORY_LABELS } from '../labels';

const TIPS: readonly { icon: IconName; text: string }[] = [
  { icon: 'contrast-outline', text: 'Plain background that contrasts with it' },
  { icon: 'shirt-outline', text: 'Lay it flat or hang it up' },
  { icon: 'scan-outline', text: 'Shoot straight on, from above' },
];

const BOX = 132;

/** A faint outline of the chosen kind of garment, and the three tips for a good photo. */
export function CaptureGuide({ category }: { category: Category }) {
  const { path, aspect } = categoryOutline(category);
  // Fit the shape into the box, keeping its proportions.
  const w = aspect >= 1 ? BOX : BOX * aspect;
  const h = aspect >= 1 ? BOX / aspect : BOX;
  return (
    <View style={styles.card} testID="add-item-guide">
      <View
        style={styles.frame}
        accessibilityLabel={`Outline of a ${CATEGORY_LABELS[category].toLowerCase()}: fill the frame like this`}
        accessibilityRole="image"
        testID="add-item-outline"
      >
        <Svg width={w * 0.82} height={h * 0.82} viewBox="0 0 100 100" preserveAspectRatio="none">
          <Path
            d={path}
            fill={colors.accentSoft}
            fillOpacity={0.7}
            fillRule="evenodd"
            stroke={colors.accent}
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="6 5"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            data-testid={`add-item-outline-${category}`}
          />
        </Svg>
      </View>
      <View style={styles.tips} testID="add-item-tips">
        <Text style={styles.tipsTitle}>For the best result</Text>
        {TIPS.map((tip) => (
          <View key={tip.text} style={styles.tip}>
            <Ionicons name={tip.icon} size={iconSize.md} color={colors.accent} />
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  frame: {
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  tips: { flex: 1, gap: spacing.sm },
  tipsTitle: { ...typography.label, color: colors.text },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipText: { ...typography.caption, color: colors.textMuted, flex: 1 },
});
