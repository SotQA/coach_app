const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-svg declares "react-native": "src/index.ts", which makes Metro bundle
// from source and fail to resolve fabric native component paths on some setups.
// Force the prebuilt CommonJS entry instead.
const rnsvgMain = path.resolve(__dirname, "node_modules/react-native-svg/lib/commonjs/index.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native-svg") {
    return { filePath: rnsvgMain, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
