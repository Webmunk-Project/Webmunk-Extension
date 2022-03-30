const configFunction = function () {
  return {
    primaryColor: '#A51C30',
    accentColor: '#A51C30',
    extensionName: 'Webmunk',
    enrollUrl: 'https://enroll.webmunk.org/enroll/enroll.json',
    generator: 'webmunk',
    aboutExtension: 'Webmunk is a browser extension for web-based studies. For more information, contact <a href="mailto:webmunk.team@gmail.com">webmunk.team@gmail.com</a>.'
  }
}

if (typeof define === 'undefined') {
  config = configFunction() // eslint-disable-line no-global-assign, no-undef
} else {
  define([], configFunction)
}
