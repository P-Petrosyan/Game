const { createRunOncePlugin, withPodfile } = require('@expo/config-plugins');

const pkg = require('react-native-v8/package.json');

function ensureUseReactNativeOptions(contents) {
  const match = contents.match(/use_react_native!\(([^)]*)\)/m);
  if (!match) {
    return contents;
  }

  let options = match[1];

  const ensureKey = (key, value) => {
    const symbolPattern = new RegExp(`${key}:\\s*[^,\n]+`);
    const hashRocketPattern = new RegExp(`:${key}\\s*=>\\s*[^,\n]+`);
    if (symbolPattern.test(options)) {
      options = options.replace(symbolPattern, `${key}: ${value}`);
      return;
    }
    if (hashRocketPattern.test(options)) {
      options = options.replace(hashRocketPattern, `:${key} => ${value}`);
      return;
    }
    const insertion = `\n    ${key}: ${value}`;
    options = options.replace(/\n\s*\)\s*$/, `${insertion}\n  )`);
  };

  ensureKey('hermes_enabled', 'false');
  ensureKey('js_engine', ':v8');

  return contents.replace(match[0], `use_react_native!(${options})`);
}

function ensureV8Pod(contents) {
  if (contents.includes("pod 'RNV8'")) {
    return contents;
  }

  const useReactNativeCall = contents.match(/use_react_native![^\n]*\n((?:\s+.+\n)*)/m);
  if (!useReactNativeCall) {
    return contents;
  }

  const insertion = "  pod 'RNV8', :path => '../node_modules/react-native-v8'\n";
  const anchor = useReactNativeCall[0];
  return contents.replace(anchor, `${anchor}${insertion}`);
}

function applyPodfile(contents) {
  let updated = contents;
  updated = ensureUseReactNativeOptions(updated);
  updated = ensureV8Pod(updated);
  return updated;
}

const withReactNativeV8Native = config => {
  return withPodfile(config, config => {
    if (config.modResults?.contents) {
      config.modResults.contents = applyPodfile(config.modResults.contents);
    }
    return config;
  });
};

module.exports = createRunOncePlugin(withReactNativeV8Native, 'with-react-native-v8-native', pkg.version);
