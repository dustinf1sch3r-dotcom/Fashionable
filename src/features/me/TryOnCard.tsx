import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getServices } from '@/services';
import { getStores, useProfile } from '@/state';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { useIsClient } from '@/ui/useIsClient';
import { useImageUris } from '../shared/useImageUris';
import { PRIVACY_LINE } from './GuideStep';
import { deleteBodyPhoto } from './saveBodyPhoto';

const THUMB_W = 72;

/** Profile card: add, retake, adjust or delete the photo outfits are tried on (§11). */
export function TryOnCard() {
  const router = useRouter();
  const photo = useProfile((s) => s.profile?.bodyPhoto);
  const uris = useImageUris(photo ? [photo.imageId] : []);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Assume support until the browser says otherwise: the build machine has no canvas, and a
  // different first render would break hydration (error #418).
  const client = useIsClient();
  const supported = !client || getServices().bodyCrop.available;
  const uri = photo ? uris[photo.imageId] : undefined;

  const remove = async () => {
    setBusy(true);
    try {
      await deleteBodyPhoto(getServices(), getStores().profile);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Card testID="profile-tryon-card">
      <Text accessibilityRole="header" style={styles.heading}>
        Your photo for try-on
      </Text>
      {photo ? (
        <>
          <View style={styles.row}>
            <View style={styles.thumb}>
              {uri ? (
                <Image
                  source={{ uri }}
                  resizeMode="cover"
                  accessibilityLabel="Your try-on photo"
                  style={styles.thumbImage}
                  testID="profile-tryon-thumb"
                />
              ) : null}
            </View>
            <Text style={styles.body}>
              Outfits are shown on you. Switch to the silhouette any time on the Outfits and Mix
              screens.
            </Text>
          </View>
          <Text style={styles.muted}>{PRIVACY_LINE}</Text>
          <View style={styles.actions}>
            <Button
              label="Retake"
              icon="camera-outline"
              variant="secondary"
              onPress={() => router.push('/me/photo')}
              testID="profile-tryon-retake"
            />
            <Button
              label="Adjust points"
              icon="move-outline"
              variant="secondary"
              onPress={() => router.push('/me/photo?step=adjust')}
              testID="profile-tryon-adjust"
            />
            <Button
              label="Delete photo"
              icon="trash-outline"
              variant="ghost"
              onPress={() => setConfirming(true)}
              testID="profile-tryon-delete"
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            See outfits on yourself instead of a silhouette. One photo is enough.
          </Text>
          <Text style={styles.muted}>{PRIVACY_LINE}</Text>
          {supported ? (
            <Button
              label="Add your photo"
              icon="person-add-outline"
              onPress={() => router.push('/me/photo')}
              testID="profile-tryon-add"
            />
          ) : (
            <Text style={styles.muted} testID="profile-tryon-unsupported">
              Not available on this device yet.
            </Text>
          )}
        </>
      )}
      <Sheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        title="Delete your photo?"
        testID="me-delete-sheet"
      >
        <Text style={styles.body}>
          The photo is removed from this phone and outfits go back to the silhouette. Backups you
          already exported still contain it.
        </Text>
        <Button
          label="Delete photo"
          variant="danger"
          loading={busy}
          onPress={() => void remove()}
          testID="me-delete"
        />
        <Button
          label="Keep it"
          variant="ghost"
          onPress={() => setConfirming(false)}
          testID="me-delete-cancel"
        />
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.text, flex: 1 },
  muted: { ...typography.caption, color: colors.textMuted },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: {
    width: THUMB_W,
    aspectRatio: 0.5,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  thumbImage: { width: '100%', height: '100%' },
  actions: { gap: spacing.sm },
});
