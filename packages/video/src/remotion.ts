// Remotion/React exports. Importing this loads Google Fonts, so consume it only
// from browser/Remotion contexts (the dashboard player, the render bundle).
export { WordVideo } from "./compositions/WordVideo";
export { calcWordVideoMetadata } from "./compositions/metadata";
export { RemotionRoot } from "./Root";
export { DEFAULT_THEME, getTheme, THEMES, type Theme } from "./themes/themes";
