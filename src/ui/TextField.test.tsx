import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '@/ui/TextField';

describe('TextField', () => {
  it('shows helper text when valid', async () => {
    await render(
      <TextField label="Name" value="" onChangeText={jest.fn()} helperText="Be short" testID="t" />,
    );
    expect(screen.getByText('Be short')).toBeTruthy();
    expect(screen.queryByTestId('t-error')).toBeNull();
  });

  it('shows the error instead of helper text, as an alert', async () => {
    await render(
      <TextField
        label="Name"
        value=""
        onChangeText={jest.fn()}
        helperText="Be short"
        errorText="Required"
        testID="t"
      />,
    );
    expect(screen.getByTestId('t-error')).toHaveTextContent(/Required/);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Be short')).toBeNull();
  });

  it('forwards typed text', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Name" value="" onChangeText={onChangeText} testID="t" />);
    await fireEvent.changeText(screen.getByTestId('t'), 'Blazer');
    expect(onChangeText).toHaveBeenCalledWith('Blazer');
  });
});
