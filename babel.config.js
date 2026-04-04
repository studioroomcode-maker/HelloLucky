function hasModule(moduleName) {
  try {
    require.resolve(moduleName);
    return true;
  } catch {
    return false;
  }
}

module.exports = function (api) {
  api.cache(true);

  const plugins = [];

  // Auto-enable the worklets-core Babel plugin once the native realtime stack is installed.
  if (hasModule('react-native-worklets-core')) {
    plugins.push('react-native-worklets-core/plugin');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
