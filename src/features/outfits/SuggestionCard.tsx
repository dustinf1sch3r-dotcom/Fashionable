import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { BodyTemplate, ID, Item, OutfitSuggestion } from '@/core/model/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { Mannequin } from '@/ui/mannequin';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import { itemDisplayName } from '../closet/list/filter';
import { ItemThumb } from './ItemThumb';
import { topReasons } from './reasonText';
import { scoreLabel } from './scoreLabel';

const MANNEQUIN_WIDTH = 152;

interface SuggestionCardProps {
  index: number;
  suggestion: OutfitSuggestion;
  /** The suggestion's items, in the order of `suggestion.itemIds`. */
  items: readonly Item[];
  body: BodyTemplate;
  imageUris: Readonly<Record<ID, string | undefined>>;
  pinnedIds: readonly ID[];
  verdict: 'like' | 'dislike' | undefined;
  saved: boolean;
  onTogglePin: (itemId: ID) => void;
  onOpenItem: (itemId: ID) => void;
  onRate: (verdict: 'like' | 'dislike') => void;
  onSave: () => void;
  onOpenSaved: () => void;
}

/** One idea: the mannequin, a friendly score, why it works, and what to do with it. */
export function SuggestionCard({
  index,
  suggestion,
  items,
  body,
  imageUris,
  pinnedIds,
  verdict,
  saved,
  onTogglePin,
  onOpenItem,
  onRate,
  onSave,
  onOpenSaved,
}: SuggestionCardProps) {
  const names = new Map(items.map((i) => [i.id, itemDisplayName(i)]));
  const reasons = topReasons(suggestion.reasons, { itemName: (id) => names.get(id) });
  const label = scoreLabel(suggestion.score);

  return (
    <Card testID={`outfit-card-${index}`}>
      <View style={styles.top}>
        <View style={styles.mannequin}>
          <Mannequin
            body={body}
            items={items}
            imageUris={imageUris}
            interactive={false}
            testID={`outfit-mannequin-${index}`}
          />
        </View>
        <View style={styles.side}>
          <View style={styles.score} testID={`outfit-score-${index}`}>
            <Ionicons name="sparkles" size={iconSize.sm} color={colors.accent} />
            <Text style={styles.scoreText}>{label}</Text>
          </View>
          <View style={styles.reasons} testID={`outfit-reasons-${index}`}>
            {reasons.map((r) => (
              <View key={r.code} style={styles.reason}>
                <Ionicons
                  name={r.tone === 'note' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={iconSize.sm}
                  color={r.tone === 'note' ? colors.warning : colors.success}
                  accessibilityElementsHidden
                />
                <Text style={styles.reasonText} testID={`outfit-reason-${index}`}>
                  {r.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.thumbs}>
        {items.map((item) => (
          <ItemThumb
            key={item.id}
            item={item}
            uri={imageUris[item.images.cutoutId]}
            pinned={pinnedIds.includes(item.id)}
            onTogglePin={() => onTogglePin(item.id)}
            onPress={() => onOpenItem(item.id)}
            testID={`outfit-${index}-item-${item.id}`}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <IconButton
          icon={verdict === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
          accessibilityLabel="Not for me"
          selected={verdict === 'dislike'}
          onPress={() => onRate('dislike')}
          testID={`outfit-dislike-${index}`}
        />
        <IconButton
          icon={verdict === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
          accessibilityLabel="Love it"
          selected={verdict === 'like'}
          onPress={() => onRate('like')}
          testID={`outfit-like-${index}`}
        />
        <View style={styles.spacer} />
        <Button
          label={saved ? 'Saved' : 'Save'}
          icon={saved ? 'heart' : 'heart-outline'}
          variant={saved ? 'ghost' : 'secondary'}
          onPress={saved ? onOpenSaved : onSave}
          testID={`outfit-save-${index}`}
        />
      </View>
      {verdict ? (
        <Text style={styles.thanks} testID={`outfit-feedback-${index}`}>
          {verdict === 'like'
            ? 'Noted — we’ll suggest more like this.'
            : 'Noted — we’ll show fewer like this.'}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: spacing.md },
  mannequin: { width: MANNEQUIN_WIDTH },
  side: { flex: 1, gap: spacing.sm },
  score: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs + 2,
  },
  scoreText: { ...typography.label, color: colors.accent },
  reasons: { gap: spacing.sm },
  reason: { flexDirection: 'row', gap: spacing.xs + 2, alignItems: 'flex-start' },
  reasonText: { ...typography.caption, color: colors.text, flex: 1 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  spacer: { flex: 1 },
  thanks: { ...typography.caption, color: colors.textMuted },
});
