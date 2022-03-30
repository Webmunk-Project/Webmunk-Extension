/* global chrome, indexedDB, fetch */

const pdkFunction = function () {
  const pdk = {}

  pdk.openDatabase = function (success, failure) {
    if (pdk.db !== undefined) {
      success(pdk.db)

      return
    }

    const PDK_DATABASE_VERSION = 1

    const request = indexedDB.open('passive_data_kit', PDK_DATABASE_VERSION)

    request.onerror = function (event) {
      failure(event)
    }

    request.onsuccess = function (event) {
      pdk.db = request.result

      success(pdk.db)
    }

    request.onupgradeneeded = function (event) {
      pdk.db = event.target.result

      switch (event.oldVersion) {
        case 0: {
          const dataPoints = pdk.db.createObjectStore('dataPoints', {
            keyPath: 'dataPointId',
            autoIncrement: true
          })

          dataPoints.createIndex('generatorId', 'generatorId', { unique: false })
          dataPoints.createIndex('dataPoint', 'dataPoint', { unique: false })
          dataPoints.createIndex('date', 'date', { unique: false })
          dataPoints.createIndex('transmitted', 'transmitted', { unique: false })
        }
      }
    }
  }

  pdk.enqueueDataPoint = function (generatorId, dataPoint, complete) {
    pdk.openDatabase(function (db) {
      const payload = {
        generatorId: generatorId,
        dataPoint: dataPoint,
        date: (new Date()).getTime(),
        transmitted: 0
      }

      const request = db.transaction(['dataPoints'], 'readwrite')
        .objectStore('dataPoints')
        .put(payload)

      request.onsuccess = function (event) {
        console.log('[PDK] Data point saved successfully.')

        complete()
      }

      request.onerror = function (event) {
        console.log('[PDK] Data point enqueuing failed.')
        console.log(event)

        complete()
      }
    }, function (error) {
      if (error) {
        console.log(error)
      }
    })
  }

  pdk.currentlyUploading = false

  pdk.uploadQueuedDataPoints = function (endpoint, callback) {
    if (pdk.currentlyUploading) {
      return
    }

    pdk.currentlyUploading = true

    pdk.openDatabase(function (db) {
      const index = db.transaction(['dataPoints'], 'readonly')
        .objectStore('dataPoints')
        .index('transmitted')

      const request = index.getAll(0)

      request.onsuccess = function () {
        const pendingItems = request.result

        if (pendingItems.length === 0) {
          callback() // Finished

          pdk.currentlyUploading = false
        } else {
          const toTransmit = []
          const xmitBundle = []

          for (let i = 0; i < pendingItems.length && i < 1000; i++) {
            const pendingItem = pendingItems[i]

            pendingItem.transmitted = new Date().getTime()

            pendingItem.dataPoint.date = pendingItem.date
            pendingItem.dataPoint.generatorId = pendingItem.generatorId

            toTransmit.push(pendingItem)
            xmitBundle.push(pendingItem.dataPoint)
          }

          if (toTransmit.length === 0) {
            callback()

            pdk.currentlyUploading = false
          } else {
            chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
              if (result['pdk-identifier'] !== '') {
                pdk.uploadBundle(endpoint, result['pdk-identifier'], xmitBundle, function () {
                  pdk.updateDataPoints(toTransmit, function () {
                    pdk.currentlyUploading = false

                    pdk.uploadQueuedDataPoints(endpoint, callback)
                  })
                })
              }
            })
          }
        }
      }

      request.onerror = function (event) {
        console.log('[PDK] PDK database error')
        console.log(event)
      }
    })
  }

  pdk.updateDataPoints = function (dataPoints, complete) {
    if (dataPoints.length === 0) {
      complete()
    } else {
      pdk.openDatabase(function (db) {
        const dataPoint = dataPoints.pop()

        const request = db.transaction(['dataPoints'], 'readwrite')
          .objectStore('dataPoints')
          .put(dataPoint)

        request.onsuccess = function (event) {
          pdk.updateDataPoints(dataPoints, complete)
        }

        request.onerror = function (event) {
          console.log('The data has write has failed')
          console.log(event)

          pdk.updateDataPoints(dataPoints, complete)
        }
      }, function (error) {
        console.log(error)

        complete()
      })
    }
  }

  pdk.uploadBundle = function (endpoint, userId, points, complete) {
    //    console.log("CALLING nacl_factory.instantiate")
    //    console.log(nacl_factory == undefined)

    const manifest = chrome.runtime.getManifest()

    const userAgent = manifest.name + '/' + manifest.version + ' ' + navigator.userAgent

    for (let i = 0; i < points.length; i++) {
      const metadata = {}

      if (points[i].date === undefined) {
        points[i].date = (new Date()).getTime()
      }

      metadata.source = userId
      metadata.generator = points[i].generatorId + ': ' + userAgent
      metadata['generator-id'] = points[i].generatorId
      metadata.timestamp = points[i].date / 1000 // Unix timestamp

      points[i]['passive-data-metadata'] = metadata
    }

    /*
        $.ajax({
          type: 'CREATE',
          url: endpoint,
          dataType: 'json',
          contentType: 'application/json',
          data: dataString,
          success: function (data, textStatus, jqXHR) {
            complete()
          }
        })
*/
    const dataString = JSON.stringify(points, null, 2)

    fetch(endpoint, {
      method: 'CREATE',
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      headers: {
        'Content-Type': 'application/json'
      },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: dataString // body data type must match "Content-Type" header
    })
      .then(response => response.json())
      .then(function (data) {
        complete()
      })
      .catch((error) => {
        console.error('Error:', error)
      })
  }

  /*
      nacl_factory.instantiate(function (nacl) {
        console.log('in nacl_factory')

        console.log(nacl.to_hex(nacl.random_bytes(16)));

      });
*/

  return pdk
}

if (typeof define === 'undefined') {
  if (typeof window !== 'undefined') {
    window.PDK = pdkFunction()
  } else {
    PDK = pdkFunction() // eslint-disable-line no-global-assign, no-undef
  }
} else {
  PDK = define(pdkFunction) // eslint-disable-line no-global-assign, no-undef
}
