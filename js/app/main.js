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
    material: '../../vendor/js/material-components-web'
  }
})

requirejs(['material', 'moment', 'pdk', 'jquery'], function (mdc, moment, pdk) {
  requirejs(['app/home', 'app/history', 'app/config'], function (home, history, config) {
    document.documentElement.style.setProperty('--mdc-theme-primary', config.primaryColor)

    document.title = config.extensionName

    $('#extensionTitle').text(config.extensionName)
    $('#valueUploadUrl').text(config.uploadUrl)
    $('#valueAboutExtension').html(config.aboutExtension)

    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionCloseSettingsTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionOpenSettingsTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionReloadRulesTooltip'))
    mdc.tooltip.MDCTooltip.attachTo(document.querySelector('#actionUploadDataTooltip'))

    const displayMainUi = function () {
      $('#loginScreen').hide()
      $('#detailsScreen').show()
      $('#settingsScreen').hide()
      $('#actionOpenSettings').show()
      $('#actionReloadRules').show()
      $('#actionUploadData').show()
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

      pdk.enqueueDataPoint('webmunk-extension-action', {
        action: 'show-main-screen'
      })
    }

    const displaySettingsUi = function () {
      $('#loginScreen').hide()
      $('#detailsScreen').hide()
      $('#settingsScreen').show()
      $('#actionOpenSettings').hide()
      $('#actionReloadRules').hide()
      $('#actionUploadData').hide()
      $('#actionCloseSettings').show()
    }

    const dialog = mdc.dialog.MDCDialog.attachTo(document.querySelector('#dialog'))

    const displayIdentifierUi = function () {
      $('#loginScreen').show()
      $('#detailsScreen').hide()
      $('#settingsScreen').hide()
      $('#actionOpenSettings').hide()
      $('#actionCloseSettings').hide()
      $('#actionReloadRules').hide()
      $('#actionUploadData').hide()

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
            'webmunk-config': data.rules
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

    /* eslint-disable no-unused-vars */

    const appBar = mdc.topAppBar.MDCTopAppBar.attachTo(document.querySelector('.mdc-top-app-bar'))
    const identifierField = mdc.textField.MDCTextField.attachTo(document.querySelector('#field_identifier'))
    mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'))

    $('#actionCloseSettings').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('webmunk-extension-action', {
        action: 'close-settings'
      })

      displayMainUi()

      return false
    })

    $('#actionOpenSettings').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('webmunk-extension-action', {
        action: 'open-settings'
      })

      displaySettingsUi()

      return false
    })

    $('#actionReloadRules').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('webmunk-extension-action', {
        action: 'reload-rules'
      })

      $('#actionReloadRules').text('sync')

      chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
        if (result[PDK_IDENTIFIER] !== '') {
          const payload = {
            identifier: result[PDK_IDENTIFIER]
          }

          $.get(config.enrollUrl, payload, function (data) {
            if (data.rules !== undefined) {
              chrome.storage.local.set({
                'webmunk-config': data.rules
              }, function (result) {
                $('#dialog-title').text('Rules updated')
                $('#dialog-content').text('Fetched updated rules successfully.')

                dialog.open()

                $('#actionReloadRules').text('refresh')
              })
            } else {
              $('#actionReloadRules').text('sync_problem')
            }
          })
        }
      })

      return false
    })

    let uploading = false

    $('#actionUploadData').click(function (eventObj) {
      eventObj.preventDefault()

      pdk.enqueueDataPoint('webmunk-extension-action', {
        action: 'upload-data'
      })

      if (uploading === false) {
        $('#actionUploadData').text('cloud_sync')

        uploading = true

        pdk.uploadQueuedDataPoints(config.uploadUrl, function () {
          $('#actionUploadData').text('cloud_upload')

          $('#dialog-title').text('Data uploaded')
          $('#dialog-content').text('Data uploaded successfully.')

          dialog.open()

          uploading = false
        })
      }

      return false
    })

    $('#resetExtension').click(function (eventObj) {
      eventObj.preventDefault()

      history.resetDataCollection(function () {
        displayMainUi()
      })

      return false
    })
  })
})
