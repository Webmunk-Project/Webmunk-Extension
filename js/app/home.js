/* global requirejs */

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
        success('Enrollment successful', 'Thank you for providing your e-mail address.', data.identifier, data)
      } else {
        error('Enrollment failed', 'Unable to complete enrollment. Please verify that you have a working Internet connection and your e-mail address was entered correctly.')
      }
    })
  }

  return home
})
