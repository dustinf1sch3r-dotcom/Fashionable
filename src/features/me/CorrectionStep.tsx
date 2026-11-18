import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BodyLandmarks } from '@/core/model/types';
import { checkLandmarks } from '@/core/tryon/pose';
import { useCloset } from '@/state';
import { Button } from '@/ui/Button';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, spacing, typography } from '@/ui/theme';
import { useImageUris } from '../shared/useImageUris';
import { LandmarkEditor } from './LandmarkEditor';
import { ProblemList } from './ProblemList';
import { sampleOutfit } from './sampleOutfit';
import { splitProblems } from './problemMessages';
import type { PoseProblem } from '@/core/tryon/pose';

interface CorrectionStepProps {
  uri: string;
  initial: BodyLandmarks;
  /** What Reset returns to: the detected points, or the starting placement. */
  reset: BodyLandmarks;
  /** Problems found when the photo was analysed (shown until the points change). */
  warnings: readonly PoseProblem[];
  saving: boolean;
  error: string | null;
  onSave: (landmarks: BodyLandmarks) => void;
  onCancel: () => void;
}

const VIEWS = [
  { value: 'points', label: 'Move points' },
  { value: 'preview', label: 'Preview outfit' },
] as const;

/** Drag each point onto your body, watch a sample outfit on you, then save (§11.4). */
export function CorrectionStep({
  uri,
  initial,
  reset,
  warnings,
  saving,
  error,
  onSave,
  onCancel,
}: CorrectionStepProps) {
  const [landmarks, setLandmarks] = useState(initial);
  const [view, setView] = useState<'points' | 'preview'>('points');
  const [touched, setTouched] = useState(false);
  const closet = useCloset((s) => s.items);
  const sample = useMemo(() => sampleOutfit(closet), [closet]);
  const ownUris = useImageUris(sample.fromCloset ? sample.items.map((i) => i.images.cutoutId) : []);
  const imageUris = sample.fromCloset ? ownUris : sample.artUris;

  // Live checks on the current points; the analysis warnings stand until the person moves one.
  const live = useMemo(() => checkLandmarks(landmarks), [landmarks]);
  const problems = touched ? live : [...new Set([...warnings, ...live])];
  const blocked = splitProblems(problems).blocking.length > 0;

  return (
    <View style={styles.root} testID="me-correct">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          {view === 'points'
            ? 'Drag each dot onto your body: head, shoulders, waist, hips, knees, ankles and feet.'
            : 'This is how clothes will sit on you. Go back to move points that look off.'}
        </Text>
        <SegmentedControl
          options={VIEWS}
          value={view}
          onChange={setView}
          accessibilityLabel="Correction view"
          testID="me-view"
        />
        <LandmarkEditor
          uri={uri}
          landmarks={landmarks}
          onChange={(next) => {
            setTouched(true);
            setLandmarks(next);
          }}
          preview={view === 'preview'}
          sample={{ items: sample.items, imageUris }}
        />
        {view === 'preview' && !sample.fromCloset ? (
          <Text style={styles.note} testID="me-preview-note">
            Sample pieces shown; add items to your closet to see your own.
          </Text>
        ) : null}
        <ProblemList problems={problems} />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error} testID="me-error">
            {'⚠ '}
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.bar}>
        <Button
          label="Reset"
          icon="refresh-outline"
          variant="secondary"
          onPress={() => {
            setLandmarks(reset);
            setTouched(false);
          }}
          testID="me-reset"
        />
        <View style={styles.grow}>
          <Button
            label="Save"
            icon="checkmark"
            loading={saving}
            disabled={blocked}
            onPress={() => onSave(landmarks)}
            testID="me-save"
          />
        </View>
        <Button label="Cancel" variant="ghost" onPress={onCancel} testID="me-cancel" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  lead: { ...typography.body, color: colors.text },
  note: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.label, color: colors.danger },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  grow: { flex: 1 },
});
