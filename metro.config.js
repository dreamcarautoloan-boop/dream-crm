const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules.
  // This fixes iOS styling issues in local development, BUT on a completely
  // fresh install (every Render/CI build container) it makes
  // react-native-css-interop write its .cache dir mid-bundle, which races
  // Metro's own file watcher and reliably fails the very first build with
  // "Failed to get the SHA-1 for .../.cache/web.css". Only enable it outside
  // production builds, where node_modules is never brand new in this way.
  forceWriteFileSystem: process.env.NODE_ENV !== "production",
});
