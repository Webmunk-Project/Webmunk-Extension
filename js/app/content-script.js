/* global MutationObserver, chrome, crypto */

window.webmunkLoading = false
window.webmunkListenersLoaded = false

window.webmunkInitialized = new Date().getTime()
window.webmunkUpdateScheduleId = -1
window.webmunkNeedsFirstRun = true

window.webmunkModuleCallbacks = []

window.registerModuleCallback = function (callback) {
  window.webmunkModuleCallbacks.push(callback)
}

window.webmunkPageChangeListeners = []

window.registerModulePageChangeListener = function (listener) {
  window.webmunkPageChangeListeners.push(listener)
}; // eslint-disable-line semi, no-trailing-spaces

// LOAD CONTENT MODULES

function uuidv4 () {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

window.webmunkPageId = uuidv4()

$.expr.pseudos.webmunkRandomMirror = $.expr.createPseudo(function (parameters) {
  const paramTokens = parameters.split(' ')

  const toMatch = $(paramTokens[0])

  let taggedSelector = ''
  let toTagSelector = ''

  for (let i = 1; i < paramTokens.length; i++) {
    if (taggedSelector !== '') {
      taggedSelector += ','
    }

    taggedSelector += paramTokens[i] + '[data-webmunk-mirror="' + paramTokens[0] + '"]:webmunkWithinPage'

    if (toTagSelector !== '') {
      toTagSelector += ','
    }

    toTagSelector += paramTokens[i] + ':not([data-webmunk-mirror="' + paramTokens[0] + '"]):webmunkWithinPage'
  }

  console.log('taggedSelector: ' + taggedSelector)
  console.log('toTagSelector: ' + toTagSelector)

  let tagged = $(taggedSelector)
  let toTag = $(toTagSelector)

  while (toMatch.length > tagged.length && toTag.length > 0) {
    const randomIndex = Math.floor(Math.random() * toTag.length)

    $(toTag.get(randomIndex)).attr('data-webmunk-mirror', paramTokens[0])

    tagged = $(taggedSelector)
    toTag = $(toTagSelector)
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
  const queryUpper = query.toUpperCase()

  return function (elem) {
    return $(elem).text().toUpperCase().includes(queryUpper)
  }
})

$.expr.pseudos.webmunkContainsInsensitiveAny = $.expr.createPseudo(function (queryItems) {
  queryItems = JSON.parse(queryItems)

  return function (elem) {
    for (const queryItem of queryItems) {
      const queryUpper = queryItem.toUpperCase()

      if ($(elem).text().toUpperCase().includes(queryUpper)) {
        return true
      }
    }

    return false
  }
})

$.expr.pseudos.webmunkImageAltTagContainsInsensitiveAny = $.expr.createPseudo(function (queryItems) {
  queryItems = JSON.parse(queryItems)

  return function (elem) {
    for (const queryItem of queryItems) {
      const queryUpper = queryItem.toUpperCase()

      const altText = $(elem).attr('alt')

      if (altText !== undefined && altText !== null) {
        if (altText.toUpperCase().includes(queryUpper)) {
          return true
        }
      }
    }

    return false
  }
})

$.expr.pseudos.webmunkWithinPage = $.expr.createPseudo(function () {
  const width = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, document.body.offsetWidth, document.documentElement.offsetWidth, document.documentElement.clientWidth)
  const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.documentElement.clientHeight)

  return function (elem) {
    const position = elem.getBoundingClientRect()

    if (position.x > width) {
      return false
    }

    if (position.y > height) {
      return false
    }

    if ((position.x + position.width) < 0) {
      return false
    }

    if ((position.y + position.height) < 0) {
      return false
    }

    return true
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
  if (window.webmunkLoading || window.webmunkRules === undefined || (window.location.parent !== undefined && window.location !== window.location.parent)) {
    return
  }

  window.webmunkLoading = true

  if (window.webmunkRules !== undefined) {
    // Evaluate sites to include.

    if (locationFilterMatches(window.location, window.webmunkRules.filters)) {
      // console.log('[Webmunk] Applying rules: ' + window.webmunkRules + ' -- ' + (new Date()) + ' -- ' + window.location)

      const addedClasses = []

      const lastRuleMatches = {}

      window.webmunkRules.rules.forEach(function (rule) {
        if (rule.match !== undefined) {
          // const start = Date.now()

          const matches = $(document).find(rule.match)

          if (matches.length > 0) {
            console.log('[Webmunk] matches[' + rule.match + ']: ' + matches.length)

            const matchKey = 'rule.match__' + rule.match + '__' + window.location.href + '__' + window.location.href

            if (lastRuleMatches[matchKey] === undefined) {
              lastRuleMatches[matchKey] = 0
            }

            if (matches.length > lastRuleMatches[matchKey]) {
              lastRuleMatches[matchKey] = matches.length

              chrome.runtime.sendMessage({
                content: 'record_data_point',
                generator: 'webmunk-extension-matched-rule',
                payload: {
                  'page-id': window.webmunkPageId,
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

          // const now = Date.now()

          // console.log('[Webmunk] Rule time: ' + (now - start) + ' -- ' + matches.length + ' -- ' + rule.match)
        }
      })

      addedClasses.forEach(function (className) {
        $(document).find('.' + className + ':not(.webmunk-class-member-logged-' + className + ')').each(function (index, element) {
          chrome.runtime.sendMessage({
            content: 'record_data_point',
            generator: 'webmunk-extension-class-added',
            payload: {
              'page-id': window.webmunkPageId,
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
                        const payload = {
                          'page-id': window.webmunkPageId,
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
                          payload: payload // eslint-disable-line object-shorthand
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
                          'page-id': window.webmunkPageId,
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
                          payload: payload // eslint-disable-line object-shorthand
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
                    'page-id': window.webmunkPageId,
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
                    payload: payload // eslint-disable-line object-shorthand
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
                        'page-id': window.webmunkPageId,
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
  const finalUpdate = function () {
    updateWebmunkClasses()
  }

  let finalTimeout = null

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

          for (const listener of window.webmunkPageChangeListeners) {
            listener()
          }

          window.webmunkUpdateScheduleId = -1
        }, timeout)
      }

      if (finalTimeout !== null) {
        window.clearTimeout(finalTimeout)
      }

      finalTimeout = window.setTimeout(finalUpdate, 2500)
    }
  }

  const nudgeDataPoints = function () {
    chrome.runtime.sendMessage({
      content: 'nudge_data_points'
    }, function (message) {
      console.log('[Webmunk] ' + window.location.href + ': Nudged data points')
      console.log(message)
    })
  }

  window.setTimeout(nudgeDataPoints, 1000)

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
              'page-id': window.webmunkPageId,
              'pattern-matches': matchedElements,
              'url*': window.location.href,
              'page-title*': document.title,
              action: action // eslint-disable-line object-shorthand
            }

            chrome.runtime.sendMessage({
              content: 'record_data_point',
              generator: 'webmunk-extension-log-elements',
              payload: payload // eslint-disable-line object-shorthand
            })
          }

          // log leave
        }
      }
    })
  }

  window.webmunkModuleCallbacks.forEach(function (callback) {
    callback(message)
  })

  updateWebmunkClasses()
})

window.setTimeout(updateWebmunkClasses, 100)
