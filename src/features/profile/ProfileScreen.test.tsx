import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { resetStores, getStores } from '@/state';
import { createTestServices } from '@/services';
import { ProfileScreen } from './ProfileScreen';

const mockServices = createTestServices();
const mockDownload = jest.fn();
const mockChoose = jest.fn();
const mockRestore = jest.fn();

jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));
jest.mock('@/services/backup', () => ({
  ...jest.requireActual('@/services/backup/errors'),
  downloadBackup: (...a: unknown[]) => mockDownload(...a),
  chooseBackupFile: (...a: unknown[]) => mockChoose(...a),
  restoreBackup: (...a: unknown[]) => mockRestore(...a),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, testID }: { children: React.ReactNode; testID?: string }) => {
    const { View } = jest.requireActual('react-native');
    return <View testID={testID}>{children}</View>;
  },
}));

const zero = { added: 0, updated: 0, skipped: 0 };

beforeEach(() => {
  resetStores();
  mockDownload.mockReset();
  mockChoose.mockReset();
  mockRestore.mockReset();
});

describe('ProfileScreen', () => {
  it('shows counts, the never-exported state and the backup explanation', async () => {
    const stores = getStores();
    stores.closet.getState().addItem({
      category: 'top',
      subcategory: 'tshirt',
      colors: [{ hex: '#112233', name: 'navy', share: 1 }],
      images: { originalId: 'o', cutoutId: 'c', thumbId: 't' },
      cutout: { aspectRatio: 1, hasAlpha: true },
    });
    await stores.closet.getState().flush();
    await render(<ProfileScreen />);
    expect(screen.getByTestId('screen-profile')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId('profile-item-count')).toHaveTextContent(/1 item/),
    );
    expect(screen.getByTestId('profile-outfit-count')).toHaveTextContent(/0 outfits/);
    expect(screen.getByTestId('profile-last-exported')).toHaveTextContent(/Never/);
    expect(screen.getByText(/lives only in this browser/)).toBeTruthy();
  });

  it('exports, records the date and reports the result', async () => {
    mockDownload.mockResolvedValue({
      filename: 'fashionable-backup-2026-01-01.json',
      exportedAt: '2026-01-01T00:00:00.000Z',
      counts: { items: 2, outfits: 0, wearLogs: 0, feedback: 0, images: 6 },
      missingImages: [],
    });
    await render(<ProfileScreen />);
    await getStores().profile.getState().hydrate();
    await fireEvent.press(screen.getByTestId('profile-export-button'));
    await waitFor(() => expect(screen.getByTestId('profile-backup-success')).toBeTruthy());
    expect(screen.getByTestId('profile-backup-success')).toHaveTextContent(
      /fashionable-backup-2026-01-01.json/,
    );
    expect(getStores().profile.getState().profile?.lastBackupAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('asks Replace or Merge after choosing a file, then shows a summary', async () => {
    mockChoose.mockResolvedValue({ name: 'mine.json', size: 1, text: async () => '' });
    mockRestore.mockResolvedValue({
      ok: true,
      stats: {
        items: { added: 2, updated: 1, skipped: 0 },
        outfits: zero,
        wearLogs: zero,
        feedback: zero,
        profile: zero,
      },
      images: { written: 6, skipped: 0 },
      exportedAt: '2026-01-01T00:00:00.000Z',
    });
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-import-button'));
    await waitFor(() =>
      expect(screen.getByTestId('import-sheet-file')).toHaveTextContent(/mine.json/),
    );
    await fireEvent.press(screen.getByTestId('import-merge'));
    await waitFor(() => expect(screen.getByTestId('profile-backup-success')).toBeTruthy());
    expect(mockRestore).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mine.json' }),
      'merge',
    );
    expect(screen.getByTestId('profile-backup-success')).toHaveTextContent(
      /Items: 2 added, 1 updated/,
    );
  });

  it('shows an error and no success when the file is refused', async () => {
    mockChoose.mockResolvedValue({ name: 'junk.json', size: 1, text: async () => '' });
    mockRestore.mockResolvedValue({ ok: false, problems: [{ path: '', code: 'not_json' }] });
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-import-button'));
    await waitFor(() => expect(screen.getByTestId('import-replace')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('import-replace'));
    await waitFor(() => expect(screen.getByTestId('profile-backup-error')).toBeTruthy());
    expect(screen.getByTestId('profile-backup-error')).toHaveTextContent(/Nothing was changed/);
    expect(screen.queryByTestId('profile-backup-success')).toBeNull();
  });

  it('does nothing when the file picker is cancelled', async () => {
    mockChoose.mockResolvedValue(null);
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-import-button'));
    await waitFor(() => expect(mockChoose).toHaveBeenCalled());
    expect(screen.queryByTestId('import-sheet')).toBeNull();
    expect(mockRestore).not.toHaveBeenCalled();
  });
});
