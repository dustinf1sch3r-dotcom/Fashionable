import { useReducer, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, subcategoriesOf } from '@/core/model/taxonomy';
import type { Category, Pattern } from '@/core/model/types';
import { Button } from '@/ui/Button';
import { ChipGroup } from '@/ui/ChipGroup';
import { ColorDot } from '@/ui/ColorDot';
import { Rating5 } from '@/ui/Rating5';
import { SectionHeader } from '@/ui/SectionHeader';
import { TextField } from '@/ui/TextField';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { CATEGORY_LABELS, COLOR_LABELS, PATTERN_LABELS, subcategoryLabel } from '../labels';
import { ColorPicker } from './ColorPicker';
import { PhotoPreview } from './PhotoPreview';
import { formReducer, initialFormState, validateForm, type FormState } from './formState';
import type { ProcessedPhoto } from './processPhoto';

const CATEGORY_OPTIONS = CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }));
const PATTERNS = Object.keys(PATTERN_LABELS) as Pattern[];
const PATTERN_OPTIONS = PATTERNS.map((value) => ({ value, label: PATTERN_LABELS[value] }));
const FLAG_OPTIONS = [
  { value: 'rainOk', label: 'Fine in rain' },
  { value: 'sporty', label: 'Sporty' },
] as const;

interface TagFormProps {
  photo: ProcessedPhoto;
  useOriginal: boolean;
  onToggleOriginal: () => void;
  saving: boolean;
  error: string | null;
  onSave: (state: FormState) => void;
  onChangePhoto: () => void;
  /** The category chosen on the capture step. */
  initialCategory?: Category;
  /** Opens the touch-up brush; leave out where it is not available. */
  onTouchUp?: () => void;
}

export function TagForm({
  photo,
  useOriginal,
  onToggleOriginal,
  saving,
  error,
  onSave,
  onChangePhoto,
  initialCategory,
  onTouchUp,
}: TagFormProps) {
  const [state, dispatch] = useReducer(formReducer, photo.colors, (detected) =>
    initialFormState(detected, initialCategory),
  );
  const noColour = state.colors.length === 0;
  const [pickingColour, setPickingColour] = useState(noColour);
  const problems = validateForm(state);
  const primary = state.colors[0];

  const flags = [
    ...(state.rainOk ? (['rainOk'] as const) : []),
    ...(state.sporty ? (['sporty'] as const) : []),
  ];

  return (
    <View style={styles.root} testID="add-item-form">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {photo.cutoutRejected && !photo.cutout ? (
          <Text style={styles.rejected} accessibilityRole="alert" testID="add-item-cutout-hint">
            Couldn’t separate the background — try a plainer background, or use Touch up to erase it
            by hand.
          </Text>
        ) : null}
        <View style={styles.previewRow}>
          <PhotoPreview
            photo={photo}
            useOriginal={useOriginal}
            onToggleOriginal={onToggleOriginal}
            onTouchUp={onTouchUp}
          />
          <View style={styles.previewInfo}>
            <Text style={styles.caption}>{noColour ? 'Colour' : 'Detected colour'}</Text>
            {primary ? (
              <ColorDot
                hex={primary.hex}
                label={COLOR_LABELS[primary.name]}
                testID="add-item-colour-primary"
              />
            ) : (
              <Text style={styles.muted} testID="add-item-colour-missing">
                Not detected: pick it below
              </Text>
            )}
            {state.colors.length > 1 ? (
              <View style={styles.more}>
                {state.colors.slice(1).map((c) => (
                  <ColorDot
                    key={c.name}
                    hex={c.hex}
                    label={COLOR_LABELS[c.name]}
                    size="sm"
                    testID={`add-item-colour-${c.name}`}
                  />
                ))}
              </View>
            ) : null}
            {!noColour ? (
              <Button
                label={pickingColour ? 'Done' : 'Change colour'}
                variant="ghost"
                onPress={() => setPickingColour((v) => !v)}
                testID="add-item-colour-toggle"
              />
            ) : null}
          </View>
        </View>

        {pickingColour ? (
          <ColorPicker
            value={primary?.name ?? null}
            onChange={(color) => dispatch({ type: 'setPrimaryColor', color })}
            testID="add-item-colour-picker"
          />
        ) : null}

        <SectionHeader title="Category" />
        <ChipGroup
          options={CATEGORY_OPTIONS}
          value={state.category}
          onChange={(category) => dispatch({ type: 'setCategory', category })}
          accessibilityLabel="Category"
          testID="add-item-category"
        />

        <SectionHeader title="Type" />
        <ChipGroup
          options={subcategoriesOf(state.category).map((value) => ({
            value,
            label: subcategoryLabel(value),
          }))}
          value={state.subcategory}
          onChange={(subcategory) => dispatch({ type: 'setSubcategory', subcategory })}
          accessibilityLabel="Type"
          testID="add-item-subcategory"
        />

        <SectionHeader title="Pattern" />
        <ChipGroup
          options={PATTERN_OPTIONS}
          value={state.pattern}
          onChange={(pattern) => dispatch({ type: 'setPattern', pattern })}
          accessibilityLabel="Pattern"
          testID="add-item-pattern"
        />

        <Rating5
          label="Formality"
          lowLabel="Lounge"
          highLabel="Formal"
          value={state.formality}
          onChange={(value) => dispatch({ type: 'setFormality', value })}
          testID="add-item-formality"
        />
        <Rating5
          label="Warmth"
          lowLabel="Summer-light"
          highLabel="Deep winter"
          value={state.warmth}
          onChange={(value) => dispatch({ type: 'setWarmth', value })}
          testID="add-item-warmth"
        />

        <ChipGroup
          multiple
          options={FLAG_OPTIONS}
          value={flags}
          onChange={(next) => {
            const rainOk = next.includes('rainOk');
            const sporty = next.includes('sporty');
            if (rainOk !== state.rainOk) dispatch({ type: 'setRainOk', value: rainOk });
            if (sporty !== state.sporty) dispatch({ type: 'setSporty', value: sporty });
          }}
          accessibilityLabel="Good for"
          testID="add-item-flags"
        />

        <TextField
          label="Name (optional)"
          value={state.name}
          onChangeText={(name) => dispatch({ type: 'setName', name })}
          placeholder="e.g. Favourite tee"
          testID="add-item-name"
        />

        <Button
          label="Use a different photo"
          variant="ghost"
          onPress={onChangePhoto}
          testID="add-item-change-photo"
        />
      </ScrollView>

      <View style={styles.bar}>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error} testID="add-item-error">
            {'⚠ '}
            {error}
          </Text>
        ) : problems.includes('no-colour') ? (
          <Text style={styles.muted} testID="add-item-save-hint">
            Pick the main colour to save.
          </Text>
        ) : null}
        <Button
          label="Save to closet"
          size="lg"
          loading={saving}
          disabled={problems.length > 0}
          onPress={() => onSave(state)}
          testID="add-item-save"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  previewRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  previewInfo: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  more: { gap: spacing.xs },
  rejected: {
    ...typography.caption,
    color: colors.warning,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  caption: { ...typography.caption, color: colors.textMuted },
  muted: { ...typography.body, color: colors.textMuted },
  bar: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  error: { ...typography.label, color: colors.danger },
});
