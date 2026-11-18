import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getServices } from '@/services';
import { getStores, hydrateAll } from '@/state';
import { IconButton } from '@/ui/IconButton';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { PickStep } from './PickStep';
import { TagForm } from './TagForm';
import { toNewItemInit, validateForm, type FormState } from './formState';
import {
  cutOutPhoto,
  processPhoto,
  saveProcessedPhoto,
  type PickedPhoto,
  type ProcessedPhoto,
} from './processPhoto';

type Step =
  | { kind: 'pick' }
  | { kind: 'processing' }
  | { kind: 'cutting'; progress: number }
  | { kind: 'form'; photo: ProcessedPhoto; photoKey: number };

const PHOTO_ERROR = "We couldn't read that photo. Try another one or take a new picture.";
const SAVE_ERROR = "We couldn't save this item. Please try again.";
const CAMERA_DENIED = 'Camera access is off. Allow it in Settings, or choose a photo instead.';

export function AddItemScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [pickError, setPickError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [useOriginal, setUseOriginal] = useState(false);

  // Go back to the closet that opened this screen; after a direct page load there is no history.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const pick = async (source: 'camera' | 'library') => {
    if (step.kind === 'processing' || step.kind === 'cutting') return;
    setPickError(null);
    let picked: PickedPhoto | undefined;
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPickError(CAMERA_DENIED);
          return;
        }
      }
      const options = { mediaTypes: ['images' as const], quality: 1 };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const [asset] = result.assets;
      picked = { uri: asset.uri, width: asset.width, height: asset.height };
    } catch {
      setPickError(PHOTO_ERROR);
      return;
    }
    setStep({ kind: 'processing' });
    try {
      const services = getServices();
      let photo = await processPhoto(picked, services.pixels);
      if (services.cutout.available) {
        setStep({ kind: 'cutting', progress: 0 });
        // A failed cutout is not an error: the photo is kept as it is (hasAlpha: false).
        photo = await cutOutPhoto(photo, services.cutout, services.pixels, (progress) =>
          setStep({ kind: 'cutting', progress }),
        );
      }
      setSaveError(null);
      setUseOriginal(false);
      setPhotoCount((n) => n + 1);
      setStep({ kind: 'form', photo, photoKey: photoCount + 1 });
    } catch {
      setPickError(PHOTO_ERROR);
      setStep({ kind: 'pick' });
    }
  };

  const save = async (state: FormState) => {
    if (step.kind !== 'form' || saving || validateForm(state).length > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { images, cutout } = await saveProcessedPhoto(
        getServices().images,
        step.photo,
        useOriginal,
      );
      const closet = getStores().closet;
      // Loading after the add would replace the in-memory list and drop the new item.
      if (closet.getState().status !== 'ready') await hydrateAll();
      closet.getState().addItem(toNewItemInit(state, images, cutout));
      await closet.getState().flush();
      leave();
    } catch {
      setSaveError(SAVE_ERROR);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}
      testID="screen-add-item"
    >
      <View style={styles.header}>
        <IconButton
          icon="close"
          accessibilityLabel="Cancel"
          onPress={leave}
          testID="add-item-cancel"
        />
        <Text accessibilityRole="header" style={styles.title}>
          Add item
        </Text>
      </View>
      {step.kind === 'pick' ? (
        <View style={styles.body}>
          <PickStep
            onTakePhoto={() => void pick('camera')}
            onChoosePhoto={() => void pick('library')}
            error={pickError}
          />
        </View>
      ) : null}
      {step.kind === 'processing' ? (
        <View style={styles.center} testID="add-item-processing">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>Preparing your photo…</Text>
        </View>
      ) : null}
      {step.kind === 'cutting' ? (
        <View style={styles.center} testID="add-item-cutting">
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>Removing background…</Text>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(step.progress * 100) }}
            testID="add-item-cutting-progress"
          >
            <View style={[styles.fill, { width: `${Math.round(step.progress * 100)}%` }]} />
          </View>
          <Text style={styles.hint}>
            The first photo downloads a small helper (about 20 MB). After that it is quick.
          </Text>
        </View>
      ) : null}
      {step.kind === 'form' ? (
        <TagForm
          key={step.photoKey}
          photo={step.photo}
          useOriginal={useOriginal}
          onToggleOriginal={() => setUseOriginal((v) => !v)}
          saving={saving}
          error={saveError}
          onSave={(state) => void save(state)}
          onChangePhoto={() => {
            setSaveError(null);
            setStep({ kind: 'pick' });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  title: { ...typography.heading, color: colors.text },
  body: { padding: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { ...typography.body, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', maxWidth: 280 },
  track: {
    width: 240,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent },
});
