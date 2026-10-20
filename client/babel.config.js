module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // zustand 5 ships ESM that uses import.meta; Hermes needs this polyfill.
          unstable_transformImportMeta: true,
        },
      ],
    ],
    // babel-preset-expo adds the Reanimated 4 (react-native-worklets) plugin itself.
  };
};
