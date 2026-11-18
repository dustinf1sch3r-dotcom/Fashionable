import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BodyLandmarks } from '@/core/model/types';
import type { PoseProblem } from '@/core/tryon/pose';
import { getServices } from '@/services';
import { getStores, useProfile } from '@/state';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { colors, spacing, typography } from '@/ui/theme';
import { useClosetHydration } from '../closet/list/useClosetHydration';
import { useImageUris } from '../shared/useImageUris';
import {
  analysePhoto,
  placeByHand,
  type PickedPhoto,
  type PreparedPhoto,
} from './bodyPhotoPipeline';
import { CorrectionStep } from './CorrectionStep';
import { GuideStep } from './GuideStep';
import { ProblemList } from './ProblemList';
import { pickBodyPhoto } from './pickPhoto';
import { saveBodyPhoto } from './saveBodyPhoto';

type Step =
  | { kind: 'guide' }
  | { kind: 'working'; label: string; progress?: number }
  | { kind: 'problems'; picked: PickedPhoto; problems: PoseProblem[] }
  | { kind: 'failed'; picked: PickedPhoto }
  | { kind: 'correct'; photo: PreparedPhoto; warnings: PoseProblem[] }
  | { kind: 'adjust' };

const PHOTO_ERROR = "We couldn't read that photo. Try another one or take a new picture.";
const CAMERA_DENIED = 'Camera access is off. Allow it in Settings, or choose a photo instead.';
const SAVE_ERROR = "We couldn't save your photo. Please try again.";
const PREPARE_LABEL = 'Getting ready… (one-time download, about 9 MB)';
const FIND_LABEL = 'Finding you in the photo…';

/** Setup flow for the try-on photo: guide, pick, detect, correct, save (docs/TRY_ON.md §11). */
export function MePhotoScreen() {
  const router = useRouter();
  const { step: startStep } = useLocalSearchParams<{ step?: string }>();
  useClosetHydration();
  const profileStatus = useProfile((s) => s.status);
  const existing = useProfile((s) => s.profile?.bodyPhoto);
  const existingUris = useImageUris(existing ? [existing.imageId] : []);
  const [step, setStep] = useState<Step>(
    startStep === 'adjust' ? { kind: 'adjust' } : { kind: 'guide' },
  );
  const [pickError, setPickError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const services = getServices();
  const supported = services.bodyCrop.available;

  const pick = async (source: 'camera' | 'library') => {
    if (step.kind !== 'guide') return;
    setPickError(null);
    const outcome = await pickBodyPhoto(source);
    if (outcome.kind === 'cancelled') return;
    if (outcome.kind === 'denied') return setPickError(CAMERA_DENIED);
    if (outcome.kind === 'error') return setPickError(PHOTO_ERROR);
    await analyse(outcome.photo);
  };

  const analyse = async (picked: PickedPhoto) => {
    setStep({ kind: 'working', label: services.pose.available ? PREPARE_LABEL : FIND_LABEL });
    try {
      const result = await analysePhoto(picked, services, (progress) =>
        setStep({ kind: 'working', label: progress < 1 ? PREPARE_LABEL : FIND_LABEL, progress }),
      );
      if (result.kind === 'ready') {
        setSaveError(null);
        setStep({ kind: 'correct', photo: result.photo, warnings: result.warnings });
      } else if (result.kind === 'problems') {
        setStep({ kind: 'problems', picked, problems: result.problems });
      } else {
        setStep({ kind: 'failed', picked });
      }
    } catch {
      setPickError(PHOTO_ERROR);
      setStep({ kind: 'guide' });
    }
  };

  const byHand = async (picked: PickedPhoto) => {
    setStep({ kind: 'working', label: FIND_LABEL });
    try {
      setSaveError(null);
      setStep({ kind: 'correct', photo: await placeByHand(picked, services), warnings: [] });
    } catch {
      setPickError(PHOTO_ERROR);
      setStep({ kind: 'guide' });
    }
  };

  const save = async (photo: PreparedPhoto | undefined, landmarks: BodyLandmarks) => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveBodyPhoto(
        {
          landmarks,
          ...(photo ? { blob: photo.blob } : {}),
          ...(photo?.detected ? { detected: photo.detected } : {}),
        },
        services,
        getStores().profile,
      );
      leave();
    } catch {
      setSaveError(SAVE_ERROR);
      setSaving(false);
    }
  };

  let content;
  if (!supported) {
    content = (
      <Text style={styles.body} testID="me-unsupported">
        Trying clothes on your own photo is not available on this device yet.
      </Text>
    );
  } else if (step.kind === 'guide') {
    content = (
      <ScrollView contentContainerStyle={styles.scroll}>
        <GuideStep
          onTakePhoto={() => void pick('camera')}
          onChoosePhoto={() => void pick('library')}
          error={pickError}
        />
      </ScrollView>
    );
  } else if (step.kind === 'working') {
    content = (
      <View style={styles.center} testID="me-progress">
        <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Working" />
        <Text style={styles.body} accessibilityLiveRegion="polite" testID="me-progress-label">
          {step.label}
        </Text>
        {step.progress !== undefined && step.progress < 1 ? (
          <Text style={styles.muted} testID="me-progress-percent">
            {Math.round(step.progress * 100)}%
          </Text>
        ) : null}
      </View>
    );
  } else if (step.kind === 'problems') {
    content = (
      <ScrollView contentContainerStyle={styles.scroll}>
        <ProblemList problems={step.problems} />
        <Button
          label="Retake photo"
          icon="camera-outline"
          size="lg"
          onPress={() => setStep({ kind: 'guide' })}
          testID="me-retake"
        />
        <Button
          label="Place points by hand"
          icon="hand-left-outline"
          variant="secondary"
          size="lg"
          onPress={() => void byHand(step.picked)}
          testID="me-by-hand"
        />
      </ScrollView>
    );
  } else if (step.kind === 'failed') {
    content = (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.failed} accessibilityRole="alert" testID="me-detector-failed">
          <Text style={styles.heading}>We couldn’t start the body finder.</Text>
          <Text style={styles.body}>
            It needs a connection the first time. Try again, or place the points by hand.
          </Text>
        </View>
        <Button
          label="Try again"
          icon="refresh-outline"
          size="lg"
          onPress={() => void analyse(step.picked)}
          testID="me-retry"
        />
        <Button
          label="Place points by hand"
          icon="hand-left-outline"
          variant="secondary"
          size="lg"
          onPress={() => void byHand(step.picked)}
          testID="me-by-hand"
        />
      </ScrollView>
    );
  } else if (step.kind === 'correct') {
    content = (
      <CorrectionStep
        key={step.photo.uri}
        uri={step.photo.uri}
        initial={step.photo.landmarks}
        reset={step.photo.detected ?? step.photo.landmarks}
        warnings={step.warnings}
        saving={saving}
        error={saveError}
        onSave={(landmarks) => void save(step.photo, landmarks)}
        onCancel={() => setStep({ kind: 'guide' })}
      />
    );
  } else {
    const uri = existing ? existingUris[existing.imageId] : undefined;
    content =
      existing && uri ? (
        <CorrectionStep
          uri={uri}
          initial={existing.landmarks}
          reset={existing.detected ?? existing.landmarks}
          warnings={[]}
          saving={saving}
          error={saveError}
          onSave={(landmarks) => void save(undefined, landmarks)}
          onCancel={leave}
        />
      ) : profileStatus === 'ready' && !existing ? (
        <View style={styles.center}>
          <Text style={styles.body}>There is no photo to adjust yet.</Text>
          <Button label="Add your photo" onPress={() => setStep({ kind: 'guide' })} />
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}
      testID="screen-me-photo"
    >
      <View style={styles.bar}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Back"
          onPress={leave}
          testID="me-back"
        />
        <Text accessibilityRole="header" style={styles.title}>
          Your photo for try-on
        </Text>
      </View>
      <View style={styles.body_}>{content}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  title: { ...typography.heading, color: colors.text, flex: 1 },
  body_: { flex: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  failed: { gap: spacing.xs },
  heading: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.text, textAlign: 'center' },
  muted: { ...typography.caption, color: colors.textMuted },
});
