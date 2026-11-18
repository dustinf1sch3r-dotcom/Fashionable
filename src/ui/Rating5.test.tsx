import { fireEvent, render, screen } from '@testing-library/react-native';

import { Rating5 } from '@/ui/Rating5';

describe('Rating5', () => {
  it('selects the tapped value and marks it checked', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(
      <Rating5
        label="Warmth"
        lowLabel="Light"
        highLabel="Cosy"
        value={null}
        onChange={onChange}
        testID="r"
      />,
    );
    await fireEvent.press(screen.getByTestId('r-4'));
    expect(onChange).toHaveBeenCalledWith(4);
    await rerender(
      <Rating5
        label="Warmth"
        lowLabel="Light"
        highLabel="Cosy"
        value={4}
        onChange={onChange}
        testID="r"
      />,
    );
    expect(screen.getByRole('radio', { name: 'Warmth 4 of 5' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Warmth 3 of 5' })).not.toBeChecked();
  });

  it('shows both end labels', async () => {
    await render(
      <Rating5
        label="Warmth"
        lowLabel="Light"
        highLabel="Cosy"
        value={null}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Cosy')).toBeTruthy();
  });
});
