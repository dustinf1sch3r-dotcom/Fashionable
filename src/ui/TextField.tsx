import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  errorText,
  disabled = false,
  multiline = false,
  autoCapitalize,
  testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        aria-invalid={hasError}
        editable={!disabled}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        testID={testID}
        value={value}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          hasError && styles.errorBorder,
          disabled && styles.disabled,
        ]}
      />
      {hasError ? (
        <Text
          accessibilityRole="alert"
          style={styles.error}
          testID={testID ? `${testID}-error` : undefined}
        >
          {'⚠ '}
          {errorText}
        </Text>
      ) : helperText ? (
        <Text style={styles.helper} testID={testID ? `${testID}-helper` : undefined}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  input: {
    ...typography.body,
    minHeight: minTouch + spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: minTouch * 2, textAlignVertical: 'top' },
  focused: { borderColor: colors.accent },
  errorBorder: { borderColor: colors.danger },
  disabled: { backgroundColor: colors.surfaceAlt, opacity: 0.6 },
  helper: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.caption, color: colors.danger },
});
