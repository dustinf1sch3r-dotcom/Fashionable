import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, minTouch } from '@/ui/theme';
import { createPointResponder } from './pointResponder';

/** Dot size; the touch area around it is `minTouch` or more. */
const DOT = 18;
const DOT_ACTIVE = 28;

/** The browser must not scroll the page while a handle is being dragged. */
const NO_BROWSER_GESTURES = { touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle;

interface PointHandleProps {
  /** Identifies the point in the callbacks and in the test id (`<testIdPrefix>-<name>`). */
  name: string;
  label: string;
  /** Position in px inside the handle's parent. */
  x: number;
  y: number;
  active: boolean;
  testIdPrefix: string;
  onStart: (name: string) => void;
  /** The point's new position in px: where it started plus the pointer's travel. */
  onMove: (name: string, to: { x: number; y: number }) => void;
  onEnd: (name: string) => void;
}

/**
 * One draggable dot positioned in pixels, for points that are not body landmarks (garment
 * points). Same look and touch area as `LandmarkHandle`; drag with a finger or a mouse.
 */
export function PointHandle({
  name,
  label,
  x,
  y,
  active,
  testIdPrefix,
  onStart,
  onMove,
  onEnd,
}: PointHandleProps) {
  const [session] = useState(() => createPointResponder(name, { x, y, onStart, onMove, onEnd }));
  useEffect(() => {
    session.update({ x, y, onStart, onMove, onEnd });
  });
  const responder = session.responder;

  const size = Math.max(minTouch, DOT_ACTIVE) + 4;
  const dot = active ? DOT_ACTIVE : DOT;
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      testID={`${testIdPrefix}-${name}`}
      style={[
        styles.hit,
        NO_BROWSER_GESTURES,
        { width: size, height: size, left: x - size / 2, top: y - size / 2 },
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
