import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { Point } from '@/core/model/types';
import { colors, minTouch } from '@/ui/theme';
import { createHandleResponder } from './handleResponder';
import { HANDLE_LABELS, unitsToPx, type HandleKey } from './landmarkDrag';

/** Dot size; the touch area around it is `minTouch` or more. */
const DOT = 18;
const DOT_ACTIVE = 28;

/** The browser must not scroll the page while a handle is being dragged. */
const NO_BROWSER_GESTURES = { touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle;

interface LandmarkHandleProps {
  handleKey: HandleKey;
  point: Point;
  /** Canvas width in px (converts units to px and pointer travel back to units). */
  canvasWidth: number;
  active: boolean;
  onStart: (key: HandleKey) => void;
  onMove: (key: HandleKey, to: Point) => void;
  onEnd: (key: HandleKey) => void;
}

/** One draggable dot. Drag with a finger or a mouse; the touch area is at least 44 pt. */
export function LandmarkHandle({
  handleKey,
  point,
  canvasWidth,
  active,
  onStart,
  onMove,
  onEnd,
}: LandmarkHandleProps) {
  const current = { point, canvasWidth, onStart, onMove, onEnd };
  const [session] = useState(() => createHandleResponder(handleKey, current));
  useEffect(() => {
    session.update({ point, canvasWidth, onStart, onMove, onEnd });
  });
  const responder = session.responder;

  const size = Math.max(minTouch, DOT_ACTIVE);
  const dot = active ? DOT_ACTIVE : DOT;
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={HANDLE_LABELS[handleKey]}
      testID={`me-handle-${handleKey}`}
      style={[
        styles.hit,
        NO_BROWSER_GESTURES,
        {
          width: size + 4,
          height: size + 4,
          left: unitsToPx(point.x, canvasWidth) - (size + 4) / 2,
          top: unitsToPx(point.y, canvasWidth) - (size + 4) / 2,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  dot: {
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
