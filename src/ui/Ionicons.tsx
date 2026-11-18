import { Ionicons as VectorIonicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useIsClient } from './useIsClient';

type Props = ComponentProps<typeof VectorIonicons>;

/**
 * Drop-in `Ionicons` that is safe in the static web export. The icon font is only loaded in the
 * browser, so the library renders an empty element at build time but, when the font is already
 * cached, a glyph on the first client render: React then rejects the prerendered HTML (error
 * #418, race-dependent). Until the page has hydrated this draws an empty box of the same size.
 */
export function Ionicons(props: Props) {
  const client = useIsClient();
  if (!client) {
    const size = props.size ?? 12;
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: size, height: size }}
      />
    );
  }
  return <VectorIonicons {...props} />;
}
