import { createLocationService } from './index';

const mockRequest = jest.fn();
const mockPosition = jest.fn();
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...a: unknown[]) => mockRequest(...a),
  getCurrentPositionAsync: (...a: unknown[]) => mockPosition(...a),
}));

describe('createLocationService', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns the position when permission is granted', async () => {
    mockRequest.mockResolvedValue({ granted: true });
    mockPosition.mockResolvedValue({ coords: { latitude: 1.5, longitude: 2.5 } });
    expect(await createLocationService().getCurrentPosition()).toEqual({
      status: 'ok',
      lat: 1.5,
      lon: 2.5,
    });
  });

  it('reports denied without asking for a position', async () => {
    mockRequest.mockResolvedValue({ granted: false });
    expect(await createLocationService().getCurrentPosition()).toEqual({ status: 'denied' });
    expect(mockPosition).not.toHaveBeenCalled();
  });

  it('reports unavailable when the lookup throws', async () => {
    mockRequest.mockResolvedValue({ granted: true });
    mockPosition.mockRejectedValue(new Error('timeout'));
    expect(await createLocationService().getCurrentPosition()).toEqual({ status: 'unavailable' });
  });
});
