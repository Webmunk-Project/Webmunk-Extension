#!/bin/bash


zip -r -FS webmunk-chrome.zip * --exclude '*.git*' --exclude '*.md' --exclude 'assets*' --exclude 'node_modules*' --exclude 'package*.json' --exclude '*.sh' --exclude '*.xpi' --exclude '*.zip' --exclude '*.DS_Store' .


