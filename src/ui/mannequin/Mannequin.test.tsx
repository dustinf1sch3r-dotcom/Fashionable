import { fireEvent, render, screen } from '@testing-library/react-native';
import { newOutfit } from '@/core/model/factories';
import { fixedClock } from '@/core/testing/clock';
import { slotOf } from '@/core/model/slots';
import { fixtureById } from '@/core/testing/fixtures';
import { BODY_A } from '@/core/tryon/bodies';
import { placeOutfit } from '@/core/tryon/place';
import { Mannequin, placementStyle } from './Mannequin';

const ids = ['jeans-dark', 'tee-white', 'sneakers-white', 'belt-brown-leather'];
const items = ids.map((id) => fixtureById(id));
const uris = Object.fromEntries(items.map((i) => [i.images.cutoutId, `uri://${i.id}`]));

function styleOf(id: string) {
  const flat = screen.getByTestId(`mannequin-item-${id}`).props.style;
  return Object.assign({}, ...(Array.isArray(flat) ? flat.flat(Infinity) : [flat]));
}

describe('Mannequin', () => {
  it('maps placements to percentage styles in z order', async () => {
    await render(<Mannequin body={BODY_A} items={items} imageUris={uris} />);
    const placements = placeOutfit(items, BODY_A);
    for (const p of placements) {
      const s = styleOf(p.itemId);
      expect(s.position).toBe('absolute');
      expect(parseFloat(s.left)).toBeCloseTo(p.x / 10, 3);
      expect(s.left).toMatch(/%$/);
      expect(parseFloat(s.top)).toBeCloseTo(p.y / 20, 3);
      expect(s.top).toMatch(/%$/);
      expect(parseFloat(s.width)).toBeCloseTo(p.width / 10, 3);
      expect(s.width).toMatch(/%$/);
      expect(parseFloat(s.height)).toBeCloseTo(p.height / 20, 3);
      expect(s.height).toMatch(/%$/);
      expect(s.zIndex).toBe(p.z);
    }
    const order = items
      .map((i) => ({ slot: slotOf(i), z: styleOf(i.id).zIndex as number }))
      .sort((a, b) => a.z - b.z)
      .map((x) => x.slot);
    expect(order).toEqual(['bottom', 'shoes', 'base', 'belt']);
  });

  it('draws the backdrop photo only when given', async () => {
    const { rerender } = await render(<Mannequin body={BODY_A} items={items} imageUris={uris} />);
    expect(screen.queryByTestId('mannequin-backdrop')).toBeNull();
    await rerender(<Mannequin body={BODY_A} items={items} imageUris={uris} backdrop="blob:me" />);
    expect(screen.getByTestId('mannequin-backdrop').props.source).toEqual({ uri: 'blob:me' });
    // Garments are still placed from the body landmarks.
    expect(screen.getByTestId('mannequin-item-jeans-dark')).toBeTruthy();
  });

  it('applies rotation from the item fit', async () => {
    const tee = {
      ...fixtureById('tee-white'),
      fitAdjust: { dx: 0, dy: 0, scale: 1, rotation: 12 },
    };
    await render(<Mannequin body={BODY_A} items={[tee]} imageUris={{}} />);
    expect(styleOf('tee-white').transform).toEqual([{ rotate: '12deg' }]);
  });

  it('places the tucked base under the bottom', async () => {
    const outfit = newOutfit(
      { itemIds: ids, tucked: true },
      fixedClock('2026-01-01T00:00:00.000Z'),
      { uuid: () => 'o1' },
    );
    await render(<Mannequin body={BODY_A} items={items} outfit={outfit} imageUris={uris} />);
    expect(styleOf('tee-white').zIndex).toBeLessThan(styleOf('jeans-dark').zIndex as number);
  });

  it('reports taps and marks the selected item', async () => {
    const onSelect = jest.fn();
    await render(
      <Mannequin
        body={BODY_A}
        items={items}
        imageUris={uris}
        onSelectItem={onSelect}
        selectedItemId="tee-white"
      />,
    );
    await fireEvent.press(screen.getByTestId('mannequin-item-jeans-dark'));
    expect(onSelect).toHaveBeenCalledWith('jeans-dark');
    expect(styleOf('tee-white').borderWidth).toBeGreaterThan(0);
    expect(styleOf('jeans-dark').borderWidth).toBeUndefined();
  });

  it('softens items without alpha', async () => {
    const photo = { ...fixtureById('tee-white'), cutout: { aspectRatio: 1, hasAlpha: false } };
    await render(
      <Mannequin body={BODY_A} items={[photo]} imageUris={{ [photo.images.cutoutId]: 'u' }} />,
    );
    expect(styleOf('tee-white').borderRadius).toBeGreaterThan(0);
    const img = screen.getByTestId('mannequin-image-tee-white').props.style;
    expect(Object.assign({}, ...img.flat(Infinity)).opacity).toBeLessThan(1);
  });

  it('draws debug landmarks only when asked', async () => {
    const { rerender } = await render(<Mannequin body={BODY_A} items={[]} imageUris={{}} />);
    expect(screen.queryByTestId('mannequin-debug')).toBeNull();
    await rerender(<Mannequin body={BODY_A} items={[]} imageUris={{}} debug />);
    expect(screen.getByTestId('mannequin-debug')).toBeTruthy();
  });

  it('exposes placementStyle without rotation transform at 0', async () => {
    const [p] = placeOutfit([items[0] as (typeof items)[number]], BODY_A);
    expect(placementStyle(p as NonNullable<typeof p>)).not.toHaveProperty('transform');
  });
});
