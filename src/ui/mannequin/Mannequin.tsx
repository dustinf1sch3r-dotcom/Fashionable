import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import type { BodyTemplate, FitAdjust, ID, Item, Outfit, Placement } from '@/core/model/types';
import { placeOutfit } from '@/core/tryon/place';
import { colors, radius } from '@/ui/theme';
import { effectiveFit } from './fit';
import { createFitResponder } from './fitResponder';
import { fittedPlacement, type FittedLayer } from './fitted';
import { DebugOverlay, Silhouette } from './Silhouette';

/** Mannequin canvas in units (docs/TRY_ON.md §2). */
const UNITS_W = 1000;
const UNITS_H = 2000;

/** A garment without transparency is a plain photo: soften it so it reads as a paper doll. */
const OPAQUE_OPACITY = 0.92;
/** Corner radius of an opaque garment, in canvas units. */
const OPAQUE_RADIUS_UNITS = 28;
const SELECTION_WIDTH = 3;

interface MannequinProps {
  body: BodyTemplate;
  items: readonly Item[];
  /** Supplies `tucked` and `fitOverrides`. */
  outfit?: Outfit;
  /**
   * Displayable URIs, keyed by each item's `images.cutoutId`. The caller resolves them (the UI
   * layer may not import services); an item with no entry yet is drawn as a faint colour block.
   */
  imageUris: Readonly<Record<ID, string | undefined>>;
  selectedItemId?: ID;
  onSelectItem?: (itemId: ID) => void;
  /** Garments respond to taps. Defaults to true when `onSelectItem` is given. */
  interactive?: boolean;
  /** Draw landmarks, anchor boxes and placement boxes (tuning aid). */
  debug?: boolean;
  /**
   * Fit editing (docs/TRY_ON.md §6). With this set, an interactive mannequin lets the selected
   * garment be dragged (one finger or mouse), pinched to scale and twisted to rotate. The garment
   * follows the pointer live; this is called once, on release, with the new adjustment.
   */
  onFitChange?: (itemId: ID, fit: FitAdjust) => void;
  /**
   * The person's own photo (image URI, already cropped to the 1:2 canvas). When set it is drawn
   * instead of the silhouette, and `body` should carry the landmarks that belong to the photo.
   */
  backdrop?: string;
  /**
   * Garments already warped to the body (docs/TRY_ON.md §12.5), keyed by item id. Those items are
   * drawn from the warped image at its own bounds, with the item's `fitAdjust` on top; items
   * without an entry (not fittable, or still being computed) keep the rigid placement.
   */
  fitted?: Readonly<Record<ID, FittedLayer>>;
  testID?: string;
}

/** How long the warped image takes to fade in over the rigid one. */
const FADE_MS = 160;

/** The browser must not scroll or zoom the page while a garment is being moved. */
const NO_BROWSER_GESTURES = { touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle;

const pct = (v: number, total: number): string => `${Math.round((v / total) * 1e6) / 1e4}%`;

/** CSS-style percentage strings keep layout independent of the container's pixel size. */
export function placementStyle(p: Placement) {
  return {
    position: 'absolute',
    left: pct(p.x, UNITS_W),
    top: pct(p.y, UNITS_H),
    width: pct(p.width, UNITS_W),
    height: pct(p.height, UNITS_H),
    zIndex: p.z,
    ...(p.rotation !== 0 ? { transform: [{ rotate: `${p.rotation}deg` }] } : null),
  } as const;
}

interface LayerProps {
  placement: Placement;
  item: Item;
  uri: string | undefined;
  /** The warped image; `placement` is then its box rather than the rigid one. */
  fitted: FittedLayer | undefined;
  /** The rigid placement, kept underneath while the warped image fades in. */
  rigid: Placement;
  selected: boolean;
  interactive: boolean;
  debug: boolean;
  scale: number;
  onSelect?: (itemId: ID) => void;
}

const samePlacement = (a: Placement, b: Placement): boolean =>
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height &&
  a.rotation === b.rotation &&
  a.z === b.z;

function layerPropsEqual(a: LayerProps, b: LayerProps): boolean {
  return (
    samePlacement(a.placement, b.placement) &&
    a.item === b.item &&
    a.uri === b.uri &&
    a.fitted?.uri === b.fitted?.uri &&
    (a.fitted === undefined) === (b.fitted === undefined) &&
    samePlacement(a.rigid, b.rigid) &&
    a.selected === b.selected &&
    a.interactive === b.interactive &&
    a.debug === b.debug &&
    a.scale === b.scale &&
    a.onSelect === b.onSelect
  );
}

const Layer = memo(function Layer({
  placement,
  item,
  uri,
  fitted,
  rigid,
  selected,
  interactive,
  debug,
  scale,
  onSelect,
}: LayerProps) {
  const opaque = !item.cutout.hasAlpha;
  const cornerRadius = opaque ? OPAQUE_RADIUS_UNITS * scale : 0;

  // The first time a warped image appears it fades in over the rigid picture, so the garment does
  // not jump; afterwards (a new body, edited points) the swap is immediate.
  const [mountedFitted] = useState(fitted !== undefined);
  const [fade] = useState(() => new Animated.Value(mountedFitted ? 1 : 0));
  const [fading, setFading] = useState(false);
  const shown = useRef(mountedFitted);
  const hasFitted = fitted !== undefined;
  useEffect(() => {
    if (!hasFitted) {
      shown.current = false;
      fade.setValue(0);
      return;
    }
    if (shown.current) return;
    shown.current = true;
    setFading(true);
    Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: false }).start(() =>
      setFading(false),
    );
  }, [hasFitted, fade]);

  const rigidContent = uri ? (
    <Image
      source={{ uri }}
      resizeMode="contain"
      accessible={false}
      style={[styles.fill, { borderRadius: cornerRadius }, opaque && styles.opaque]}
      testID={`mannequin-image-${item.id}`}
    />
  ) : (
    <View
      style={[
        styles.fill,
        styles.pending,
        { backgroundColor: item.colors[0]?.hex ?? colors.border },
      ]}
    />
  );
  const content = fitted ? (
    <Animated.Image
      source={{ uri: fitted.uri }}
      resizeMode="stretch"
      accessible={false}
      style={[styles.fill, { opacity: fade }]}
      testID={`mannequin-fitted-${item.id}`}
    />
  ) : (
    rigidContent
  );

  const box = [
    placementStyle(placement),
    { borderRadius: fitted ? 0 : cornerRadius },
    selected && styles.selected,
    debug && styles.debugBox,
  ];
  const label = item.name ?? 'Garment';
  // While fading, the rigid picture stays underneath at its own box.
  const under =
    fitted && fading ? (
      <View style={placementStyle(rigid)} pointerEvents="none">
        {rigidContent}
      </View>
    ) : null;
  if (!interactive) {
    return (
      <>
        {under}
        <View style={box} pointerEvents="none" testID={`mannequin-item-${item.id}`}>
          {content}
        </View>
      </>
    );
  }
  return (
    <>
      {under}
      <Pressable
        style={box}
        onPress={() => onSelect?.(item.id)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        testID={`mannequin-item-${item.id}`}
      >
        {content}
      </Pressable>
    </>
  );
}, layerPropsEqual);

/**
 * Paper-doll try-on (docs/TRY_ON.md §9): a 1:2 container that scales to its parent's width, the
 * body silhouette at the bottom and one absolutely positioned image per placement, in z order.
 * Plain views and images only, so it renders the same on web, iOS and Android.
 */
export function Mannequin({
  body,
  items,
  outfit,
  imageUris,
  selectedItemId,
  onSelectItem,
  interactive,
  debug = false,
  onFitChange,
  backdrop,
  fitted,
  testID = 'mannequin',
}: MannequinProps) {
  const [width, setWidth] = useState(0);
  /** The selected garment's fit while a gesture is running; committed on release. */
  const [live, setLive] = useState<{ itemId: ID; fit: FitAdjust } | null>(null);
  const drawn = useMemo(
    () => (live ? withOverride(outfit, live.itemId, live.fit) : outfit),
    [outfit, live],
  );
  const placements = useMemo(() => placeOutfit(items, body, drawn), [items, body, drawn]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const tappable = interactive ?? onSelectItem !== undefined;
  const scale = width > 0 ? width / UNITS_W : 0.4;
  const selectedItem = selectedItemId ? byId.get(selectedItemId) : undefined;
  const fitEditing = tappable && onFitChange !== undefined && selectedItem !== undefined;

  // The responder is created once and told the latest values after every commit.
  const [session] = useState(() => createFitResponder(setLive));
  useEffect(() => {
    session.update({ width, outfit, selectedItem, enabled: fitEditing, onFitChange });
  });

  return (
    <View
      style={[styles.root, fitEditing && NO_BROWSER_GESTURES]}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      testID={testID}
      {...session.responder.panHandlers}
    >
      <View style={styles.fill} pointerEvents="none">
        {backdrop ? (
          <Image
            source={{ uri: backdrop }}
            resizeMode="cover"
            accessible={false}
            style={styles.fill}
            testID={`${testID}-backdrop`}
          />
        ) : (
          <Silhouette body={body} testID={`${testID}-silhouette`} />
        )}
      </View>
      {placements.map((p) => {
        const item = byId.get(p.itemId);
        if (!item) return null;
        const layer = fitted?.[item.id];
        return (
          <Layer
            key={p.itemId}
            placement={layer ? fittedPlacement(item.id, layer, effectiveFit(item, drawn), p.z) : p}
            rigid={p}
            fitted={layer}
            item={item}
            uri={imageUris[item.images.cutoutId]}
            selected={p.itemId === selectedItemId}
            interactive={tappable}
            debug={debug}
            scale={scale}
            onSelect={onSelectItem}
          />
        );
      })}
      {debug ? (
        <View style={[styles.fill, styles.overlay]} pointerEvents="none">
          <DebugOverlay body={body} testID={`${testID}-debug`} />
        </View>
      ) : null}
    </View>
  );
}

/** The outfit with one garment's fit replaced (an outfit is only read for `tucked` and overrides). */
function withOverride(outfit: Outfit | undefined, itemId: ID, fit: FitAdjust): Outfit {
  return {
    id: outfit?.id ?? 'draft',
    createdAt: outfit?.createdAt ?? '',
    updatedAt: outfit?.updatedAt ?? '',
    itemIds: outfit?.itemIds ?? [],
    source: outfit?.source ?? 'manual',
    favorite: outfit?.favorite ?? false,
    ...outfit,
    fitOverrides: { ...outfit?.fitOverrides, [itemId]: fit },
  };
}

const styles = StyleSheet.create({
  root: { width: '100%', aspectRatio: UNITS_W / UNITS_H, overflow: 'visible' },
  fill: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', left: 0, top: 0, zIndex: 1000 },
  opaque: { opacity: OPAQUE_OPACITY },
  pending: { opacity: 0.35, borderRadius: radius.sm },
  selected: { borderWidth: SELECTION_WIDTH, borderColor: colors.accent },
  debugBox: { borderWidth: 1, borderColor: colors.danger, borderStyle: 'dashed' },
});
