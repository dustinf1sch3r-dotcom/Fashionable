import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ChipGroup } from '@/ui/ChipGroup';
import { ColorDot } from '@/ui/ColorDot';
import { EmptyState } from '@/ui/EmptyState';
import { IconButton } from '@/ui/IconButton';
import type { Rating } from '@/ui/Rating5';
import { Rating5 } from '@/ui/Rating5';
import { SectionHeader } from '@/ui/SectionHeader';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { TextField } from '@/ui/TextField';
import { colors, spacing, typography } from '@/ui/theme';

type Category = 'tops' | 'bottoms' | 'shoes' | 'bags' | 'outerwear';
type Occasion = 'casual' | 'work' | 'date' | 'formal';
type View3 = 'grid' | 'list' | 'rail';

const CATEGORIES = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'bags', label: 'Bags' },
  { value: 'outerwear', label: 'Outerwear' },
] as const satisfies readonly { value: Category; label: string }[];

const OCCASIONS = [
  { value: 'casual', label: 'Casual' },
  { value: 'work', label: 'Work' },
  { value: 'date', label: 'Date night' },
  { value: 'formal', label: 'Formal' },
] as const satisfies readonly { value: Occasion; label: string }[];

const VIEWS = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
  { value: 'rail', label: 'Rail' },
] as const satisfies readonly { value: View3; label: string }[];

/** Developer gallery of every UI-kit component. Not linked from the tabs. */
export default function DevUiScreen() {
  const [category, setCategory] = useState<Category | null>('tops');
  const [occasions, setOccasions] = useState<Occasion[]>(['casual', 'date']);
  const [view, setView] = useState<View3>('grid');
  const [formality, setFormality] = useState<Rating | null>(null);
  const [warmth, setWarmth] = useState<Rating | null>(3);
  const [name, setName] = useState('');
  const [bad, setBad] = useState('x');
  const [liked, setLiked] = useState(false);
  const [presses, setPresses] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const press = () => setPresses((n) => n + 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} testID="screen-dev-ui">
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          UI kit
        </Text>

        <SectionHeader title="Buttons" />
        <Text style={styles.note} testID="dev-ui-press-count">
          Presses: {presses}
        </Text>
        <View style={styles.stack}>
          <Button label="Primary" onPress={press} testID="dev-button-primary" />
          <Button label="Secondary" variant="secondary" onPress={press} />
          <Button label="Ghost" variant="ghost" onPress={press} />
          <Button label="Delete item" variant="danger" icon="trash-outline" onPress={press} />
          <Button label="Add item" size="lg" icon="add" onPress={press} />
          <Button label="Disabled" disabled onPress={press} />
          <Button
            label={loading ? 'Saving' : 'Tap to load'}
            loading={loading}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          />
        </View>

        <SectionHeader title="Icon buttons" />
        <View style={styles.row}>
          <IconButton
            icon={liked ? 'heart' : 'heart-outline'}
            accessibilityLabel="Favourite"
            selected={liked}
            onPress={() => setLiked((v) => !v)}
            testID="dev-icon-heart"
          />
          <IconButton icon="share-outline" accessibilityLabel="Share" onPress={press} />
          <IconButton icon="trash-outline" accessibilityLabel="Delete" disabled onPress={press} />
        </View>

        <SectionHeader title="Chips" />
        <Text style={styles.note}>Single select</Text>
        <ChipGroup
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          accessibilityLabel="Category"
          testID="dev-chips-single"
        />
        <Text style={styles.note}>Multi select</Text>
        <ChipGroup
          multiple
          options={OCCASIONS}
          value={occasions}
          onChange={setOccasions}
          accessibilityLabel="Occasions"
          testID="dev-chips-multi"
        />

        <SectionHeader title="Segmented control" />
        <SegmentedControl
          options={VIEWS}
          value={view}
          onChange={setView}
          accessibilityLabel="Layout"
          testID="dev-segmented"
        />

        <SectionHeader title="Ratings" />
        <Rating5
          label="Formality"
          lowLabel="Relaxed"
          highLabel="Dressy"
          value={formality}
          onChange={setFormality}
          testID="dev-rating-formality"
        />
        <Rating5
          label="Warmth"
          lowLabel="Light"
          highLabel="Cosy"
          value={warmth}
          onChange={setWarmth}
          testID="dev-rating-warmth"
        />
        <Text style={styles.note} testID="dev-rating-readout">
          Formality: {formality ?? 'not set'}
        </Text>

        <SectionHeader title="Text fields" />
        <View style={styles.stack}>
          <TextField
            label="Item name"
            value={name}
            onChangeText={setName}
            placeholder="Navy blazer"
            helperText="Short and easy to spot."
            testID="dev-field-name"
          />
          <TextField
            label="Brand"
            value={bad}
            onChangeText={setBad}
            errorText="Brand must be at least 2 characters."
            testID="dev-field-error"
          />
          <TextField label="Locked" value="Read only" onChangeText={setName} disabled />
        </View>

        <SectionHeader title="Colour dots" />
        <View style={styles.row}>
          <ColorDot hex="#1F2A44" label="Navy" />
          <ColorDot hex="#D9B99B" label="Tan" />
          <ColorDot hex="#FFFFFF" label="White" />
          <ColorDot hex="#B3261E" size="sm" />
        </View>

        <SectionHeader
          title="Cards"
          action={{ label: 'See all', onPress: press, testID: 'dev-section-action' }}
        />
        <Card testID="dev-card">
          <Text style={styles.cardTitle}>Static card</Text>
          <Text style={styles.note}>Surfaces group related content.</Text>
        </Card>
        <Card onPress={press} accessibilityLabel="Pressable card">
          <Text style={styles.cardTitle}>Pressable card</Text>
          <Text style={styles.note}>Tap me to bump the counter.</Text>
        </Card>

        <SectionHeader title="Empty state" />
        <Card>
          <EmptyState
            icon="shirt-outline"
            title="Your closet is empty"
            body="Snap your first piece and it shows up here."
            action={{ label: 'Add first item', onPress: press }}
            testID="dev-empty"
          />
        </Card>

        <SectionHeader title="Sheet" />
        <Button
          label="Open sheet"
          variant="secondary"
          onPress={() => setSheetOpen(true)}
          testID="dev-sheet-open"
        />
      </ScrollView>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Pick a category"
        testID="dev-sheet"
      >
        <ChipGroup
          options={CATEGORIES}
          value={category}
          onChange={setCategory}
          accessibilityLabel="Category in sheet"
        />
        <Button label="Done" onPress={() => setSheetOpen(false)} testID="dev-sheet-done" />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  title: { ...typography.title, color: colors.text },
  note: { ...typography.caption, color: colors.textMuted },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  cardTitle: { ...typography.label, color: colors.text },
});
