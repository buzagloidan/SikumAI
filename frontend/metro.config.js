const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver for base64url
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    'base64url': path.resolve(__dirname, 'node_modules/base64url')
  },
  platforms: ['ios', 'android', 'web']
};

// Enable web support
config.transformer = {
  ...config.transformer,
  assetPlugins: ['expo-asset/tools/hashAssetFiles']
};

// Disable static rendering for web
config.web = {
  ...config.web,
  staticRenderingEnabled: false
};

module.exports = config;
