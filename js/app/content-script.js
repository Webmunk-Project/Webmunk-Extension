/* global MutationObserver, chrome */

window.webmunkLoading = false

function updateWebmunkClasses () {
  if (window.webmunkLoading) {
    return
  }

  if (window.webmunkRules === null) {
    window.setTimeout(updateWebmunkClasses, 1000)

    return
  }

  window.webmunkLoading = true

  let hostMatch = false

  window.webmunkRules.filters.forEach(function (filter) {
    let filterMatch = true

    for (const [operation, pattern] of Object.entries(filter)) {
      if (operation === 'hostSuffix') {
        if (window.location.hostname.endsWith(pattern) === false) {
          filterMatch = false
        }
      } else {
        console.log('[Webmunk] Unsupported filter: ' + operation + ' : ' + pattern)
      }
    }

    if (filterMatch) {
      hostMatch = true
    }
  })

  if (hostMatch) {
    window.webmunkRules.rules.forEach(function (rule) {
      if (rule.match !== undefined) {
        const matches = $(document).find(rule.match)

        console.log('[Webmunk] matches[' + rule.match + ']: ' + matches.length)

        if (matches.length > 0) {
          chrome.runtime.sendMessage({
            content: 'record_data_point',
            generator: 'webmunk-extension-matched-rule',
            payload: {
              rule: rule.match,
              count: matches.length,
              'url*': window.location.href,
              'page-title*': document.title
            }
          }, function (message) {

          })

          matches.each(function (index, element) {
            if (rule['add-class'] !== undefined) {
              $(this).addClass(rule['add-class'])
            }

            if (rule['remove-class'] !== undefined) {
              $(this).removeClass(rule['remove-class'])
            }
          })
        }
      }
    })
  } else {
    console.log('[Webmunk] Disconnecting - no filters matched.')

    window.webmunkObserver.disconnect()
  }

  window.setTimeout(function () {
    window.webmunkLoading = false
  }, 1000)
}

if (window.webmunkObserver === undefined) {
  window.webmunkListener = function (mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        updateWebmunkClasses()
      } else if (mutation.type === 'attributes') {
        updateWebmunkClasses()
      }
    };
  }

  const config = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true
  }

  window.webmunkObserver = new MutationObserver(window.webmunkListener)

  window.webmunkObserver.observe(document, config)
}

chrome.runtime.sendMessage({ content: 'fetch_configuration' }, function (message) {
  window.webmunkRules = message

  updateWebmunkClasses()
})
