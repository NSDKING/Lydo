/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#b5f23d';
const tintColorDark = '#b5f23d';

export const Colors = {
  light: {
    text: '#f0f0ee',
    background: '#080808',
    surface: '#181818',
    surface2: '#222222',
    surface3: '#2a2a2a',
    border: '#2e2e2e',
    border2: '#3a3a3a',
    lime: '#b5f23d',
    limeDim: 'rgba(181,242,61,0.12)',
    limeDim2: 'rgba(181,242,61,0.06)',
    orange: '#ff6b35',
    orangeDim: 'rgba(255,107,53,0.12)',
    blue: '#4d9fff',
    blueDim: 'rgba(77,159,255,0.10)',
    red: '#ff4757',
    redDim: 'rgba(255,71,87,0.12)',
    text2: '#a0a09e',
    text3: '#5a5a58',
    white: '#ffffff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f0f0ee',
    background: '#080808',
    surface: '#181818',
    surface2: '#222222',
    surface3: '#2a2a2a',
    border: '#2e2e2e',
    border2: '#3a3a3a',
    lime: '#b5f23d',
    limeDim: 'rgba(181,242,61,0.12)',
    limeDim2: 'rgba(181,242,61,0.06)',
    orange: '#ff6b35',
    orangeDim: 'rgba(255,107,53,0.12)',
    blue: '#4d9fff',
    blueDim: 'rgba(77,159,255,0.10)',
    red: '#ff4757',
    redDim: 'rgba(255,71,87,0.12)',
    text2: '#a0a09e',
    text3: '#5a5a58',
    white: '#ffffff',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
