// This is the top-level babel config
module.exports = function(api) {
  // This caches the Babel config
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo']
  };
}; 