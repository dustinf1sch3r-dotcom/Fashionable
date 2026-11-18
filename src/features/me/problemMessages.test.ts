import { BLOCKING_POSE_PROBLEMS, type PoseProblem } from '@/core/tryon/pose';
import { PROBLEM_MESSAGES, splitProblems } from './problemMessages';

const ALL: PoseProblem[] = [
  'no-person',
  'head-missing',
  'feet-missing',
  'not-facing-camera',
  'arms-too-close',
  'too-small',
  'landmarks-out-of-order',
];

describe('problem messages', () => {
  it('has one title and one thing to do for every problem', () => {
    expect(Object.keys(PROBLEM_MESSAGES).sort()).toEqual([...ALL].sort());
    for (const code of ALL) {
      expect(PROBLEM_MESSAGES[code].title.length).toBeGreaterThan(10);
      expect(PROBLEM_MESSAGES[code].hint.length).toBeGreaterThan(10);
    }
  });

  it('separates blocking problems from advice', () => {
    expect(splitProblems(['too-small', 'no-person', 'arms-too-close'])).toEqual({
      blocking: ['no-person'],
      warnings: ['too-small', 'arms-too-close'],
    });
    expect(splitProblems([])).toEqual({ blocking: [], warnings: [] });
    for (const code of BLOCKING_POSE_PROBLEMS) {
      expect(splitProblems([code]).blocking).toEqual([code]);
    }
  });
});
