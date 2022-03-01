/* global chrome, localStorage, chrome */

function openWindow () {
  chrome.windows.create({
    height: 480,
    width: 640,
    type: 'panel',
    url: chrome.extension.getURL('index.html')
  })
}

chrome.browserAction.onClicked.addListener(function (tab) {
  const optionsUrl = chrome.extension.getURL('index.html')

  chrome.tabs.query({}, function (extensionTabs) {
    let found = false

    for (let i = 0; i < extensionTabs.length; i++) {
      if (optionsUrl === extensionTabs[i].url) {
        found = true
      }
    }

    if (found === false) {
      openWindow()
    }
  })
})

let config = null

const loadRules = function (tabId) {
  chrome.storage.local.get({ 'webmunk-config': null }, function (result) {
    config = result['webmunk-config']

    if (config !== null && config !== undefined) {
      const css = config['additional-css'].join(' ')

      chrome.tabs.insertCSS(tabId, {
        code: css,
        allFrames: true,
        cssOrigin: 'user'
      }, function () {
        chrome.tabs.executeScript(tabId, {
          file: 'vendor/js/jquery.js'
        }, function (result) {
          chrome.tabs.executeScript(tabId, {
            file: 'js/app/content-script.js'
          }, function (result) {
          // Script loaded
          })
        })
      })
    } else {
      window.setTimeout(function () {
        loadRules(tabId)
      }, 1000)
    }
  })
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  loadRules(tabId)
})

function handleMessage (request, sender, sendResponse) {
  if (request.content === 'fetch_configuration') {
    window.setTimeout(sendResponse(config), 500)
  } else if (request.content === 'record_data_point') {
    window.PDK.enqueueDataPoint(request.generator, request.payload)

    sendResponse({
      message: 'Data point enqueued successfully.',
      success: true
    })
  } else if (request.content === 'open_css_help') {
    chrome.windows.create({
      url: 'https://api.jquery.com/category/selectors/'
    })
  }

  return true
}

chrome.runtime.onMessage.addListener(handleMessage)

function onInstall () {
  if (localStorage.getItem('PDKExtensionInstallTime')) {
    return
  }

  const now = new Date().getTime()

  chrome.storage.local.set({
    PDKExtensionInstallTime: now
  }, function (result) {

  })
}

onInstall()

chrome.alarms.create('pdk-upload', { periodInMinutes: 1 })

chrome.alarms.onAlarm.addListener(function (alarm) {
  window.PDK.uploadUrl = 'https://webmunk.audacious-software.com/data/add-bundle.json'

  window.PDK.uploadQueuedDataPoints(window.PDK.uploadUrl, function () {
  })
})
