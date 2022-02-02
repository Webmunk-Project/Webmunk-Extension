/* global chrome, localStorage, browser */

function openWindow () {
  chrome.windows.create({
    height: 360,
    width: 480,
    type: 'panel',
    url: chrome.extension.getURL('index.html')
  })
}

browser.browserAction.onClicked.addListener(function (tab) {
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

let rules = null

const loadRules = function () {
  chrome.storage.local.get({ 'webmunk-config': null }, function (result) {
    const config = result['webmunk-config']

    if (config !== null && config !== undefined) {
      rules = config.rules

      browser.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        const css = rules['additional-css'].join(' ')

        const insertingCSS = browser.tabs.insertCSS({ code: css })

        function onExecutedCSS (result) {
          browser.tabs.executeScript({
            file: 'vendor/js/jquery.js'
          }).then(function (result) {
            // jQuery loaded

            browser.tabs.executeScript({
              file: 'js/app/content-script.js'
            }).then(function (result) {
              // Script loaded
            }, function (error) {
              console.log('Script error:')
              console.log(error)
            })
          }, function (error) {
            console.log('jQuery error:')
            console.log(error)
          })
        }

        function onErrorCSS (error) {
          console.log('CSS error:')
          console.log(error)
        }

        insertingCSS.then(onExecutedCSS, onErrorCSS)
      })
    } else {
      window.setTimeout(loadRules, 1000)
    }
  })
}

loadRules()

function handleMessage (request, sender, sendResponse) {
  if (request.content === 'fetch_configuration') {
    window.setTimeout(500, sendResponse(rules))
  }

  return true
}

browser.runtime.onMessage.addListener(handleMessage)

function onInstall () {
  if (localStorage.getItem('PDKExtensionInstallTime')) {
    return
  }

  const now = new Date().getTime()

  browser.storage.local.set({
    PDKExtensionInstallTime: now
  }, function (result) {
    openWindow()
  })
}

onInstall()
