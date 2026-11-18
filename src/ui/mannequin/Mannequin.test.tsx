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

  describe('merged picture', () => {
    it('draws the merged image over the layers and keeps the garments tappable', async () => {
      const onSelectItem = jest.fn();
      await render(
        <Mannequin
          body={BODY_A}
          items={items}
          imageUris={uris}
          merged="blob:merged"
          onSelectItem={onSelectItem}
        />,
      );
      const merged = screen.getByTestId('mannequin-merged');
      expect(merged.props.source).toEqual({ uri: 'blob:merged' });
      // It never takes touches; the garments underneath still do.
      expect(merged.props.pointerEvents).toBe('none');
      expect(screen.getByTestId('mannequin-item-tee-white')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('mannequin-item-tee-white'));
      expect(onSelectItem).toHaveBeenCalledWith('tee-white');
    });

    it('shows the layers only while a garment is selected for editing', async () => {
      const { rerender } = await render(
        <Mannequin
          body={BODY_A}
          items={items}
          imageUris={uris}
          merged="blob:merged"
          onSelectItem={() => undefined}
          onFitChange={() => undefined}
        />,
      );
      expect(screen.getByTestId('mannequin-merged')).toBeTruthy();
      await rerender(
        <Mannequin
          body={BODY_A}
          items={items}
          imageUris={uris}
          merged="blob:merged"
          selectedItemId="tee-white"
          onSelectItem={() => undefined}
          onFitChange={() => undefined}
        />,
      );
      expect(screen.queryByTestId('mannequin-merged')).toBeNull();
      expect(screen.getByTestId('mannequin-item-tee-white')).toBeTruthy();
      await rerender(
        <Mannequin
          body={BODY_A}
          items={items}
          imageUris={uris}
          merged="blob:merged"
          onSelectItem={() => undefined}
          onFitChange={() => undefined}
        />,
      );
      expect(screen.getByTestId('mannequin-merged')).toBeTruthy();
    });

    it('draws only the layers without a merged picture, and swaps when it changes', async () => {
      const { rerender } = await render(<Mannequin body={BODY_A} items={items} imageUris={uris} />);
      expect(screen.queryByTestId('mannequin-merged')).toBeNull();
      await rerender(<Mannequin body={BODY_A} items={items} imageUris={uris} merged="blob:a" />);
      expect(screen.getByTestId('mannequin-merged').props.source).toEqual({ uri: 'blob:a' });
      await rerender(<Mannequin body={BODY_A} items={items} imageUris={uris} merged="blob:b" />);
      expect(screen.getByTestId('mannequin-merged').props.source).toEqual({ uri: 'blob:b' });
    });
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

  describe('fitted garments', () => {
    const tee = fixtureById('tee-white');
    const fittedTee = {
      uri: 'blob:fitted-tee',
      bounds: { x: 250, y: 380, width: 500, height: 560 },
    };

    it('draws a fitted item from its warped image at its own bounds, others stay rigid', async () => {
      const jeans = fixtureById('jeans-dark');
      const both = [tee, jeans];
      const both_uris = Object.fromEntries(both.map((i) => [i.images.cutoutId, `uri://${i.id}`]));
      await render(
        <Mannequin
          body={BODY_A}
          items={both}
          imageUris={both_uris}
          fitted={{ [tee.id]: fittedTee }}
        />,
      );
      const fitted = screen.getByTestId('mannequin-fitted-tee-white');
      expect(fitted.props.source).toEqual({ uri: 'blob:fitted-tee' });
      const s = styleOf('tee-white');
      expect(parseFloat(s.left)).toBeCloseTo(25, 3);
      expect(parseFloat(s.top)).toBeCloseTo(19, 3);
      expect(parseFloat(s.width)).toBeCloseTo(50, 3);
      expect(parseFloat(s.height)).toBeCloseTo(28, 3);
      // the other garment is the plain picture
      expect(screen.queryByTestId('mannequin-fitted-jeans-dark')).toBeNull();
      expect(screen.getByTestId('mannequin-image-jeans-dark')).toBeTruthy();
    });

    it('keeps the layer order, including the tucked shirt', async () => {
      const jeans = fixtureById('jeans-dark');
      const outfit = newOutfit(
        { itemIds: [tee.id, jeans.id], tucked: true },
        fixedClock('2026-01-01T00:00:00.000Z'),
        { uuid: () => 'o1' },
      );
      await render(
        <Mannequin
          body={BODY_A}
          items={[tee, jeans]}
          outfit={outfit}
          imageUris={{}}
          fitted={{ [tee.id]: fittedTee }}
        />,
      );
      const z = placeOutfit([tee, jeans], BODY_A, outfit).find((p) => p.itemId === tee.id)?.z;
      expect(styleOf('tee-white').zIndex).toBe(z);
    });

    it('applies the item fit on top of the fitted image', async () => {
      const nudged = { ...tee, fitAdjust: { dx: 30, dy: -10, scale: 1, rotation: 6 } };
      await render(
        <Mannequin
          body={BODY_A}
          items={[nudged]}
          imageUris={{}}
          fitted={{ [tee.id]: fittedTee }}
        />,
      );
      const s = styleOf('tee-white');
      expect(parseFloat(s.left)).toBeCloseTo(28, 3);
      expect(parseFloat(s.top)).toBeCloseTo(18.5, 3);
      expect(s.transform).toEqual([{ rotate: '6deg' }]);
    });

    it('shows the rigid picture while no fitted image exists, and stays tappable', async () => {
      const onSelect = jest.fn();
      await render(
        <Mannequin
          body={BODY_A}
          items={[tee]}
          imageUris={{ [tee.images.cutoutId]: 'uri://tee' }}
          onSelectItem={onSelect}
        />,
      );
      expect(screen.getByTestId('mannequin-image-tee-white')).toBeTruthy();
      expect(screen.queryByTestId('mannequin-fitted-tee-white')).toBeNull();
      await fireEvent.press(screen.getByTestId('mannequin-item-tee-white'));
      expect(onSelect).toHaveBeenCalledWith('tee-white');
    });
  });
});
