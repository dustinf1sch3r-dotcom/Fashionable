import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { rigPointNames } from '@/core/fit';
import type { GarmentRig, Item } from '@/core/model/types';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';
import { Mannequin } from '@/ui/mannequin';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { useFittedLayers } from '../../shared/fit/useFittedLayers';
import { PointHandle } from '../../shared/PointHandle';
import { useBody } from '../../shared/useBody';
import {
  asEdited,
  containBox,
  fromBoxPx,
  movePoint,
  orderedPointNames,
  pointLabel,
  samePoints,
  toBoxPx,
} from './pointsLogic';

const LOUPE = 104;
const LOUPE_ZOOM = 3;
const LOUPE_GAP = 36;
/** The preview follows the dragged points after this much quiet, not on every pointer move. */
const PREVIEW_DELAY_MS = 120;
const PREVIEW_WIDTH = 128;
/** Space around the picture inside the canvas, for dots on its edge. */
const CANVAS_PAD = 24;

interface GarmentPointsEditorProps {
  item: Item;
  /** Displayable URI of the item's cutout. */
  cutoutUri: string;
  /** The points to start from (the stored rig, or a fresh detection). */
  initial: GarmentRig;
  /** Automatic detection for "Reset to detected"; `undefined` while it is still being worked out. */
  detected: GarmentRig | undefined;
  onCancel: () => void;
  /** Called with the rig marked `edited: true`. */
  onSave: (rig: GarmentRig) => void;
}

/** A value that follows `value` after it has been still for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/**
 * Garment points editor (docs/TRY_ON.md §12.6): the cutout with a draggable dot per rig point and a
 * magnifier while dragging, next to a live preview of the garment fitted on the current body.
 */
export function GarmentPointsEditor({
  item,
  cutoutUri,
  initial,
  detected,
  onCancel,
  onSave,
}: GarmentPointsEditorProps) {
  const [rig, setRig] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const { body, backdrop } = useBody();

  const names = useMemo(() => orderedPointNames(rig, rigPointNames(rig.kind)), [rig]);
  const box = containBox(area.width, area.height, item.cutout.aspectRatio);

  const settled = useSettled(rig, PREVIEW_DELAY_MS);
  // The preview always fits: the user is checking these very points, however sure detection was.
  const previewItem = useMemo(
    () => ({ ...item, fit: { ...settled, edited: true } }),
    [item, settled],
  );
  const previewItems = useMemo(() => [previewItem], [previewItem]);
  const imageUris = useMemo(() => ({ [item.images.cutoutId]: cutoutUri }), [item, cutoutUri]);
  const fitted = useFittedLayers(previewItems, body, { imageUris, displayWidth: PREVIEW_WIDTH });

  const changed = !samePoints(rig, initial);
  const canReset = detected !== undefined && !samePoints(rig, detected);
  const active = dragging ? rig.points[dragging] : undefined;
  const activePx = active ? toBoxPx(active, box) : undefined;
  // The magnifier sits above the dot, or below it near the top edge.
  const loupe = activePx
    ? {
        x: Math.min(box.width - LOUPE, Math.max(0, activePx.x - LOUPE / 2)),
        y:
          activePx.y - LOUPE_GAP - LOUPE >= 0
            ? activePx.y - LOUPE_GAP - LOUPE
            : Math.min(box.height - LOUPE, activePx.y + LOUPE_GAP),
      }
    : undefined;

  return (
    <View style={styles.root} testID="points-editor">
      <View style={styles.header}>
        <IconButton
          icon="close"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          testID="points-cancel"
        />
        <Text accessibilityRole="header" style={styles.title}>
          Garment points
        </Text>
      </View>
      <Text style={styles.hint}>
        Drag each dot onto the matching spot on the garment. The preview shows how it will sit on
        you.
      </Text>

      <View style={styles.stage}>
        <View style={styles.canvas} testID="points-canvas">
          {/* Padded, so dots on the picture's edge (cuffs, hem) stay whole and easy to grab. */}
          <View
            style={styles.canvasInner}
            testID="points-canvas-area"
            onLayout={(e: LayoutChangeEvent) =>
              setArea({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }
          >
            {box.width > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  left: box.x,
                  top: box.y,
                  width: box.width,
                  height: box.height,
                }}
              >
                <Image
                  source={{ uri: cutoutUri }}
                  resizeMode="stretch"
                  accessibilityLabel="Garment picture"
                  style={styles.fill}
                  testID="points-image"
                />
                {names.map((name) => {
                  const p = rig.points[name];
                  if (!p) return null;
                  const px = toBoxPx(p, box);
                  return (
                    <PointHandle
                      key={name}
                      name={name}
                      label={pointLabel(name)}
                      x={px.x}
                      y={px.y}
                      active={dragging === name}
                      testIdPrefix="points-handle"
                      onStart={setDragging}
                      onMove={(n, to) => setRig((r) => movePoint(r, n, fromBoxPx(to, box)))}
                      onEnd={() => setDragging(null)}
                    />
                  );
                })}
                {dragging && activePx && loupe ? (
                  <View pointerEvents="none" style={styles.loupeLayer}>
                    <View
                      style={[styles.loupe, { left: loupe.x, top: loupe.y }]}
                      testID="points-loupe"
                    >
                      <Image
                        source={{ uri: cutoutUri }}
                        resizeMode="stretch"
                        style={{
                          position: 'absolute',
                          width: box.width * LOUPE_ZOOM,
                          height: box.height * LOUPE_ZOOM,
                          left: LOUPE / 2 - activePx.x * LOUPE_ZOOM,
                          top: LOUPE / 2 - activePx.y * LOUPE_ZOOM,
                        }}
                      />
                      <View style={styles.crossH} />
                      <View style={styles.crossV} />
                    </View>
                    <View
                      style={[
                        styles.tag,
                        {
                          left: Math.min(box.width - 150, Math.max(0, loupe.x + LOUPE / 2 - 75)),
                          top: Math.max(0, loupe.y - 26),
                        },
                      ]}
                    >
                      <Text style={styles.tagText} testID="points-handle-label">
                        {pointLabel(dragging)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.preview} testID="points-preview">
          <Mannequin
            body={body}
            {...(backdrop ? { backdrop } : {})}
            items={previewItems}
            imageUris={imageUris}
            fitted={fitted}
            interactive={false}
            testID="points-preview-mannequin"
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Reset to detected"
          icon="refresh"
          variant="secondary"
          disabled={!canReset}
          onPress={() => detected && setRig(detected)}
          testID="points-reset"
        />
        <Button
          label="Save"
          icon="checkmark"
          disabled={!changed}
          onPress={() => onSave(asEdited(rig))}
          testID="points-save"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.heading, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  stage: { flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 0 },
  canvas: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    padding: CANVAS_PAD,
  },
  canvasInner: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  preview: {
    width: PREVIEW_WIDTH,
    alignSelf: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  loupeLayer: { ...StyleSheet.absoluteFill, zIndex: 20 },
  loupe: {
    position: 'absolute',
    width: LOUPE,
    height: LOUPE,
    borderRadius: LOUPE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.surfaceAlt,
  },
  crossH: {
    position: 'absolute',
    left: LOUPE / 2 - 10,
    top: LOUPE / 2 - 1,
    width: 20,
    height: 2,
    backgroundColor: colors.accent,
  },
  crossV: {
    position: 'absolute',
    top: LOUPE / 2 - 10,
    left: LOUPE / 2 - 1,
    height: 20,
    width: 2,
    backgroundColor: colors.accent,
  },
  tag: {
    position: 'absolute',
    width: 150,
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tagText: { ...typography.caption, color: colors.surface },
});
