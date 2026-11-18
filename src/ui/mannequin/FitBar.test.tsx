import { fireEvent, render, screen } from '@testing-library/react-native';
import type { FitAdjust } from '@/core/model/types';
import { FIT_LIMITS, IDENTITY_FIT } from '@/core/tryon/place';
import { FitBar } from './FitBar';

const noop = () => undefined;

async function setup(
  fit: FitAdjust = IDENTITY_FIT,
  over: Partial<Parameters<typeof FitBar>[0]> = {},
) {
  const onChange = jest.fn();
  const onReset = jest.fn();
  const onSaveItem = jest.fn();
  const onSaveOutfit = jest.fn();
  const view = await render(
    <FitBar
      title="Navy tee"
      fit={fit}
      onChange={onChange}
      onReset={onReset}
      onSaveItem={onSaveItem}
      onSaveOutfit={onSaveOutfit}
      dirty
      {...over}
    />,
  );
  return { onChange, onReset, onSaveItem, onSaveOutfit, view };
}

describe('FitBar', () => {
  it('shows the garment and the current values', async () => {
    await setup({ dx: 0, dy: 0, scale: 1.25, rotation: -10 });
    expect(screen.getByText('Adjust: Navy tee')).toBeTruthy();
    expect(screen.getByTestId('fit-scale-value').props.children).toBe('125%');
    expect(screen.getByTestId('fit-rotation-value').props.children).toBe('-10°');
  });

  it('every button reports the adjusted fit', async () => {
    const { onChange } = await setup();
    const cases: [string, Partial<FitAdjust>][] = [
      ['scale-up', { scale: 1.05 }],
      ['scale-down', { scale: 0.95 }],
      ['rotate-left', { rotation: -5 }],
      ['rotate-right', { rotation: 5 }],
      ['nudge-up', { dy: -20 }],
      ['nudge-down', { dy: 20 }],
      ['nudge-left', { dx: -20 }],
      ['nudge-right', { dx: 20 }],
    ];
    for (const [id, change] of cases) {
      onChange.mockClear();
      await fireEvent.press(screen.getByTestId(`fit-${id}`));
      expect(onChange).toHaveBeenCalledWith({ ...IDENTITY_FIT, ...change });
    }
  });

  it('disables a control at its limit', async () => {
    await setup({ dx: 0, dy: 0, scale: FIT_LIMITS.scale.max, rotation: 0 });
    expect(screen.getByTestId('fit-scale-up').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('fit-scale-down').props.accessibilityState.disabled).toBe(false);
  });

  it('labels every icon button for screen readers', async () => {
    await setup();
    for (const label of [
      'Smaller',
      'Larger',
      'Rotate left',
      'Rotate right',
      'Move up',
      'Move down',
      'Move left',
      'Move right',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('reset is off at the default fit', async () => {
    await setup();
    expect(screen.getByTestId('fit-reset').props.accessibilityState.disabled).toBe(true);
  });

  it('reset calls back once the fit differs from the default', async () => {
    const { onReset } = await setup({ ...IDENTITY_FIT, dx: 20 });
    await fireEvent.press(screen.getByTestId('fit-reset'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('save buttons call back', async () => {
    const { onSaveItem, onSaveOutfit } = await setup();
    await fireEvent.press(screen.getByTestId('fit-save-item'));
    await fireEvent.press(screen.getByTestId('fit-save-outfit'));
    expect(onSaveItem).toHaveBeenCalledTimes(1);
    expect(onSaveOutfit).toHaveBeenCalledTimes(1);
  });

  it('save buttons are off when nothing changed', async () => {
    await setup(IDENTITY_FIT, { dirty: false });
    expect(screen.getByTestId('fit-save-item').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('fit-save-outfit').props.accessibilityState.disabled).toBe(true);
  });

  it('hides save buttons that have no handler and shows a message', async () => {
    await setup(IDENTITY_FIT, {
      onSaveItem: undefined,
      onSaveOutfit: undefined,
      message: 'Saved',
      onDone: noop,
    });
    expect(screen.queryByTestId('fit-save-item')).toBeNull();
    expect(screen.queryByTestId('fit-save-outfit')).toBeNull();
    expect(screen.getByTestId('fit-message')).toBeTruthy();
    expect(screen.getByTestId('fit-done')).toBeTruthy();
  });
});
