import { memo, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { BodyTemplate, ID, Item, Outfit, Placement } from '@/core/model/types';
import { placeOutfit } from '@/core/tryon/place';
import { colors, radius } from '@/ui/theme';
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
  testID?: string;
}

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
  selected: boolean;
  interactive: boolean;
  debug: boolean;
  scale: number;
  onSelect?: (itemId: ID) => void;
}

const Layer = memo(function Layer({
  placement,
  item,
  uri,
  selected,
  interactive,
  debug,
  scale,
  onSelect,
}: LayerProps) {
  const opaque = !item.cutout.hasAlpha;
  const cornerRadius = opaque ? OPAQUE_RADIUS_UNITS * scale : 0;
  const box = [
    placementStyle(placement),
    { borderRadius: cornerRadius },
    selected && styles.selected,
    debug && styles.debugBox,
  ];
  const content = uri ? (
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
  const label = item.name ?? 'Garment';
  if (!interactive) {
    return (
      <View style={box} pointerEvents="none" testID={`mannequin-item-${item.id}`}>
        {content}
      </View>
    );
  }
  return (
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
  );
});

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
  testID = 'mannequin',
}: MannequinProps) {
  const [width, setWidth] = useState(0);
  const placements = useMemo(() => placeOutfit(items, body, outfit), [items, body, outfit]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const tappable = interactive ?? onSelectItem !== undefined;
  const scale = width > 0 ? width / UNITS_W : 0.4;

  return (
    <View
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      testID={testID}
    >
      <View style={styles.fill} pointerEvents="none">
        <Silhouette body={body} testID={`${testID}-silhouette`} />
      </View>
      {placements.map((p) => {
        const item = byId.get(p.itemId);
        if (!item) return null;
        return (
          <Layer
            key={p.itemId}
            placement={p}
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

const styles = StyleSheet.create({
  root: { width: '100%', aspectRatio: UNITS_W / UNITS_H, overflow: 'visible' },
  fill: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', left: 0, top: 0, zIndex: 1000 },
  opaque: { opacity: OPAQUE_OPACITY },
  pending: { opacity: 0.35, borderRadius: radius.sm },
  selected: { borderWidth: SELECTION_WIDTH, borderColor: colors.accent },
  debugBox: { borderWidth: 1, borderColor: colors.danger, borderStyle: 'dashed' },
});
