import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { AlphaMask } from '@/core/fit';
import { garmentMask } from '@/core/testing/garmentMasks';
import { BOTTOM_FOLDED_HINT, CAPTURE_HINTS, captureHintFor } from './captureHints';
import type { ProcessedPhoto } from './processPhoto';
import { TagForm } from './TagForm';

const rendered = (uri: string) => ({ uri, width: 100, height: 100 });

function photo(mask?: AlphaMask, cut = true): ProcessedPhoto {
  return {
    original: rendered('blob:o'),
    thumb: rendered('blob:t'),
    colors: [{ name: 'blue', hex: '#2a4f8f', share: 1 }],
    aspectRatio: 1,
    ...(cut ? { cutout: { image: rendered('blob:c'), thumb: rendered('blob:ct') } } : {}),
    ...(mask ? { cutoutMask: mask } : {}),
  };
}

const whole = garmentMask('tee', { height: 256 }).mask;
const cutOff = garmentMask('tee', { height: 256, margin: 0 }).mask;
/** Jeans with the gap between the legs closed (folded or hung together). */
function closedJeans(): AlphaMask {
  const g = garmentMask('jeans', { height: 256 }).mask;
  const alpha = Uint8Array.from(g.alpha);
  for (let y = 0; y < g.height; y++) {
    let a = -1;
    let b = -1;
    for (let x = 0; x < g.width; x++) {
      if (alpha[y * g.width + x]) {
        if (a < 0) a = x;
        b = x;
      }
    }
    for (let x = a; x <= b && a >= 0; x++) alpha[y * g.width + x] = 255;
  }
  return { width: g.width, height: g.height, alpha };
}

/** The hint is worked out just after the first paint. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

async function renderForm(
  p: ProcessedPhoto,
  useOriginal = false,
  category: 'top' | 'bottom' = 'top',
) {
  await render(
    <TagForm
      photo={p}
      useOriginal={useOriginal}
      onToggleOriginal={() => undefined}
      saving={false}
      error={null}
      onSave={() => undefined}
      onChangePhoto={() => undefined}
      initialCategory={category}
    />,
  );
  await settle();
}

describe('captureHintFor', () => {
  it('says nothing for a whole garment, for no mask, and for a kind it cannot judge', () => {
    expect(captureHintFor(whole, 'top', 'tshirt')).toBeUndefined();
    expect(captureHintFor(undefined, 'top', 'tshirt')).toBeUndefined();
    expect(captureHintFor(whole, 'shoes', 'sneakers')).toBeUndefined();
  });

  it('warns about a cut-off garment, also for items that are not fitted', () => {
    expect(captureHintFor(cutOff, 'top', 'tshirt')).toBe(CAPTURE_HINTS['cut-off']);
    expect(captureHintFor(cutOff, 'shoes', 'sneakers')).toBe(CAPTURE_HINTS['cut-off']);
  });

  it('has its own wording for trousers with no gap between the legs', () => {
    expect(captureHintFor(closedJeans(), 'bottom', 'jeans')).toBe(BOTTOM_FOLDED_HINT);
  });

  it('the cut-off copy asks for the whole piece laid flat', () => {
    expect(CAPTURE_HINTS['cut-off']).toMatch(/cut off/);
    expect(CAPTURE_HINTS['cut-off']).toMatch(/whole piece laid flat/);
  });
});

describe('TagForm capture hint', () => {
  it('shows the hint for a cut-off cutout', async () => {
    await renderForm(photo(cutOff));
    expect(screen.getByTestId('add-item-capture-hint')).toHaveTextContent(CAPTURE_HINTS['cut-off']);
  });

  it('shows nothing for a whole garment or when the mask is unknown', async () => {
    await renderForm(photo(whole));
    expect(screen.queryByTestId('add-item-capture-hint')).toBeNull();
    await screen.unmount();
    await renderForm(photo(undefined));
    expect(screen.queryByTestId('add-item-capture-hint')).toBeNull();
  });

  it('shows nothing for a plain photo without a cutout', async () => {
    await renderForm(photo(cutOff, false));
    expect(screen.queryByTestId('add-item-capture-hint')).toBeNull();
  });

  it('does not block saving: the save button stays enabled', async () => {
    await renderForm(photo(cutOff));
    expect(screen.getByTestId('add-item-save')).not.toBeDisabled();
  });

  it('follows the category the user picks', async () => {
    await renderForm(photo(closedJeans()), false, 'bottom');
    await fireEvent.press(screen.getByTestId('add-item-subcategory-jeans'));
    await settle();
    expect(screen.getByTestId('add-item-capture-hint')).toHaveTextContent(BOTTOM_FOLDED_HINT);
    await fireEvent.press(screen.getByTestId('add-item-category-top'));
    await settle();
    expect(screen.getByTestId('add-item-capture-hint')).not.toHaveTextContent(BOTTOM_FOLDED_HINT);
  });

  it('is hidden while the original photo is used', async () => {
    await renderForm(photo(cutOff), true);
    expect(screen.queryByTestId('add-item-capture-hint')).toBeNull();
  });
});
