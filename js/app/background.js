/* global chrome, fetch */

const PDK_IDENTIFIER = 'pdk-identifier'

function openWindow () {
  chrome.windows.create({
    height: 480,
    width: 640,
    type: 'panel',
    url: chrome.runtime.getURL('index.html')
  })
}

chrome.action.onClicked.addListener(function (tab) {
  const optionsUrl = chrome.runtime.getURL('index.html')

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

      chrome.scripting.insertCSS({
        target: {
          tabId: tabId,
          allFrames: true
        },
        css: css,
        origin: 'USER'
      }, function () {
        chrome.scripting.executeScript({
          target: {
            tabId: tabId,
            allFrames: true
          },
          files: ['/vendor/js/jquery.js', '/js/app/content-script.js']
        }, function (result) {
          // Script loaded
        })
      })
    } else {
      chrome.alarms.create('loadRules', {
        when: (Date.now() + 1000)
      })

      chrome.alarms.onAlarm.addListener(function (alarm) {
        if (alarm.name === 'loadRules') {
          loadRules(tabId)
        }
      })
    }
  })
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (tab.url.startsWith('https://') || tab.url.startsWith('http://')) {
    loadRules(tabId)
  }
})

function refreshConfiguration (sendResponse) {
  chrome.storage.local.get({ PDK_IDENTIFIER: '' }, function (result) {
    if (result[PDK_IDENTIFIER] !== '') {
      chrome.storage.local.get({ 'webmunk-config': null }, function (result) {
        config = result['webmunk-config']

        if (config['enroll-url'] === undefined) {
          config['enroll-url'] = 'https://enroll.webmunk.org/enroll/enroll.json'
        }

        const endpoint = config['enroll-url'] + '?identifier=' + result[PDK_IDENTIFIER]

        fetch(endpoint, {
          redirect: 'follow' // manual, *follow, error
        })
          .then(response => response.json())
          .then(function (data) {
            if (data.rules !== undefined) {
              chrome.storage.local.set({
                'webmunk-config': data.rules
              }, function (result) {
                if (data.rules.tasks !== undefined && data.rules.tasks.length > 0) {
                  chrome.action.setBadgeBackgroundColor(
                    { color: '#008000' }, // Green
                    function () {
                      chrome.action.setBadgeText(
                        {
                          text: '' + data.rules.tasks.length
                        }, // Green
                        function () { /* ... */

                        })
                    })
                } else {
                  chrome.action.setBadgeBackgroundColor(
                    { color: [0, 0, 0, 255] }, // Green
                    function () {
                      chrome.action.setBadgeText(
                        {
                          text: ''
                        }, // Green
                        function () { /* ... */

                        })
                    })
                }

                sendResponse(data.rules)
              })
            } else {
              sendResponse(null)
            }
          })
          .catch((error) => {
            console.error('Error:', error)
          })
      })
    } else {
      sendResponse(null)
    }
  })
}

function handleMessage (request, sender, sendResponse) {
  if (request.content === 'fetch_configuration') {
    chrome.alarms.create('fetch-configuration', { when: (Date.now() + 500) })

    chrome.alarms.onAlarm.addListener(function (alarm) {
      chrome.storage.local.get({ 'webmunk-config': null }, function (result) {
        config = result['webmunk-config']

        sendResponse(config)

        chrome.alarms.clear('fetch-configuration', function () {

        })
      })
    })
  } else if (request.content === 'record_data_point') {
    request.payload['tab-id'] = sender.tab.id

    window.PDK.enqueueDataPoint(request.generator, request.payload, function () {
      sendResponse({
        message: 'Data point enqueued successfully.',
        success: true
      })
    })
  } else if (request.content === 'open_css_help') {
    chrome.windows.create({
      url: 'https://api.jquery.com/category/selectors/'
    })
  } else if (request.content === 'refresh_configuration') {
    refreshConfiguration(sendResponse)
  }

  return true
}

chrome.runtime.onMessage.addListener(handleMessage)

chrome.storage.local.get(['PDKExtensionInstallTime'], function (result) {
  if (result.PDKExtensionInstallTime === undefined) {
    const now = new Date().getTime()

    chrome.storage.local.set({
      PDKExtensionInstallTime: now
    }, function (result) {

    })
  }
})

chrome.alarms.create('pdk-upload', { periodInMinutes: 5 })

chrome.alarms.onAlarm.addListener(function (alarm) {
  chrome.storage.local.get({ 'webmunk-config': null }, function (result) {
    config = result['webmunk-config']

    window.PDK.uploadQueuedDataPoints(config['upload-url'], config.key, function () {
      chrome.storage.local.set({
        'pdk-last-upload': (new Date().getTime())
      }, function (result) {

      })
    })
  })

  refreshConfiguration(function (response) {
    console.log('BG REFRESH COMPLETE')
  })
})
