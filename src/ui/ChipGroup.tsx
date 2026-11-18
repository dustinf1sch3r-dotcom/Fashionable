import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/ui/Chip';
import { spacing } from '@/ui/theme';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface BaseProps<T extends string> {
  options: readonly ChipOption<T>[];
  accessibilityLabel?: string;
  testID?: string;
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
}

interface MultiProps<T extends string> extends BaseProps<T> {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
}

export type ChipGroupProps<T extends string> = SingleProps<T> | MultiProps<T>;

/** Wrapping group of chips; chip testIDs are `${testID}-${value}`. */
export function ChipGroup<T extends string>(props: SingleProps<T>): ReactElement;
export function ChipGroup<T extends string>(props: MultiProps<T>): ReactElement;
export function ChipGroup<T extends string>(props: ChipGroupProps<T>): ReactElement {
  const { options, accessibilityLabel, testID } = props;

  const isSelected = (v: T): boolean =>
    props.multiple ? props.value.includes(v) : props.value === v;

  const toggle = (v: T): void => {
    if (props.multiple) {
      props.onChange(
        props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v],
      );
    } else {
      props.onChange(v);
    }
  };

  return (
    <View
      accessibilityRole={props.multiple ? 'none' : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      style={styles.wrap}
      testID={testID}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          role={props.multiple ? 'checkbox' : 'radio'}
          selected={isSelected(o.value)}
          onPress={() => toggle(o.value)}
          testID={testID ? `${testID}-${o.value}` : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
