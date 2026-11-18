import { Ionicons } from '@/ui/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import type { PoseProblem } from '@/core/tryon/pose';
import { colors, iconSize, radius, spacing, typography } from '@/ui/theme';
import { PROBLEM_MESSAGES, splitProblems } from './problemMessages';

interface ProblemListProps {
  problems: readonly PoseProblem[];
}

/** One plain-language message per problem, with what to do about it. */
export function ProblemList({ problems }: ProblemListProps) {
  const { blocking } = splitProblems(problems);
  if (problems.length === 0) return null;
  return (
    <View style={styles.list} testID="me-problems">
      {problems.map((code) => {
        const stops = blocking.includes(code);
        return (
          <View
            key={code}
            style={[styles.row, stops ? styles.stop : styles.advice]}
            accessibilityRole={stops ? 'alert' : undefined}
            testID={`me-problem-${code}`}
          >
            <Ionicons
              name={stops ? 'alert-circle' : 'information-circle-outline'}
              size={iconSize.md}
              color={stops ? colors.danger : colors.warning}
              accessibilityElementsHidden
            />
            <View style={styles.text}>
              <Text style={styles.title}>{PROBLEM_MESSAGES[code].title}</Text>
              <Text style={styles.hint}>{PROBLEM_MESSAGES[code].hint}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  stop: { borderColor: colors.danger },
  advice: { borderColor: colors.border },
  text: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
});
