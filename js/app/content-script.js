/* global MutationObserver, chrome, crypto */

window.webmunkLoading = false
window.webmunkListenersLoaded = false

window.webmunkInitialized = new Date().getTime()
window.webmunkUpdateScheduleId = -1
window.webmunkNeedsFirstRun = true

window.webmunkExtensionCallbacks = []

window.registerExtensionCallback = function (callback) {
  window.webmunkExtensionCallbacks.push(callback)
}

// LOAD CONTENT EXTENSIONS

function uuidv4 () {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

window.webmunkPageId = uuidv4()

$.expr.pseudos.webmunkRandomMirror = $.expr.createPseudo(function (parameters) {
  const paramTokens = parameters.split(' ')

  const toMatch = $(paramTokens[0])
  let tagged = $(paramTokens[1] + '[data-webmunk-mirror="' + paramTokens[0] + '"]')
  let toTag = $(paramTokens[1] + ':not([data-webmunk-mirror="' + paramTokens[0] + '"])')

  while (toMatch.length > tagged.length && toTag.length > 0) {
    const randomIndex = Math.floor(Math.random() * toTag.length)

    $(toTag.get(randomIndex)).attr('data-webmunk-mirror', paramTokens[0])

    tagged = $(paramTokens[1] + '[data-webmunk-mirror="' + paramTokens[0] + '"]')
    toTag = $(paramTokens[1] + ':not([data-webmunk-mirror="' + paramTokens[0] + '"])')
  }

  return function (elem) {
    const attrValue = $(elem).attr('data-webmunk-mirror')

    if (attrValue !== undefined) {
      return attrValue === paramTokens[0]
    }

    return false
  }
})

$.expr.pseudos.webmunkContainsInsensitive = $.expr.createPseudo(function (query) {
  return function (elem) {
    return $(elem).text().toUpperCase().indexOf(query.toUpperCase()) >= 0
  }
})

// jQuery.expr[':'].icontains = function(a, i, m) {
//  return jQuery(a).text().toUpperCase()
//      .indexOf(m[3].toUpperCase()) >= 0;
// };

function locationFilterMatches (location, filters) {
  let hostMatch = false
  let pathMatch = true

  if (filters === undefined) {
    filters = window.webmunkRules.filters
  }

  filters.forEach(function (filter) {
    for (const [operation, pattern] of Object.entries(filter)) {
      if (operation === 'hostSuffix') {
        if (window.location.hostname.endsWith(pattern)) {
          hostMatch = true
        }
      } else if (operation === 'hostEquals') {
        if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
          hostMatch = true
        }
      } else if (operation === 'urlMatches') {
        const matchRe = new RegExp(pattern)

        if (window.location.href.toLowerCase().match(matchRe)) {
          hostMatch = true
        }
      }
    }
  })

  // Evaluate sites to exclude.

  filters.forEach(function (filter) {
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

  return hostMatch && pathMatch
}

function updateWebmunkClasses () {
  if (window.webmunkLoading || window.webmunkRules === undefined) {
    return
  }

  window.webmunkLoading = true

  if (window.webmunkRules !== undefined) {
    // Evaluate sites to include.

    if (locationFilterMatches(window.location, window.webmunkRules.filters)) {
      const addedClasses = []

      const lastRuleMatches = {}

      window.webmunkRules.rules.forEach(function (rule) {
        if (rule.match !== undefined) {
          const matches = $(document).find(rule.match)

          if (matches.length > 0) {
            console.log('[Webmunk] matches[' + rule.match + ']: ' + matches.length + ' (' + window.webmunkPageId + ')')
          }

          if (matches.length > 0) {
            const matchKey = 'rule.match__' + rule.match + '__' + window.location.href + '__' + window.location.href

            if (lastRuleMatches[matchKey] === undefined) {
              lastRuleMatches[matchKey] = 0
            }

            if (matches.length > lastRuleMatches[matchKey]) {
              lastRuleMatches[matchKey] = matches.length

              console.log('[Webmunk] Match key: ' + matchKey + ': ' + matches.length)

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
            }

            matches.each(function (index, element) {
              if (rule['add-class'] !== undefined) {
                $(this).addClass(rule['add-class'])

                if ($(this).attr('class').includes('webmunk_id_') === false) {
                  $(this).addClass('webmunk_id_' + uuidv4())
                }

                if (addedClasses.indexOf(rule['add-class']) === -1) {
                  addedClasses.push(rule['add-class'])
                }
              }

              if (rule['remove-class'] !== undefined) {
                $(this).removeClass(rule['remove-class'])
              }
            })
          }
        }
      })

      addedClasses.forEach(function (className) {
        $(document).find('.' + className + ':not(.webmunk-class-member-logged-' + className + ')').each(function (index, element) {
          chrome.runtime.sendMessage({
            content: 'record_data_point',
            generator: 'webmunk-extension-class-added',
            payload: {
              'class-name': className,
              'url*': window.location.href,
              'page-title*': document.title,
              'element-content*': $(element).get(0).outerHTML
            }
          }, function (message) {
          })

          $(element).addClass('webmunk-class-member-logged-' + className)
        })
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
                        console.log('[Webmunk] log-visible')

                        const payload = {
                          'element-id': webmunkId,
                          'element-class': cssClass,
                          'url*': window.location.href,
                          'page-title*': document.title,
                          'element-content*': $(element).get(0).outerHTML,
                          offset: $(element).offset(),
                          size: {
                            width: $(element).outerWidth(true),
                            height: $(element).outerHeight(true)
                          }
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
                        console.log('[Webmunk] log-hidden')

                        const payload = {
                          'element-id': webmunkId,
                          'element-class': cssClass,
                          'url*': window.location.href,
                          'page-title*': document.title,
                          'element-content*': $(element).get(0).outerHTML,
                          offset: $(element).offset(),
                          size: {
                            width: $(element).outerWidth(true),
                            height: $(element).outerHeight(true)
                          }
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
                let actionName = action
                let options = {}

                if (typeof action === 'object' && action.name !== undefined) {
                  actionName = action.name
                  options = action.options
                }

                if (options === undefined) {
                  options = {}
                }

                if (actionName === 'log-click') {
                  $('.' + webmunkId).on('click', function () {
                    let logElement = $(element)

                    if (options.ancestors !== undefined) {
                      let found = false

                      options.ancestors.forEach(function (ancestorPattern) {
                        if (found === false) {
                          const ancestorElement = $(element).closest(ancestorPattern)

                          if (ancestorElement.length > 0) {
                            logElement = ancestorElement
                            found = true
                          }
                        }
                      })
                    }

                    chrome.runtime.sendMessage({
                      content: 'record_data_point',
                      generator: 'webmunk-extension-element-click',
                      payload: {
                        'element-id': webmunkId,
                        'element-class': cssClass,
                        'url*': window.location.href,
                        'page-title*': document.title,
                        'page-content*': $('html').html(),
                        'element-content*': logElement.get(0).outerHTML,
                        offset: logElement.offset(),
                        size: {
                          width: logElement.outerWidth(true),
                          height: logElement.outerHeight(true)
                        }
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

        console.log('[Webmunk] Connected (' + window.webmunkPageId + ').')
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
      let timeout = 2500

      const now = new Date().getTime()

      if (now - window.webmunkInitialized < 2500) {
        timeout = 500
      }

      if (window.webmunkUpdateScheduleId === -1) {
        window.webmunkUpdateScheduleId = window.setTimeout(function () {
          updateWebmunkClasses()

          window.webmunkUpdateScheduleId = -1
        }, timeout)
      }
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
    window.webmunkRules['log-elements'].forEach(function (element) {
      let hostMatch = false
      let pathMatch = true

      Object.entries(element.filters).forEach(function (filter) {
        const operation = filter[0]
        const pattern = filter[1]

        if (operation === 'hostSuffix') {
          if (window.location.hostname.endsWith(pattern)) {
            hostMatch = true
          }
        } else if (operation === 'hostEquals') {
          if (window.location.hostname.toLowerCase() === pattern.toLowerCase()) {
            hostMatch = true
          }
        } else if (operation === 'urlMatches') {
          const matchRe = new RegExp(pattern)

          if (window.location.href.toLowerCase().match(matchRe)) {
            hostMatch = true
          }
        }
      })

      // Evaluate sites to exclude.

      Object.entries(element.filters).forEach(function (filter) {
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
        for (const [action, patterns] of Object.entries(element)) {
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

              console.log('[Webmunk] Log elements (' + pattern + '): ' + patternMatches.length + ' found. (' + window.webmunkPageId + ')')

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

          // log leave
        }
      }
    })
  }

  window.webmunkExtensionCallbacks.forEach(function (callback) {
    callback(message)
  })

  updateWebmunkClasses()
})
