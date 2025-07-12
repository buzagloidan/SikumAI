const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver for base64url
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    'base64url': path.resolve(__dirname, 'node_modules/base64url')
  }
};

module.exports = config;
