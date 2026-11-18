import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { brushRadius, type BrushMode, type BrushSize } from '@/core/image';
import { getServices, type TouchupSession } from '@/services';
import { Button } from '@/ui/Button';
import { Checkerboard } from '@/ui/Checkerboard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { colors, radius, spacing, typography } from '@/ui/theme';
import type { CutoutEditorProps } from './types';

const MODES = [
  { value: 'erase', label: 'Erase' },
  { value: 'restore', label: 'Restore' },
] as const satisfies readonly { value: BrushMode; label: string }[];

const SIZES = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'Medium' },
  { value: 'l', label: 'Large' },
] as const satisfies readonly { value: BrushSize; label: string }[];

const LOAD_ERROR = "We couldn't open this picture for touch-up.";
const EMPTY_ERROR = 'Nothing is left to keep. Restore part of the garment, or cancel.';
const SAVE_ERROR = "We couldn't finish the touch-up. Please try again.";

interface Size {
  width: number;
  height: number;
}

/** Web editor: the cutout on a checkerboard that you erase from and restore into with a brush. */
export function CutoutEditor({ originalUri, cutoutUri, onCancel, onDone }: CutoutEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<TouchupSession | null>(null);
  const pointerRef = useRef<number | null>(null);
  const [session, setSession] = useState<TouchupSession | null>(null);
  const [stage, setStage] = useState<Size | null>(null);
  const [mode, setMode] = useState<BrushMode>('erase');
  const [size, setSize] = useState<BrushSize>('m');
  const [undoCount, setUndoCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    getServices()
      .touchup.open({ originalUri, cutoutUri, canvas })
      .then((opened) => {
        if (cancelled) {
          opened.dispose();
          return;
        }
        sessionRef.current = opened;
        setSession(opened);
      })
      .catch(() => {
        if (!cancelled) setError(LOAD_ERROR);
      });
    return () => {
      cancelled = true;
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, [originalUri, cutoutUri]);

  useEffect(() => {
    session?.setGhost(mode === 'restore');
  }, [session, mode]);

  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage({ width, height });
  }, []);

  // The picture, fitted into the stage with a little air around it.
  let frame: Size = { width: 0, height: 0 };
  if (session && stage) {
    const room = { width: stage.width - spacing.md * 2, height: stage.height - spacing.md * 2 };
    const fit = Math.max(0, Math.min(room.width / session.width, room.height / session.height));
    frame = { width: Math.floor(session.width * fit), height: Math.floor(session.height * fit) };
  }

  const toPhoto = (e: PointerEvent<HTMLCanvasElement>): { x: number; y: number } | undefined => {
    const live = sessionRef.current;
    if (!live) return undefined;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;
    return {
      x: ((e.clientX - rect.left) * live.width) / rect.width,
      y: ((e.clientY - rect.top) * live.height) / rect.height,
    };
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const live = sessionRef.current;
    const at = toPhoto(e);
    // One finger or the mouse; a second finger is ignored rather than drawn.
    if (!live || !at || pointerRef.current !== null || busy) return;
    pointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    live.beginStroke(mode);
    live.strokeTo(at.x, at.y, brushRadius(size, live.width, live.height));
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const live = sessionRef.current;
    if (!live || pointerRef.current !== e.pointerId) return;
    // Coalesced events keep fast strokes smooth on touch screens.
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = brushRadius(size, live.width, live.height);
    const points = samples.length > 0 ? samples : [e.nativeEvent];
    for (const p of points) {
      live.strokeTo(
        ((p.clientX - rect.left) * live.width) / rect.width,
        ((p.clientY - rect.top) * live.height) / rect.height,
        radius,
      );
    }
  };

  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    const live = sessionRef.current;
    if (!live || pointerRef.current !== e.pointerId) return;
    pointerRef.current = null;
    setUndoCount(live.endStroke());
  };

  const done = async () => {
    if (!session || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await session.finish();
      if (!result) {
        setError(EMPTY_ERROR);
        setBusy(false);
        return;
      }
      onDone(result);
    } catch {
      setError(SAVE_ERROR);
      setBusy(false);
    }
  };

  const loading = !session && !error;
  const canRestore = session?.canRestore ?? true;

  return (
    <View style={styles.root} testID="touchup-editor">
      <View style={styles.header}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} testID="touchup-cancel" />
        <Text accessibilityRole="header" style={styles.title}>
          Touch up
        </Text>
        <Button
          label="Done"
          onPress={() => void done()}
          disabled={!session}
          loading={busy}
          testID="touchup-done"
        />
      </View>

      <View style={styles.stage} onLayout={onStageLayout}>
        <View style={[styles.frame, frame]} testID="touchup-frame">
          <Checkerboard />
          <canvas
            ref={canvasRef}
            aria-label="The garment. Draw on it to erase or restore."
            data-testid="touchup-canvas"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={canvasStyle}
          />
        </View>
        {loading ? (
          <View style={styles.status} testID="touchup-loading">
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.muted}>Opening…</Text>
          </View>
        ) : null}
        {error && !session ? (
          <View style={styles.status}>
            <Text accessibilityRole="alert" style={styles.error} testID="touchup-error">
              {'⚠ '}
              {error}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tools}>
        {error && session ? (
          <Text accessibilityRole="alert" style={styles.error} testID="touchup-error">
            {'⚠ '}
            {error}
          </Text>
        ) : (
          <Text style={styles.hint} testID="touchup-hint">
            {mode === 'erase'
              ? 'Draw over anything that should not be there.'
              : canRestore
                ? 'Draw over what was cut off by mistake. The photo shows faintly.'
                : 'Restore is not available for this one. You can still erase.'}
          </Text>
        )}
        <View style={styles.row}>
          <View style={styles.grow}>
            <SegmentedControl
              options={MODES}
              value={mode}
              onChange={(next) => setMode(next === 'restore' && !canRestore ? 'erase' : next)}
              accessibilityLabel="Brush mode"
              testID="touchup"
            />
          </View>
          <Button
            label="Undo"
            icon="arrow-undo-outline"
            variant="secondary"
            disabled={undoCount === 0}
            onPress={() => setUndoCount(sessionRef.current?.undo() ?? 0)}
            testID="touchup-undo"
          />
        </View>
        <SegmentedControl
          options={SIZES}
          value={size}
          onChange={setSize}
          accessibilityLabel="Brush size"
          testID="touchup-size"
        />
      </View>
    </View>
  );
}

// Plain DOM style: the canvas is a DOM element, not a React Native view. `touchAction: none`
// stops the page scrolling while a finger draws.
const canvasStyle = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  touchAction: 'none',
  cursor: 'crosshair',
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  title: { ...typography.heading, color: colors.text },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  status: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  tools: { padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  muted: { ...typography.body, color: colors.textMuted },
  error: { ...typography.label, color: colors.danger, textAlign: 'center' },
});
