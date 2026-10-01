/**
 * Minimal CJS shim for expo-router, which still `require("query-string")`
 * even though Expo Router 5 no longer declares that dependency.
 */
function stringify(object, options) {
  if (!object || typeof object !== "object") return "";
  const keys = Object.keys(object).filter((key) => {
    const value = object[key];
    return value !== undefined && value !== null;
  });
  if (options?.sort === true) keys.sort();
  return keys
    .map((key) => {
      const value = object[key];
      if (Array.isArray(value)) {
        return value
          .map((item) => `${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
          .join("&");
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join("&");
}

module.exports = { stringify };
module.exports.stringify = stringify;
