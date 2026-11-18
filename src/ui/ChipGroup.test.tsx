import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ChipGroup } from '@/ui/ChipGroup';

type Tag = 'a' | 'b' | 'c';
const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const satisfies readonly { value: Tag; label: string }[];

function Single() {
  const [v, setV] = useState<Tag | null>('a');
  return <ChipGroup options={OPTIONS} value={v} onChange={setV} testID="g" />;
}

function Multi() {
  const [v, setV] = useState<Tag[]>(['a']);
  return <ChipGroup multiple options={OPTIONS} value={v} onChange={setV} testID="g" />;
}

describe('ChipGroup', () => {
  it('single select keeps exactly one chip selected', async () => {
    await render(<Single />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
    await fireEvent.press(screen.getByTestId('g-b'));
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Alpha' })).not.toBeChecked();
  });

  it('multi select toggles chips independently', async () => {
    await render(<Multi />);
    await fireEvent.press(screen.getByTestId('g-c'));
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Gamma' })).toBeChecked();
    await fireEvent.press(screen.getByTestId('g-a'));
    expect(screen.getByRole('checkbox', { name: 'Alpha' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Gamma' })).toBeChecked();
  });

  it('reports the new value through onChange', async () => {
    const onChange = jest.fn();
    await render(
      <ChipGroup multiple options={OPTIONS} value={['b']} onChange={onChange} testID="g" />,
    );
    await fireEvent.press(screen.getByTestId('g-a'));
    expect(onChange).toHaveBeenCalledWith(['b', 'a']);
  });
});
