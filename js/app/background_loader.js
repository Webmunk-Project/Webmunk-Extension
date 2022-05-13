/* global window, importScripts */

if (typeof window === 'undefined') {
  window = {} // eslint-disable-line no-global-assign
}

importScripts('config.js', '../../vendor/js/nacl.js', '../../vendor/js/nacl-util.js', '../lib/passive-data-kit.js', 'background.js')
