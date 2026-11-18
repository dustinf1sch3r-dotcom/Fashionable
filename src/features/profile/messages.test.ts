import type { BackupProblem, MergeStats } from '@/core/backup';
import {
  describeExport,
  describeProblems,
  formatBackupDate,
  isBackupDue,
  summarizeImport,
} from './messages';

const p = (code: BackupProblem['code']): BackupProblem[] => [{ path: '', code }];
const zero = { added: 0, updated: 0, skipped: 0 };
const stats = (over: Partial<MergeStats> = {}): MergeStats => ({
  items: zero,
  outfits: zero,
  wearLogs: zero,
  feedback: zero,
  profile: zero,
  ...over,
});

describe('describeProblems', () => {
  it('words each refusal reason', () => {
    expect(describeProblems(p('not_json'))).toMatch(/not valid JSON/);
    expect(describeProblems(p('wrong_format'))).toMatch(/not a Fashionable backup/);
    expect(describeProblems(p('not_an_object'))).toMatch(/not a Fashionable backup/);
    expect(describeProblems(p('newer_version'))).toMatch(/newer version/);
    expect(describeProblems(p('newer_schema'))).toMatch(/newer version/);
    expect(describeProblems(p('unsupported_version'))).toMatch(/file version/);
  });
  it('counts problems for damaged files', () => {
    expect(describeProblems(p('invalid_record'))).toBe(
      'The backup file is damaged (1 problem found).',
    );
    expect(describeProblems([...p('invalid_record'), ...p('missing')])).toMatch(/2 problems/);
  });
});

describe('summarizeImport', () => {
  it('lists changed collections only', () => {
    expect(
      summarizeImport(
        stats({
          items: { added: 3, updated: 1, skipped: 0 },
          outfits: { added: 0, updated: 2, skipped: 0 },
        }),
      ),
    ).toEqual(['Items: 3 added, 1 updated', 'Outfits: 2 updated']);
  });
  it('says so when nothing changed', () => {
    expect(summarizeImport(stats({ items: { added: 0, updated: 0, skipped: 5 } }))).toEqual([
      'Nothing new: your closet already had everything in this file.',
    ]);
  });
});

describe('describeExport', () => {
  it('pluralises and mentions missing images', () => {
    expect(describeExport({ items: 1, images: 3 }, 0)).toBe('1 item and 3 images saved.');
    expect(describeExport({ items: 2, images: 1 }, 2)).toBe(
      '2 items and 1 image saved. 2 images were missing and left out.',
    );
  });
});

describe('isBackupDue', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('is never due for an empty closet', () => {
    expect(isBackupDue(undefined, 0, now)).toBe(false);
  });
  it('is due when never exported or older than 30 days', () => {
    expect(isBackupDue(undefined, 3, now)).toBe(true);
    expect(isBackupDue('2026-04-01T00:00:00Z', 3, now)).toBe(true);
    expect(isBackupDue('2026-05-15T00:00:00Z', 3, now)).toBe(false);
  });
});

describe('formatBackupDate', () => {
  it('says Never or formats the date', () => {
    expect(formatBackupDate(undefined)).toBe('Never');
    expect(formatBackupDate('2026-03-05T12:00:00Z', 'en-GB')).toBe('5 Mar 2026');
  });
});
