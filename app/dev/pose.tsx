import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { BodyLandmarks } from '@/core/model/types';
import {
  bodyCropWindow,
  fromBlazePose,
  POSE_RULES,
  toCanvas,
  type PoseProblem,
} from '@/core/tryon/pose';
import { getServices } from '@/services';
import { Button } from '@/ui/Button';
import { colors, spacing, typography } from '@/ui/theme';

interface Outcome {
  status: 'no-detector' | 'no-keypoints' | 'done';
  keypointCount: number;
  problems: PoseProblem[];
  landmarks?: BodyLandmarks;
  cropUri?: string;
  prepareMs: number;
  detectMs: number;
}

const PREVIEW_WIDTH = 240;

/**
 * Developer page for the pose detector (docs/TRY_ON.md §11): pick a photo, see the detected
 * keypoints, problems and the 1000 × 2000 crop with the landmarks drawn on it. Not linked from
 * the tabs; the e2e spec drives it. Talks to the services directly because it has no feature.
 */
export default function DevPoseScreen() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>();
  const [error, setError] = useState<string>();

  const run = async () => {
    setError(undefined);
    setOutcome(undefined);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled) return;
    setBusy(true);
    try {
      const { pose, bodyCrop } = getServices();
      const uri = picked.assets[0].uri;
      const t0 = performance.now();
      await pose.prepare(setProgress);
      const t1 = performance.now();
      const detection = await pose.detect(uri);
      const t2 = performance.now();
      const timing = { prepareMs: Math.round(t1 - t0), detectMs: Math.round(t2 - t1) };
      if (!pose.available) {
        setOutcome({ status: 'no-detector', keypointCount: 0, problems: [], ...timing });
        return;
      }
      if (!detection) {
        setOutcome({
          status: 'no-keypoints',
          keypointCount: 0,
          problems: ['no-person'],
          ...timing,
        });
        return;
      }
      const result = fromBlazePose(detection.keypoints, detection.width, detection.height);
      let landmarks: BodyLandmarks | undefined;
      let cropUri: string | undefined;
      if (result.landmarks) {
        const window = bodyCropWindow(result.landmarks);
        landmarks = toCanvas(result.landmarks, window);
        const crop = await bodyCrop.crop(uri, window, {
          width: POSE_RULES.canvasWidth,
          height: POSE_RULES.canvasHeight,
          fill: colors.bg,
        });
        cropUri = crop.uri;
      }
      setOutcome({
        status: 'done',
        keypointCount: detection.keypoints.length,
        problems: result.problems,
        landmarks,
        cropUri,
        ...timing,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="screen-dev-pose">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Pose detector</Text>
        <Button label="Choose a photo" onPress={run} loading={busy} testID="dev-pose-choose" />
        {busy ? (
          <Text style={styles.body} testID="dev-pose-progress">
            Loading model {Math.round(progress * 100)}%
          </Text>
        ) : null}
        {error ? (
          <Text style={[styles.body, { color: colors.danger }]} testID="dev-pose-error">
            {error}
          </Text>
        ) : null}
        {outcome ? (
          <View style={styles.result}>
            <Text style={styles.body} testID="dev-pose-status">
              {outcome.status}
            </Text>
            <Text style={styles.body} testID="dev-pose-keypoints">
              {outcome.keypointCount}
            </Text>
            <Text style={styles.body} testID="dev-pose-problems">
              {outcome.problems.length > 0 ? outcome.problems.join(', ') : 'none'}
            </Text>
            <Text style={styles.caption} testID="dev-pose-timing">
              {`prepare ${outcome.prepareMs} ms, detect ${outcome.detectMs} ms`}
            </Text>
            {outcome.cropUri && outcome.landmarks ? (
              <View
                style={{ width: PREVIEW_WIDTH, height: PREVIEW_WIDTH * 2 }}
                testID="dev-pose-crop"
              >
                <Image
                  source={{ uri: outcome.cropUri }}
                  style={{ width: PREVIEW_WIDTH, height: PREVIEW_WIDTH * 2 }}
                  accessibilityLabel="Cropped body photo with detected landmarks"
                />
                <Svg
                  style={StyleSheet.absoluteFill}
                  viewBox={`0 0 ${POSE_RULES.canvasWidth} ${POSE_RULES.canvasHeight}`}
                  testID="dev-pose-landmarks"
                >
                  {Object.entries(outcome.landmarks).map(([name, p]) => (
                    <Circle
                      key={name}
                      cx={p.x}
                      cy={p.y}
                      r={14}
                      fill={colors.accent}
                      stroke={colors.surface}
                      strokeWidth={3}
                    />
                  ))}
                </Svg>
              </View>
            ) : null}
            {outcome.landmarks ? (
              <Text style={styles.caption} testID="dev-pose-landmarks-json">
                {JSON.stringify(outcome.landmarks)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted },
  result: { gap: spacing.sm },
});
