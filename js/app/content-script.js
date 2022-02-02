/* global MutationObserver, browser */

if (window.webmunkListener === undefined) {
  $.noConflict()

  let webMunkRules = null

  let loading = false
  let observer = null

  const updateWebmunkClasses = function () {
    if (loading) {
      return
    }

    if (webMunkRules === null) {
      window.setTimeout(updateWebmunkClasses, 1000)

      return
    }

    loading = true

    let hostMatch = false

    webMunkRules.filters.forEach(function (filter) {
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
      webMunkRules.rules.forEach(function (rule) {
        if (rule.match !== undefined) {
          const matches = $(document).find(rule.match)

          console.log('[Webmunk] matches[' + rule.match + ']: ' + matches.length)

          matches.each(function (index, element) {
            if (rule['add-class'] !== undefined) {
              $(this).addClass(rule['add-class'])
            }
          })
        }
      })
    } else {
      console.log('[Webmunk] Disconnecting - no filters matched.')

      observer.disconnect()
    }

    window.setTimeout(function () {
      loading = false
    }, 1000)
  }

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

  observer = new MutationObserver(window.webmunkListener)

  observer.observe(document, config)

  function handleResponse (message) {
    webMunkRules = message
  }

  function handleError (error) {
    console.log(`[Webmunk] Error fetching configuration: ${error}`)
  }

  const sending = browser.runtime.sendMessage({ content: 'fetch_configuration' })

  sending.then(handleResponse, handleError)
}
