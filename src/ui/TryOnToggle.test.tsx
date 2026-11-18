import { fireEvent, render, screen } from '@testing-library/react-native';
import { TryOnToggle } from './TryOnToggle';

describe('TryOnToggle', () => {
  it('renders nothing without a photo', async () => {
    await render(<TryOnToggle mode="silhouette" onChange={jest.fn()} visible={false} />);
    expect(screen.queryByTestId('tryon-toggle')).toBeNull();
  });

  it('shows the current mode and reports a change', async () => {
    const onChange = jest.fn();
    await render(<TryOnToggle mode="photo" onChange={onChange} visible />);
    expect(screen.getByTestId('tryon-toggle-me')).toBeSelected();
    expect(screen.getByTestId('tryon-toggle-silhouette')).not.toBeSelected();
    await fireEvent.press(screen.getByTestId('tryon-toggle-silhouette'));
    expect(onChange).toHaveBeenCalledWith('silhouette');
    await fireEvent.press(screen.getByTestId('tryon-toggle-me'));
    expect(onChange).toHaveBeenCalledWith('photo');
  });
});
