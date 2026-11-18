import { BLOCKING_POSE_PROBLEMS, type PoseProblem } from '@/core/tryon/pose';

export interface ProblemMessage {
  /** What we noticed, in plain words. */
  title: string;
  /** What to do about it. */
  hint: string;
}

/** One message per problem the photo checks can report (docs/TRY_ON.md §11.2). */
export const PROBLEM_MESSAGES: Record<PoseProblem, ProblemMessage> = {
  'no-person': {
    title: 'We couldn’t find you in this photo.',
    hint: 'Take it again with your whole body in view, or place the points by hand.',
  },
  'head-missing': {
    title: 'Your head looks cut off or hidden.',
    hint: 'Leave a little space above your head. You can also drag the points into place.',
  },
  'feet-missing': {
    title: 'We can’t see your feet.',
    hint: 'Step back so you are in the photo from head to toe, or drag the foot points down.',
  },
  'not-facing-camera': {
    title: 'You look turned to the side.',
    hint: 'Face the camera straight on so clothes line up with your shoulders and hips.',
  },
  'arms-too-close': {
    title: 'Your arms are close to your body.',
    hint: 'Hold them slightly away from your sides so sleeves have room. Fine to keep if you like.',
  },
  'too-small': {
    title: 'You look small in the photo.',
    hint: 'Step closer so you fill most of the picture from head to toe.',
  },
  'landmarks-out-of-order': {
    title: 'The points don’t run in order from head to feet.',
    hint: 'Drag the dots so they go head, shoulders, hips, knees, feet. Or retake the photo.',
  },
};

/** The problems that stop the photo being saved, from the rest, which are only advice. */
export function splitProblems(problems: readonly PoseProblem[]): {
  blocking: PoseProblem[];
  warnings: PoseProblem[];
} {
  const blocking = problems.filter((p) => BLOCKING_POSE_PROBLEMS.includes(p));
  return { blocking, warnings: problems.filter((p) => !BLOCKING_POSE_PROBLEMS.includes(p)) };
}
