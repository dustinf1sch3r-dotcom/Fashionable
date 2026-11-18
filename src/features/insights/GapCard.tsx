import { Ionicons } from '@/ui/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import type { BodyTemplate, ID, Item } from '@/core/model/types';
import { Card } from '@/ui/Card';
import { Mannequin } from '@/ui/mannequin';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';

const MANNEQUIN_WIDTH = 112;

interface GapCardProps {
  /** Friendly name of the missing piece, e.g. "White sneakers". */
  title: string;
  /** Headline number, e.g. "+12 outfits" or "Improves 8 outfits". */
  metric: string;
  /** One line about how the piece fits, e.g. "Goes with your Navy tee and Dark jeans". */
  pairsWith: string;
  /** The example outfit: the user's items plus the suggested piece (drawn flat). */
  items: readonly Item[];
  body: BodyTemplate;
  imageUris: Readonly<Record<ID, string | undefined>>;
  testID: string;
}

/** A piece to consider buying, shown on the mannequin inside an outfit that already works. */
export function GapCard({
  title,
  metric,
  pairsWith,
  items,
  body,
  imageUris,
  testID,
}: GapCardProps) {
  return (
    <Card testID={testID}>
      <View style={styles.row}>
        <View style={styles.mannequin}>
          <Mannequin
            body={body}
            items={items}
            imageUris={imageUris}
            interactive={false}
            testID={`${testID}-mannequin`}
          />
        </View>
        <View style={styles.side}>
          <View style={styles.suggested} testID={`${testID}-suggested`}>
            <Ionicons name="sparkles-outline" size={iconSize.sm - 4} color={colors.accent} />
            <Text style={styles.suggestedText}>Suggested</Text>
          </View>
          <Text style={styles.title} testID={`${testID}-title`}>
            {title}
          </Text>
          <Text style={styles.metric} testID={`${testID}-metric`}>
            {metric}
          </Text>
          <Text style={styles.pairs}>{pairsWith}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  mannequin: { width: MANNEQUIN_WIDTH },
  side: { flex: 1, gap: spacing.xs },
  suggested: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  suggestedText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  title: { ...typography.heading, color: colors.text },
  metric: { ...typography.label, color: colors.accent },
  pairs: { ...typography.caption, color: colors.textMuted },
});
