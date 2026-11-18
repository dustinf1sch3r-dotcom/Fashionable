import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from '@/ui/SegmentedControl';

const OPTIONS = [
  { value: 'grid', label: 'Grid' },
  { value: 'list', label: 'List' },
] as const;

describe('SegmentedControl', () => {
  it('marks the current value selected and reports changes', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl options={OPTIONS} value="grid" onChange={onChange} testID="s" />,
    );
    expect(screen.getByRole('tab', { name: 'Grid' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'List' })).not.toBeSelected();
    await fireEvent.press(screen.getByTestId('s-list'));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});
