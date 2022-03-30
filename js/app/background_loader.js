/* global window, importScripts */

try {
  if (typeof window === 'undefined') {
    window = {} // eslint-disable-line no-global-assign
  }

  importScripts('config.js', '../lib/passive-data-kit.js', 'background.js')
} catch (e) {
  console.error(e)
}
