/* global chrome */

const pdkFunction = function () {
  const pdk = {}

  pdk.openDatabase = function (success, failure) {
    if (pdk.db !== undefined) {
      success(pdk.db)

      return
    }

    const PDK_DATABASE_VERSION = 1

    const request = window.indexedDB.open('passive_data_kit', PDK_DATABASE_VERSION)

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

  pdk.enqueueDataPoint = function (generatorId, dataPoint) {
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
      }

      request.onerror = function (event) {
        console.log('[PDK] Data point enqueuing failed.')
        console.log(event)
      }
    }, function (error) {
      if (error) {
        console.log(error)
      }
    })
  }

  pdk.uploadQueuedDataPoints = function (endpoint, callback) {
    pdk.openDatabase(function (db) {
      const index = db.transaction(['dataPoints'], 'readonly')
        .objectStore('dataPoints')
        .index('transmitted')

      const request = index.getAll(0)

      request.onsuccess = function () {
        const pendingItems = request.result

        if (pendingItems.length === 0) {
          callback() // Finished
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
          } else {
            chrome.storage.local.get({ 'pdk-identifier': '' }, function (result) {
              if (result['pdk-identifier'] !== '') {
                pdk.uploadBundle(endpoint, result['pdk-identifier'], xmitBundle, function () {
                  pdk.updateDataPoints(toTransmit, function () {
                    window.setTimeout(function () {
                      pdk.uploadQueuedDataPoints(endpoint, callback)
                    }, 0)
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
          window.setTimeout(function () {
            pdk.updateDataPoints(dataPoints, complete)
          }, 0)
        }

        request.onerror = function (event) {
          console.log('The data has write has failed')
          console.log(event)

          window.setTimeout(function () {
            pdk.updateDataPoints(dataPoints, complete)
          }, 0)
        }
      }, function (error) {
        console.log(error)

        complete()
      })
    }
  }

  pdk.uploadBundle = function (endpoint, userId, points, complete) {
    console.log("CALLING nacl_factory.instantiate")
    console.log(nacl_factory == undefined)

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


	  nacl_factory.instantiate(function (nacl) {
		console.log('in nacl_factory')

		console.log(nacl.to_hex(nacl.random_bytes(16)));

		const dataString = JSON.stringify(points, null, 2)

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
	  });
  }

  return pdk
}

if (typeof define === 'undefined') {
  window.PDK = pdkFunction()
} else {
  define(pdkFunction)
}
