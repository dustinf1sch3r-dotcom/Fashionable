import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/ui/Button';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and reports disabled state', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('does not fire while loading and reports busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} loading testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeBusy();
  });
});
