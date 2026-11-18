import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { getStores, useProfile } from '@/state';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, spacing, typography } from '@/ui/theme';
import { LocationSheet } from './LocationSheet';

const UNIT_OPTIONS = [
  { value: 'metric', label: 'Metric (°C)' },
  { value: 'imperial', label: 'Imperial (°F)' },
] as const;

/** Profile settings: where the weather comes from and which units to show. */
export function LocationUnitsCard() {
  const [open, setOpen] = useState(false);
  const location = useProfile((s) => s.profile?.location);
  const units = useProfile((s) => s.profile?.units ?? 'metric');
  return (
    <Card testID="profile-location-card">
      <Text accessibilityRole="header" style={styles.heading}>
        Location & units
      </Text>
      <Text style={styles.body} testID="profile-location-label">
        {location?.label ?? 'No location set'}
      </Text>
      <Button
        label={location ? 'Change location' : 'Set location'}
        variant="secondary"
        onPress={() => setOpen(true)}
        testID="profile-location-button"
      />
      <SegmentedControl
        options={UNIT_OPTIONS}
        value={units}
        onChange={(value) => getStores().profile.getState().update({ units: value })}
        accessibilityLabel="Units"
        testID="profile-units"
      />
      <LocationSheet visible={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.text },
  body: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
});
