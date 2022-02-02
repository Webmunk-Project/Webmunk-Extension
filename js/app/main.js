/* global requirejs, chrome */

const PDK_IDENTIFIER = 'pdk-identifier'
const PDK_LAST_UPLOAD = 'pdk-last-upload'
// const PDK_TOTAL_UPLOADED = 'pdk-total-uploaded'

requirejs.config({
  shim: {
    jquery: {
      exports: '$'
    },
    bootstrap: {
      deps: ['jquery']
    }
  },
  baseUrl: 'vendor/js',
  paths: {
    app: '../../js/app',
    pdk: '../../js/lib/passive-data-kit',
    bootstrap: '../../vendor/js/bootstrap.bundle',
    moment: '../../vendor/js/moment.min',
    material: '../../vendor/js/material-components-web.min'
  }
})

requirejs(['material', 'moment', 'jquery'], function (mdc, moment) {
  requirejs(['app/home', 'app/history', 'app/config'], function (home, history, config) {
    document.documentElement.style.setProperty('--mdc-theme-primary', config.primaryColor)

    document.title = config.extensionName

    $('#extensionTitle').text(config.extensionName)
    $('#valueUploadUrl').text(config.uploadUrl)
    $('#valueAboutExtension').html(config.aboutExtension)

    const displayMainUi = function () {
      $('#loginScreen').hide()
      $('#detailsScreen').show()
      $('#settingsScreen').hide()
      $('#actionOpenSettings').show()
      $('#actionReloadRules').show()
      $('#actionCloseSettings').hide()

      chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
        if (result[PDK_IDENTIFIER] === '') {
          $('#valueIndentifier').text('Unknown')
        } else {
          $('#valueIndentifier').text(result[PDK_IDENTIFIER])
        }
      })

      chrome.storage.local.get({ 'pdk-last-upload': '' }, function (result) {
        if (result[PDK_LAST_UPLOAD] === '') {
          $('#valueLastUpload').text('Never')
        } else {
          $('#valueLastUpload').text(moment(result[PDK_LAST_UPLOAD]).format('llll'))
        }
      })
    }

    const displaySettingsUi = function () {
      $('#loginScreen').hide()
      $('#detailsScreen').hide()
      $('#settingsScreen').show()
      $('#actionOpenSettings').hide()
      $('#actionReloadRules').hide()
      $('#actionCloseSettings').show()
    }

    const dialog = new mdc.dialog.MDCDialog(document.querySelector('#dialog'))

    const displayIdentifierUi = function () {
      $('#loginScreen').show()
      $('#detailsScreen').hide()
      $('#settingsScreen').hide()
      $('#actionOpenSettings').hide()
      $('#actionCloseSettings').hide()
      $('#actionReloadRules').hide()

      let identifierValidated = false
      let identifier = null

      $('#submitIdentifier').click(function (eventObj) {
        eventObj.preventDefault()
        identifier = $('#identifier').val()

        home.validateIdentifier(identifier, function (title, message, newIdentifier, data) {
          $('#dialog-title').text(title)
          $('#dialog-content').text(message)

          identifier = newIdentifier

          identifierValidated = true

          chrome.storage.local.set({
            'webmunk-config': data
          }, function (result) {
            dialog.open()
          })
        }, function (title, message) {
          $('#dialog-title').text(title)
          $('#dialog-content').text(message)

          dialog.open()

          identifierValidated = false
        })
      })

      dialog.listen('MDCDialog:closed', function (event) {
        if (identifierValidated) {
          chrome.storage.local.set({
            'pdk-identifier': identifier
          }, function (result) {
            displayMainUi()
          })
        }
      })

      $('#detailsScreen').hide()
      $('#loginScreen').show()
    }

    chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
      if (result[PDK_IDENTIFIER] === '') {
        displayIdentifierUi()
      } else {
        displayMainUi()
      }
    })

    // for (const item in mdc) {
    //   console.log('  ' + item)
    // }

    /* eslint-disable no-unused-vars */

    const appBar = new mdc.topAppBar.MDCTopAppBar(document.querySelector('.mdc-top-app-bar'))
    const identifierField = new mdc.textField.MDCTextField(document.querySelector('#field_identifier'))
    const someButton = new mdc.ripple.MDCRipple(document.querySelector('.mdc-button'))

    $('#actionCloseSettings').click(function (eventObj) {
      eventObj.preventDefault()

      displayMainUi()

      return false
    })

    $('#actionOpenSettings').click(function (eventObj) {
      eventObj.preventDefault()

      displaySettingsUi()

      return false
    })

    $('#actionReloadRules').click(function (eventObj) {
      eventObj.preventDefault()

      $('#actionReloadRules').text('sync')

      chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
        if (result[PDK_IDENTIFIER] !== '') {
          const payload = {
            identifier: result[PDK_IDENTIFIER]
          }

          $.get(config.enrollUrl, payload, function (data) {
            if (data.rules !== undefined) {
              console.log('NEW RULES: ' + JSON.stringify(data.rules, null, 2))

              chrome.storage.local.set({
                'webmunk-config': data.rules
              }, function (result) {
                console.log('new rules fetched')

                $('#actionReloadRules').text('refresh')
              })
            } else {
              $('#actionReloadRules').text('sync_problem')
            }
          })
        }
      })

      console.log('RELOAD RULES')

      return false
    })

    $('#resetExtension').click(function (eventObj) {
      eventObj.preventDefault()

      history.resetDataCollection(function () {
        displayMainUi()
      })

      return false
    })

    $('#uploadData').click(function (eventObj) {
    /*
      eventObj.preventDefault()

      $('#uploadData').attr('disabled', true)

      history.uploadPendingVisits(function () {
        const now = new Date()

        chrome.storage.local.set({
          'pdk-last-upload': now
        }, function (result) {
          $('#valueLastUpload').text(moment(now).format('llll'))

          history.progressListener('Uploaded pending visits', true, 1.0)

          history.fetchUploadedTransmissionsCount(function (err, uploadedCount) {
            if (err) {
              console.log(err)
            }

            $('#valueTotalUploaded').text('' + uploadedCount)
          })

          history.fetchPendingTransmissionsCount(function (err, pendingCount) {
            if (err) {
              console.log(err)
            }

            $('#valuePendingItems').text('' + pendingCount)
          })

          $('#uploadData').attr('disabled', false)
        })
      })
      */

      return false
    })
  })
})
