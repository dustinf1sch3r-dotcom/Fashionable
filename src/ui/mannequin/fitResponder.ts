import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type PanResponderInstance,
} from 'react-native';
import type { FitAdjust, ID, Item, Outfit } from '@/core/model/types';
import {
  applyGesture,
  DRAG_SLOP_PX,
  effectiveFit,
  sameFit,
  type GestureBase,
  type GestureNow,
} from './fit';

/** What the responder needs to know at the moment a gesture starts or moves. */
export interface FitResponderState {
  /** Rendered mannequin width in px (converts pointer travel to mannequin units). */
  width: number;
  outfit: Outfit | undefined;
  selectedItem: Item | undefined;
  /** Fit editing is switched on (interactive, a handler is set and a garment is selected). */
  enabled: boolean;
  onFitChange: ((itemId: ID, fit: FitAdjust) => void) | undefined;
}

/** A responder plus a way to tell it the latest props (call after every commit). */
export interface FitResponder {
  responder: PanResponderInstance;
  update: (state: FitResponderState) => void;
}

interface Running {
  itemId: ID;
  cur: FitAdjust;
  base: GestureBase;
  touches: number;
}

/** Two-finger geometry of an event (distance and angle in degrees); empty for fewer fingers. */
function touchGeometry(e: GestureResponderEvent): Pick<GestureNow, 'distance' | 'angle'> {
  const [a, b] = e.nativeEvent.touches;
  if (!a || !b) return {};
  const dx = b.pageX - a.pageX;
  const dy = b.pageY - a.pageY;
  return { distance: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/**
 * Drag / pinch / twist for the selected garment, built on React Native's PanResponder so it works
 * with a mouse on web and with fingers on a phone, with no extra packages.
 *
 * It only claims the touch once the pointer has moved past `DRAG_SLOP_PX` (or a second finger
 * lands), so plain taps still reach the garments underneath and select them. The garment follows
 * the pointer through `onLive`; `onFitChange` is called once on release.
 */
export function createFitResponder(
  onLive: (live: { itemId: ID; fit: FitAdjust } | null) => void,
): FitResponder {
  let running: Running | null = null;
  let state: FitResponderState = {
    width: 0,
    outfit: undefined,
    selectedItem: undefined,
    enabled: false,
    onFitChange: undefined,
  };
  const read = (): FitResponderState => state;

  const wants = (e: GestureResponderEvent, g: PanResponderGestureState): boolean =>
    read().enabled && (Math.hypot(g.dx, g.dy) > DRAG_SLOP_PX || e.nativeEvent.touches.length >= 2);

  const grant = (e: GestureResponderEvent, g: PanResponderGestureState) => {
    const { selectedItem, outfit } = read();
    if (!selectedItem) return;
    const cur = effectiveFit(selectedItem, outfit);
    running = {
      itemId: selectedItem.id,
      cur,
      // Measured from where the drag was claimed, so the garment does not jump by the slop.
      base: { fit: cur, panX: g.dx, panY: g.dy, ...touchGeometry(e) },
      touches: e.nativeEvent.touches.length,
    };
  };

  const move = (e: GestureResponderEvent, g: PanResponderGestureState) => {
    if (!running) return;
    const touches = e.nativeEvent.touches.length;
    if (touches !== running.touches) {
      // A finger was added or lifted: carry on from where the garment is now.
      running.touches = touches;
      running.base = { fit: running.cur, panX: g.dx, panY: g.dy, ...touchGeometry(e) };
    }
    const now: GestureNow = { panX: g.dx, panY: g.dy, ...touchGeometry(e) };
    const next = applyGesture(running.base, now, read().width);
    if (!sameFit(next, running.cur)) {
      running.cur = next;
      onLive({ itemId: running.itemId, fit: next });
    }
  };

  const finish = (commit: boolean) => {
    const done = running;
    running = null;
    onLive(null);
    if (commit && done) read().onFitChange?.(done.itemId, done.cur);
  };

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: wants,
    onMoveShouldSetPanResponderCapture: wants,
    onPanResponderGrant: grant,
    onPanResponderMove: move,
    onPanResponderRelease: () => finish(true),
    onPanResponderTerminate: () => finish(false),
    onPanResponderTerminationRequest: () => false,
  });
  return {
    responder,
    update: (next) => {
      state = next;
    },
  };
}
