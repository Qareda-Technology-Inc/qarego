import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";

/**
 * Avoid noisy dev warnings when animated values update after a view unmounts
 * (common with bottom sheets + layout animations). Strict mode is off in dev only.
 */
if (__DEV__) {
  configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
  });
}
