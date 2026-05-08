/**
 * Minimal dev-only logger. Use everywhere instead of console.log.
 * - log/debug/info: stripped in production builds.
 * - warn/error: kept in production (they should be wired into Sentry later).
 */
export const logger = {
  log: __DEV__ ? console.log.bind(console) : () => {},
  debug: __DEV__ ? console.debug.bind(console) : () => {},
  info: __DEV__ ? console.info.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
