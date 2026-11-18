import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { colors, minTouch, radius, spacing, typography } from '@/ui/theme';

const DOT = 8;

interface CarouselProps {
  /** One element per page. */
  pages: readonly ReactNode[];
  testID: string;
}

/** Swipeable pages with tappable dots and a "n of m" counter (no colour-only signals). */
export function Carousel({ pages, testID }: CarouselProps) {
  const scroller = useRef<ScrollViewInstance>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(Math.max(0, Math.min(pages.length - 1, next)));
  };
  const goTo = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  return (
    <View testID={testID}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID={`${testID}-scroll`}
      >
        {pages.map((p, i) => (
          // Pages never reorder within one carousel, so the index is a stable key.
          <View key={i} style={{ width: width || '100%' }}>
            {p}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 ? (
        <View style={styles.footer}>
          <View style={styles.dots}>
            {pages.map((_, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Show idea ${i + 1}`}
                accessibilityState={{ selected: i === page }}
                onPress={() => goTo(i)}
                style={styles.dotHit}
                testID={`${testID}-dot-${i}`}
              >
                <View style={[styles.dot, i === page && styles.dotOn]} />
              </Pressable>
            ))}
          </View>
          <Text style={styles.count} testID={`${testID}-count`}>
            {`Idea ${page + 1} of ${pages.length} · swipe for more`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center' },
  dotHit: { width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, backgroundColor: colors.border },
  dotOn: { width: DOT * 2.5, backgroundColor: colors.accent },
  count: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.xs },
});
