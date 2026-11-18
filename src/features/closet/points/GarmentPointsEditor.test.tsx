import { fireEvent, render, screen } from '@testing-library/react-native';
import type { GarmentRig } from '@/core/model/types';
import { fixtureById } from '@/core/testing/fixtures';
import { createTestServices } from '@/services';
import { resetStores } from '@/state';
import { GarmentPointsEditor } from './GarmentPointsEditor';

const mockServices = createTestServices();
jest.mock('@/services', () => ({
  ...jest.requireActual('@/services'),
  getServices: () => mockServices,
}));
jest.mock('@/core/fit', () => ({
  RIG_VERSION: 1,
  // Layering is tested in core (src/core/fit/layers.test.ts); here every garment is unnested.
  layeredTargets: (inputs: { itemId: string }[]) =>
    Object.fromEntries(inputs.map((l) => [l.itemId, { targets: {}, nestedIn: [] }])),
  FIT_MIN_CONFIDENCE: 0.6,
  rigKindOf: () => 'top',
  rigPointNames: () => ['neckL', 'neckR', 'hemL', 'hemR'],
  rigTargets: () => ({}),
  buildFitMesh: () => ({
    source: [],
    target: [],
    triangles: [],
    bounds: { x: 100, y: 200, width: 400, height: 500 },
  }),
}));

const rig: GarmentRig = {
  kind: 'top',
  version: 1,
  confidence: 0.5,
  edited: false,
  points: {
    neckL: { x: 0.4, y: 0.1 },
    neckR: { x: 0.6, y: 0.1 },
    hemL: { x: 0.2, y: 0.9 },
    hemR: { x: 0.8, y: 0.9 },
  },
};
const tee = fixtureById('tee-white');

beforeEach(() => resetStores());

async function setup(props: Partial<Parameters<typeof GarmentPointsEditor>[0]> = {}) {
  const onCancel = jest.fn();
  const onSave = jest.fn();
  const view = await render(
    <GarmentPointsEditor
      item={tee}
      cutoutUri="blob:tee"
      initial={rig}
      detected={rig}
      onCancel={onCancel}
      onSave={onSave}
      {...props}
    />,
  );
  return { onCancel, onSave, view };
}

async function measure() {
  await fireEvent(screen.getByTestId('points-canvas-area'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 220, height: 400 } },
  });
}

describe('GarmentPointsEditor', () => {
  it('shows one handle per rig point once measured, each with a label', async () => {
    await setup();
    expect(screen.queryByTestId('points-handle-neckL')).toBeNull();
    await measure();
    for (const name of ['neckL', 'neckR', 'hemL', 'hemR']) {
      expect(screen.getByTestId(`points-handle-${name}`)).toBeTruthy();
    }
    expect(screen.getByLabelText('Left collar')).toBeTruthy();
    expect(screen.getByLabelText('Right hem')).toBeTruthy();
  });

  it('starts with Save and Reset off, since nothing has changed', async () => {
    await setup();
    await measure();
    expect(screen.getByTestId('points-save').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('points-reset').props.accessibilityState.disabled).toBe(true);
  });

  it('cancels without saving', async () => {
    const { onCancel, onSave } = await setup();
    await fireEvent.press(screen.getByTestId('points-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('draws the preview mannequin with the garment', async () => {
    await setup();
    expect(screen.getByTestId('points-preview-mannequin')).toBeTruthy();
    expect(screen.getByTestId('mannequin-item-tee-white')).toBeTruthy();
  });
});
