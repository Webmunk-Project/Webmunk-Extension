/* global MutationObserver, chrome, crypto */

window.webmunkLoading = false
window.webmunkListenersLoaded = false

function uuidv4 () {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

window.webmunkPageId = uuidv4()

function updateWebmunkClasses () {
  if (window.webmunkLoading || window.webmunkRules === undefined) {
    return
  }

  window.webmunkLoading = true

  let hostMatch = false
  let pathMatch = true

  if (window.webmunkRules !== undefined) {
    // Evaluate sites to include.

    window.webmunkRules.filters.forEach(function (filter) {
      for (const [operation, pattern] of Object.entries(filter)) {
        if (operation === 'hostSuffix') {
          if (window.location.hostname.endsWith(pattern)) {
            hostMatch = true
          }
        } else if (operation === 'hostEquals') {
          if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
            hostMatch = true
          }
        }
      }
    })

    // Evaluate sites to exclude.

    window.webmunkRules.filters.forEach(function (filter) {
      for (const [operation, pattern] of Object.entries(filter)) {
        if (operation === 'excludeHostSuffix') {
          if (window.location.hostname.endsWith(pattern)) {
            hostMatch = false
          }
        } else if (operation === 'excludeHostEquals') {
          if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
            hostMatch = false
          }
        } else if (operation === 'excludePaths') {
          pattern.forEach(function (excludePath) {
            const pathRegEx = new RegExp(excludePath)

            if (pathRegEx.test(window.location.pathname)) {
              pathMatch = false
            }
          })
        }
      }
    })

    // console.log('[Webmunk] ' + window.location.href + ': hostMatch: ' + hostMatch + ' -- pathMatch: ' + pathMatch)

    if (hostMatch && pathMatch) {
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

                if ($(this).attr('class').includes('webmunk_id_') === false) {
                  $(this).addClass('webmunk_id_' + uuidv4())
                }
              }

              if (rule['remove-class'] !== undefined) {
                $(this).removeClass(rule['remove-class'])
              }
            })
          }
        }
      })

      if (window.webmunkListenersLoaded === false) {
        const visibleMapping = {}

        const stoppedScrolling = function () {
          for (const [cssClass, listener] of Object.entries(window.webmunkRules.actions)) {
            $('.' + cssClass).each(function (index, element) {
              const domRect = element.getBoundingClientRect()

              const isVisible = domRect.top >= 0 &&
                        domRect.left >= 0 &&
                        domRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
                        domRect.right <= (window.innerWidth || document.documentElement.clientWidth)

              const elementClasses = $(element).attr('class').split(' ')

              let webmunkId = null

              elementClasses.forEach(function (className) {
                if (className.startsWith('webmunk_id_')) {
                  webmunkId = className
                }
              })

              if (webmunkId != null) {
                const existingState = visibleMapping[webmunkId]

                if (existingState !== isVisible) {
                  visibleMapping[webmunkId] = isVisible

                  if (isVisible) {
                    let actions = listener['on-show']

                    if (actions === undefined) {
                      actions = []
                    }

                    actions.forEach(function (action) {
                      if (action === 'log-visible') {
                        const payload = {
                          'element-id': webmunkId,
                          'element-class': cssClass,
                          'url*': window.location.href,
                          'page-title*': document.title,
                          'element-content*': $(element).get(0).outerHTML
                        }

                        chrome.runtime.sendMessage({
                          content: 'record_data_point',
                          generator: 'webmunk-extension-element-show',
                          payload: payload
                        }, function (message) {
                        })
                      }
                    })
                  } else {
                    let actions = listener['on-hide']

                    if (actions === undefined) {
                      actions = []
                    }

                    actions.forEach(function (action) {
                      if (action === 'log-hidden') {
                        const payload = {
                          'element-id': webmunkId,
                          'element-class': cssClass,
                          'url*': window.location.href,
                          'page-title*': document.title,
                          'element-content*': $(element).get(0).outerHTML
                        }

                        chrome.runtime.sendMessage({
                          content: 'record_data_point',
                          generator: 'webmunk-extension-element-hide',
                          payload: payload
                        }, function (message) {
                        })
                      }
                    })
                  }
                }
              }
            })

            if (cssClass === '__webmunk-scroll-bar') {
              let actions = listener['on-scroll']

              if (actions === undefined) {
                actions = []
              }

              actions.forEach(function (action) {
                if (action === 'log-scroll') {
                  const payload = {
                    'url*': window.location.href,
                    'page-title*': document.title,
                    top: $(window).scrollTop(),
                    left: $(window).scrollLeft(),
                    width: $(window).width(),
                    height: $(window).height()
                  }

                  chrome.runtime.sendMessage({
                    content: 'record_data_point',
                    generator: 'webmunk-extension-scroll-position',
                    payload: payload
                  }, function (message) {
                  })
                }
              })
            }
          }
        }

        $(window).scroll(function () {
          clearTimeout($.data(this, 'webmunkScrollTimer'))
          $.data(this, 'webmunkScrollTimer', setTimeout(stoppedScrolling, 250))
        })

        stoppedScrolling()

        for (const [cssClass, listener] of Object.entries(window.webmunkRules.actions)) {
          $('.' + cssClass).each(function (index, element) {
            let webmunkId = null

            const elementClasses = $(element).attr('class').split(' ')

            elementClasses.forEach(function (className) {
              if (className.startsWith('webmunk_id_')) {
                webmunkId = className
              }
            })

            if (webmunkId != null) {
              let actions = listener['on-click']

              if (actions === undefined) {
                actions = []
              }

              actions.forEach(function (action) {
                if (action === 'log-click') {
                  $('.' + webmunkId).on('click', function () {
                    chrome.runtime.sendMessage({
                      content: 'record_data_point',
                      generator: 'webmunk-extension-element-click',
                      payload: {
                        'element-id': webmunkId,
                        'element-class': cssClass,
                        'url*': window.location.href,
                        'page-title*': document.title,
                        'page-content*': $('html').html(),
                        'element-content*': $(element).get(0).outerHTML
                      }
                    }, function (message) {

                    })
                  })
                }
              })
            }
          })
        }

        window.webmunkListenersLoaded = true
      }
    } else {
      console.log('[Webmunk] Disconnecting - no filters matched (' + window.webmunkPageId + ').')

      window.webmunkObserver.disconnect()
    }

    window.setTimeout(function () {
      window.webmunkLoading = false
    }, 100)
  }
}

if (window.webmunkObserver === undefined) {
  window.webmunkListener = function (mutationsList) {
    let doUpdate = false

    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        doUpdate = true
      } else if (mutation.type === 'attributes') {
        doUpdate = true
      }
    }

    if (doUpdate) {
      updateWebmunkClasses()
    }
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

  if (window.webmunkRules['log-elements'] !== undefined) {
    let hostMatch = false
    let pathMatch = true

    window.webmunkRules['log-elements'].filters.forEach(function (filter) {
      for (const [operation, pattern] of Object.entries(filter)) {
        if (operation === 'hostSuffix') {
          if (window.location.hostname.endsWith(pattern)) {
            hostMatch = true
          }
        } else if (operation === 'hostEquals') {
          if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
            hostMatch = true
          }
        }
      }
    })

    // Evaluate sites to exclude.

    window.webmunkRules['log-elements'].filters.forEach(function (filter) {
      for (const [operation, pattern] of Object.entries(filter)) {
        if (operation === 'excludeHostSuffix') {
          if (window.location.hostname.endsWith(pattern)) {
            hostMatch = false
          }
        } else if (operation === 'excludeHostEquals') {
          if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
            hostMatch = false
          }
        } else if (operation === 'excludePaths') {
          pattern.forEach(function (excludePath) {
            const pathRegEx = new RegExp(excludePath)

            if (pathRegEx.test(window.location.pathname)) {
              pathMatch = false
            }
          })
        }
      }
    })

    // console.log('[Webmunk] ' + window.location.href + ': hostMatch: ' + hostMatch + ' -- pathMatch: ' + pathMatch + ' (Log elements)')

    if (hostMatch && pathMatch) {
      for (const [action, patterns] of Object.entries(window.webmunkRules['log-elements'])) {
        if (action === 'load') {
          const matchedElements = {}

          patterns.forEach(function (pattern) {
            const patternMatches = []

            $(document).find(pattern).each(function (index, element) {
              const elementDetails = {
                'element-content*': $(element).get(0).outerHTML,
                offset: $(element).offset(),
                size: {
                  width: $(element).outerWidth(true),
                  height: $(element).outerHeight(true)
                }
              }

              patternMatches.push(elementDetails)
            })

            console.log('[Webmunk] Log elements (' + pattern + '): ' + patternMatches.length + ' found.')

            matchedElements[pattern] = patternMatches
          })

          const payload = {
            'pattern-matches': matchedElements,
            'url*': window.location.href,
            'page-title*': document.title,
            action: action
          }

          chrome.runtime.sendMessage({
            content: 'record_data_point',
            generator: 'webmunk-extension-log-elements',
            payload: payload
          })
        }
      }
    }
  }

  updateWebmunkClasses()
})
