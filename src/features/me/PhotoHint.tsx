import { Ionicons } from '@/ui/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getServices } from '@/services';
import { useProfile } from '@/state';
import { IconButton } from '@/ui/IconButton';
import { colors, iconSize, minTouch, radius, spacing, typography } from '@/ui/theme';
import { loadHintDismissed, saveHintDismissed } from './hintDismissed';

/** One-time nudge on Outfits: "See outfits on you — add a photo". Hidden once a photo exists. */
export function PhotoHint() {
  const router = useRouter();
  const ready = useProfile((s) => s.status === 'ready');
  const hasPhoto = useProfile((s) => Boolean(s.profile?.bodyPhoto));
  const [dismissed, setDismissed] = useState(true); // hidden until we know it was not dismissed

  useEffect(() => {
    let live = true;
    void loadHintDismissed().then((d) => {
      if (live) setDismissed(d);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!ready || hasPhoto || dismissed || !getServices().bodyCrop.available) return null;
  return (
    <View style={styles.card} testID="outfits-photo-hint">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See outfits on you: add a photo"
        onPress={() => router.push('/me/photo')}
        style={styles.main}
        testID="outfits-photo-hint-add"
      >
        <Ionicons name="person-circle-outline" size={iconSize.lg} color={colors.accent} />
        <Text style={styles.text}>See outfits on you — add a photo</Text>
        <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.accent} />
      </Pressable>
      <IconButton
        icon="close"
        accessibilityLabel="Dismiss"
        onPress={() => {
          setDismissed(true);
          void saveHintDismissed();
        }}
        testID="outfits-photo-hint-dismiss"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    paddingLeft: spacing.md,
  },
  main: {
    flex: 1,
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: { ...typography.label, color: colors.accent, flex: 1 },
});
