const configFunction = function () {
  return {
    primaryColor: '#A51C30',
    accentColor: '#A51C30',
    extensionName: 'Study Browser Extension',
    enrollUrl: 'https://enroll.webmunk.org/enroll/enroll.json',
    amazonDataFetchedUrl: 'https://enroll.webmunk.org/enroll/amazon-fetched.json',
    generator: 'webmunk',
    aboutExtension: 'Study Browser Extension is a browser extension for web-based studies. For more information, contact <a href="mailto:webmunk.team@gmail.com">webmunk.team@gmail.com</a>.'
  }
}

if (typeof define === 'undefined') {
  config = configFunction() // eslint-disable-line no-global-assign, no-undef
} else {
  define([], configFunction)
}
