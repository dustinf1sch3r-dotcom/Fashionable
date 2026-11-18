import { PanResponder, type PanResponderInstance } from 'react-native';

export interface PointState {
  /** Where the dot is, in px inside its parent. */
  x: number;
  y: number;
  onStart: (name: string) => void;
  /** The dot's new position in px: where it started plus the pointer's travel. */
  onMove: (name: string, to: { x: number; y: number }) => void;
  onEnd: (name: string) => void;
}

export interface PointResponder {
  responder: PanResponderInstance;
  /** Tell the responder the latest props (call after every commit). */
  update: (state: PointState) => void;
}

/**
 * Drag for one point handle on React Native's PanResponder (mouse on web, fingers on a phone).
 * The point moves by the pointer's travel from where it started.
 */
export function createPointResponder(name: string, initial: PointState): PointResponder {
  let state = initial;
  let start = { x: initial.x, y: initial.y };
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      start = { x: state.x, y: state.y };
      state.onStart(name);
    },
    onPanResponderMove: (_e, g) => state.onMove(name, { x: start.x + g.dx, y: start.y + g.dy }),
    onPanResponderRelease: () => state.onEnd(name),
    onPanResponderTerminate: () => state.onEnd(name),
  });
  return {
    responder,
    update(next) {
      state = next;
    },
  };
}
