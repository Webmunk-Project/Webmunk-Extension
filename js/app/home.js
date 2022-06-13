/* global requirejs, chrome */

requirejs.config({
  shim: {
    jquery: {
      exports: '$'
    }
  },
  baseUrl: 'vendor/js'
})

define(['app/config', 'jquery'], function (config) {
  const home = {}

  home.validateIdentifier = function (identifier, success, error) {
    if (identifier === null || identifier === undefined || identifier.trim() === '') {
      error('E-mail Required', 'Please enter an e-mail address to continue.')

      return
    }

    identifier = identifier.trim().toLowerCase()

    const payload = {
      identifier: $('#identifier').val()
    }

    $.post(config.enrollUrl, payload, function (data) {
      if (data.identifier !== undefined) {
        if (data.rules['uninstall-url'] !== undefined) {
          chrome.runtime.setUninstallURL(data.rules['uninstall-url'].replace('<IDENTIFIER>', data.identifier))
        }

        if (data.rules['enrollment-confirmation'] !== undefined) {
          let confirmHtml = ''

          data.rules['enrollment-confirmation'].forEach(function (line) {
            if (confirmHtml !== '') {
              confirmHtml += '<br /><br />'
            }

            confirmHtml += line
          })

          success('Enrollment successful', confirmHtml, data.identifier, data)
        } else {
          success('Enrollment successful', 'Thank you for providing your e-mail address.', data.identifier, data)
        }
      } else {
        error('Enrollment failed', 'Unable to complete enrollment. Please verify that you have a working Internet connection and your e-mail address was entered correctly.')
      }
    })
  }

  return home
})
