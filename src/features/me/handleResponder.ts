import { PanResponder, type PanResponderInstance } from 'react-native';
import type { Point } from '@/core/model/types';
import { dragPoint, type HandleKey } from './landmarkDrag';

/** What the responder needs to know at the moment a drag starts or moves. */
export interface HandleState {
  point: Point;
  /** Canvas width in px (converts pointer travel to mannequin units). */
  canvasWidth: number;
  onStart: (key: HandleKey) => void;
  onMove: (key: HandleKey, to: Point) => void;
  onEnd: (key: HandleKey) => void;
}

export interface HandleResponder {
  responder: PanResponderInstance;
  /** Tell the responder the latest props (call after every commit). */
  update: (state: HandleState) => void;
}

/**
 * Drag for one landmark handle, on React Native's PanResponder so it works with a mouse on web and
 * with fingers on a phone. The handle moves by the pointer's travel from where it started.
 */
export function createHandleResponder(key: HandleKey, initial: HandleState): HandleResponder {
  let state = initial;
  let start: Point = initial.point;
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start = state.point;
      state.onStart(key);
    },
    onPanResponderMove: (_e, g) =>
      state.onMove(key, dragPoint(start, g.dx, g.dy, state.canvasWidth)),
    onPanResponderRelease: () => state.onEnd(key),
    onPanResponderTerminate: () => state.onEnd(key),
  });
  return {
    responder,
    update(next) {
      state = next;
    },
  };
}
