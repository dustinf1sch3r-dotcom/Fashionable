import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML of the static web export (runs at build time only, in Node). It makes "Add to Home
 * Screen" open the app full-screen with our name and icon. The manifest uses relative URLs, so
 * only the links here need the base path (EXPO_BASE_URL, e.g. "/Fashionable" on GitHub Pages).
 * Colours repeat src/ui/theme.ts (`bg`); this file cannot import app code that touches react-native.
 */
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
const BG = '#FAF8F5';

export default function Root({ children }: PropsWithChildren) {
  // Expo hands the page's scripts, styles and attributes in through this context; a custom root
  // must render them (the default root does) or the static page ships without its JavaScript.
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={BG} />
        <meta name="application-name" content="Fashionable" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fashionable" />
        <link rel="icon" type="image/png" sizes="48x48" href={`${BASE}/icons/favicon-48.png`} />
        <link rel="manifest" href={`${BASE}/manifest.webmanifest`} />
        <link rel="apple-touch-icon" sizes="180x180" href={`${BASE}/icons/apple-touch-icon.png`} />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
