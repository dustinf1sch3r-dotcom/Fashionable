import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { BodyLandmarks, ID, Item, Point } from '@/core/model/types';
import { Mannequin } from '@/ui/mannequin';
import { useFittedLayers } from '../shared/fit/useFittedLayers';
import { colors, radius, spacing, typography } from '@/ui/theme';
import { LandmarkHandle } from './LandmarkHandle';
import {
  CANVAS_UNITS,
  HANDLE_KEYS,
  HANDLE_LABELS,
  loupePosition,
  moveLandmark,
  unitsToPx,
  type HandleKey,
} from './landmarkDrag';

const LOUPE = 112;
const LOUPE_ZOOM = 3;
const LOUPE_GAP = 40;

/** Pairs of landmarks joined by a thin line so the dots read as a body. */
const BONES: readonly (readonly [keyof BodyLandmarks, keyof BodyLandmarks])[] = [
  ['headTop', 'chin'],
  ['shoulderL', 'shoulderR'],
  ['shoulderL', 'wristL'],
  ['shoulderR', 'wristR'],
  ['shoulderL', 'waistL'],
  ['shoulderR', 'waistR'],
  ['waistL', 'hipL'],
  ['waistR', 'hipR'],
  ['hipL', 'hipR'],
  ['hipL', 'kneeL'],
  ['hipR', 'kneeR'],
  ['kneeL', 'ankleL'],
  ['kneeR', 'ankleR'],
  ['ankleL', 'footL'],
  ['ankleR', 'footR'],
];

interface LandmarkEditorProps {
  /** The cropped 1:2 photo. */
  uri: string;
  landmarks: BodyLandmarks;
  onChange: (landmarks: BodyLandmarks) => void;
  /** Show a sample outfit on the photo instead of the handles. */
  preview: boolean;
  sample: { items: readonly Item[]; imageUris: Readonly<Record<ID, string | undefined>> };
}

/** The photo with a draggable dot per landmark, or the live outfit preview on the same photo. */
export function LandmarkEditor({ uri, landmarks, onChange, preview, sample }: LandmarkEditorProps) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<HandleKey | null>(null);
  const height = (width * CANVAS_UNITS.height) / CANVAS_UNITS.width;
  const previewBody = useMemo(() => ({ id: 'photo', landmarks }), [landmarks]);
  const fitted = useFittedLayers(sample.items, previewBody, {
    imageUris: sample.imageUris,
    displayWidth: width || 300,
    enabled: preview,
  });

  const toPx = (p: Point): Point => ({ x: unitsToPx(p.x, width), y: unitsToPx(p.y, width) });
  const active = dragging ? toPx(landmarks[dragging]) : null;
  const loupe = active ? loupePosition(active, { width, height }, LOUPE, LOUPE_GAP) : null;

  return (
    <View
      style={styles.canvas}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      testID="me-canvas"
    >
      {preview ? (
        <Mannequin
          body={{ id: 'photo', landmarks }}
          backdrop={uri}
          items={sample.items}
          imageUris={sample.imageUris}
          fitted={fitted}
          interactive={false}
          testID="me-preview-mannequin"
        />
      ) : (
        <>
          <Image
            source={{ uri }}
            resizeMode="cover"
            accessibilityLabel="Your photo"
            style={styles.photo}
            testID="me-photo"
          />
          {width > 0 ? (
            <>
              <Svg
                width={width}
                height={height}
                viewBox={`0 0 ${CANVAS_UNITS.width} ${CANVAS_UNITS.height}`}
                style={styles.bones}
                pointerEvents="none"
              >
                {BONES.map(([a, b]) => (
                  <Line
                    key={`${a}-${b}`}
                    x1={landmarks[a].x}
                    y1={landmarks[a].y}
                    x2={landmarks[b].x}
                    y2={landmarks[b].y}
                    stroke={colors.surface}
                    strokeWidth={9}
                    strokeOpacity={0.7}
                    strokeLinecap="round"
                  />
                ))}
                {BONES.map(([a, b]) => (
                  <Line
                    key={`in-${a}-${b}`}
                    x1={landmarks[a].x}
                    y1={landmarks[a].y}
                    x2={landmarks[b].x}
                    y2={landmarks[b].y}
                    stroke={colors.accent}
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                ))}
              </Svg>
              {HANDLE_KEYS.map((key) => (
                <LandmarkHandle
                  key={key}
                  handleKey={key}
                  point={landmarks[key]}
                  canvasWidth={width}
                  active={dragging === key}
                  onStart={setDragging}
                  onMove={(k, to) => onChange(moveLandmark(landmarks, k, to))}
                  onEnd={() => setDragging(null)}
                />
              ))}
              {dragging && active && loupe ? (
                <View pointerEvents="none" style={styles.loupeLayer}>
                  <View style={[styles.loupe, { left: loupe.x, top: loupe.y }]} testID="me-loupe">
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      style={{
                        position: 'absolute',
                        width: width * LOUPE_ZOOM,
                        height: height * LOUPE_ZOOM,
                        left: LOUPE / 2 - active.x * LOUPE_ZOOM,
                        top: LOUPE / 2 - active.y * LOUPE_ZOOM,
                      }}
                    />
                    <View style={styles.crossH} />
                    <View style={styles.crossV} />
                  </View>
                  <View
                    style={[
                      styles.tag,
                      {
                        left: Math.min(width - 150, Math.max(0, loupe.x + LOUPE / 2 - 75)),
                        top: Math.max(0, loupe.y - 26),
                      },
                    ]}
                  >
                    <Text style={styles.tagText} testID="me-handle-label">
                      {HANDLE_LABELS[dragging]}
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    aspectRatio: CANVAS_UNITS.width / CANVAS_UNITS.height,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  photo: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  bones: { position: 'absolute', left: 0, top: 0 },
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
