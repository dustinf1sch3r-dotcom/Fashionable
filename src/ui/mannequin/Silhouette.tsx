import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { BodyTemplate, Slot } from '@/core/model/types';
import { anchorFor } from '@/core/tryon/anchors';
import { BODY_A_PARTS, CANVAS, MIRROR_TRANSFORM } from './bodyA';
import { colors } from '@/ui/theme';

const SLOTS: readonly Slot[] = [
  'legs',
  'shoes',
  'bottom',
  'base',
  'onepiece',
  'belt',
  'mid',
  'outer',
  'neck',
  'jewelry',
  'wrist',
  'bag',
  'head',
  'eyes',
];

/** Landmark dots and one anchor box per slot, for tuning `src/core/tryon/anchors.ts`. */
function DebugShapes({ body, testID }: { body: BodyTemplate; testID?: string }) {
  const landmarks = Object.entries(body.landmarks);
  return (
    <G testID={testID}>
      {SLOTS.map((slot) => {
        const a = anchorFor(slot, body);
        const h = a.width * 0.5;
        return (
          <G key={slot}>
            <Rect
              x={a.centerX - a.width / 2}
              y={a.topY}
              width={a.width}
              height={h}
              fill="none"
              stroke={colors.accent}
              strokeWidth={2}
              strokeDasharray="10 8"
            />
            <SvgText
              x={a.centerX - a.width / 2 + 6}
              y={a.topY - 6}
              fontSize={22}
              fill={colors.accent}
              fontWeight="700"
            >
              {slot}
            </SvgText>
          </G>
        );
      })}
      {landmarks.map(([name, pt]) => (
        <Circle
          key={name}
          cx={pt.x}
          cy={pt.y}
          r={9}
          fill={colors.danger}
          testID={testID ? `${testID}-${name}` : undefined}
        />
      ))}
    </G>
  );
}

/** Stand-alone overlay (same size as the canvas) to draw above garments. */
export function DebugOverlay({ body, testID }: { body: BodyTemplate; testID?: string }) {
  return (
    <Svg
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      width="100%"
      height="100%"
      pointerEvents="none"
      testID={testID}
    >
      <DebugShapes body={body} />
    </Svg>
  );
}

interface SilhouetteProps {
  body: BodyTemplate;
  /** Overlay landmark dots and anchor boxes of every slot. */
  debug?: boolean;
  testID?: string;
}

/** The grey body figure on the 1000 × 2000 canvas; fills its (1:2) parent. */
export function Silhouette({ body, debug = false, testID }: SilhouetteProps) {
  // Only body-a is drawn so far; other templates fall back to it until their art exists.
  const parts = BODY_A_PARTS;
  return (
    <Svg
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      width="100%"
      height="100%"
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {parts.whole.map((d) => (
        <Path key={d} d={d} fill={colors.silhouette} />
      ))}
      <G>
        {parts.pairedLeft.map((d) => (
          <Path key={d} d={d} fill={colors.silhouette} />
        ))}
      </G>
      <G transform={MIRROR_TRANSFORM}>
        {parts.pairedLeft.map((d) => (
          <Path key={d} d={d} fill={colors.silhouette} />
        ))}
      </G>
      {debug ? <DebugShapes body={body} testID={testID ? `${testID}-debug` : undefined} /> : null}
    </Svg>
  );
}
