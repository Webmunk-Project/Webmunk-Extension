# Webmunk Amazon Study Extension

This repository contains the source code and libaries used to build the extension for the Webmunk Amazon study (2022-2024). Study participants install this extension to both upload their Amazon order histories (from 2022 and 2023) to the study server, but also to enable passive data acquisition of content observed while browsing Amazon sites, as well as implement an experimental intervention that selectively hides items on Amazon's sites to understand the role of Amazon brands on consumer behavior.

This extension assumes that [a Webmunk enrollment server](https://github.com/Webmunk-Project/Webmunk-Enrollment-App) and [a Webmunk data collection server](https://github.com/Webmunk-Project/Webmunk-Django) has already been setup and is operational. The extension relies on the enrollment server for its configuration (where to send data, whether experimental conditions are enabled, etc.) and it depends on the data collection server to act as a location where it can transmit the data it gathers.

## Building the Amazon Study Extension

### Prerequisites

Before attempting to build this extension, verify that a version of Python 3 (3.6 or higher) is present on your system as the current build system uses that to build and package the extension.

### Installation Instructions

First, begin by cloning this repository to a location on your local device:

```
$ git clone https://github.com/Webmunk-Project/Webmunk-Extension.git amazon_extension
$ cd amazon_extension
```

Initialize the Git submodules this extension depends upon:

```
$ git submodule init
$ git submodule update
```

Open the [js/app/config.js](`js/app/config.js`) file and update the embedded configuration function:

```js
const configFunction = function () {
  return {
    primaryColor: '#A51C30',
    accentColor: '#A51C30',
    extensionName: 'Study Browser Extension',
    enrollUrl: 'https://enroll.example.com/enroll/enroll.json',
    amazonDataFetchedUrl: 'https://enroll.example.com/enroll/amazon-fetched.json',
    generator: 'webmunk',
    aboutExtension: 'Study Browser Extension is a browser extension for web-based studies. For more information, contact <a href="mailto:webmunk.team@gmail.com">webmunk.team@gmail.com</a>.'
  }
}

if (typeof define === 'undefined') {
  config = configFunction() // eslint-disable-line no-global-assign, no-undef
} else {
  define([], configFunction)
}
```

Replace mentions of `enroll.example.com` with the hostname of your own enrollment server. The `enrollUrl` parameter points to the enrollment endpoint that assigns an anonymized study identifier and provides the configuration to the extension throughout the study. The `amazonDataFetchedUrl` parameter specifies utility endpoint that the extension will call upon successful completion of a full Amazon order history retrieval.

Once the configuration has been updated, build the extension by calling the `package_chrome.py` script:

```
$ python package_chrome.py  --dir
Bundling Webmunk Amazon Tools...
Bundling Amazon Fetch...
$
```

This build script will generate a `chrome-extension.zip` file, which is suitable for uploading to the Chrome Web Store for public distribution. When the `--dir` option is included in the command, the build script will also generate a `chrome-extension` folder, which is suitable for use in local testing. Simply point the "Load unpacked" extension functionality to the `chrome-extension` folder to load and use the extension locally.

## Extension Implementation

The extension is implemented using Chrome's Manifest V3 APIs and consists of three main components:

* A user interface provided by the `main.js`, `home.js`, and `index.html` files that provides the enrollment interface and a task list (when enabled) that serves as participant's primary contact point with the study. This interface is built using Google's [Material Components for the web](https://github.com/material-components/material-components-web).

* A background script (`background.js`) that is responsible for coordinating data collection among the Webmunk modules and managing the data upload process.

* A content script (`content-script.js`) that is loaded into Amazon pages and is primarily responsible for enacting the experimental intervention and data collection within the local page context.

In addition to these files, the extension also includes two Webmunk extensions:

* `amazon`: Provides some utility functions that help the main extension identify Amazon product items by adding Amazon-specific jQuery selectors (`:isAmazonProductItem` and `:isAmazonProductGroup`).

* `amazon-fetch`: Implements the functionality that allows the extension to retrieve Amazon order history by creatively using iFrames and local page spidering across participants' order histories to retrieve details relevant to the research study.

## License

Copyright 2022-2024 The Fradkin Foundation and the President & Fellows of Harvard College

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.