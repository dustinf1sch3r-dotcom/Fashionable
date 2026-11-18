import { act, renderHook } from '@testing-library/react-native';
import { createTestServices } from '@/services';
import { getStores, resetStores } from '@/state';
import { useWoreToday } from './useWoreToday';
import { summaryText } from './CalendarScreen';

const mockServices = createTestServices();
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: () => null }));

// The test services' clock is fixed at 2026-01-01.
const TODAY = '2026-01-01';

const logs = () => getStores().wear.getState().logs;

beforeEach(() => resetStores());

describe('useWoreToday', () => {
  it('logs today with the outfit id and the weather snapshot', async () => {
    const weather = {
      tempMinC: 3,
      tempMaxC: 9,
      feelsLikeC: 5,
      precipProbability: 0.4,
      windKph: 12,
      isSunny: false,
    };
    getStores().weather.setState({ today: weather });
    const { result } = await renderHook(() => useWoreToday('t'));
    await act(async () => result.current.request(['a', 'b'], 'o1'));
    expect(logs()).toHaveLength(1);
    expect(logs()[0]).toMatchObject({
      date: TODAY,
      itemIds: ['a', 'b'],
      outfitId: 'o1',
      planned: false,
      weather,
    });
  });

  it('ignores an empty selection', async () => {
    const { result } = await renderHook(() => useWoreToday('t'));
    await act(async () => result.current.request([]));
    expect(logs()).toHaveLength(0);
  });

  it('does not count a plan as already worn today', async () => {
    getStores().wear.getState().plan(TODAY, ['a']);
    const { result } = await renderHook(() => useWoreToday('t'));
    await act(async () => result.current.request(['b']));
    expect(logs().filter((l) => !l.planned)).toHaveLength(1);
  });
});

describe('summaryText', () => {
  it('reads naturally', () => {
    expect(summaryText(0, 0, 0)).toMatch(/Nothing logged yet/);
    expect(summaryText(5, 0, 9)).toBe('Logged 5 of the last 7 days');
    expect(summaryText(5, 1, 9)).toBe('Logged 5 of the last 7 days');
    expect(summaryText(5, 3, 9)).toBe('Logged 5 of the last 7 days · 3-day streak');
  });
});
