## [2.0.0] TBA

* 🎉🎉🎉 added `Filesystem API` support for best data persistence - Data will resist even if user decide to clear browser history

## [1.3.0] 2023-01-31

* added `addAntiCacheParam` parameter to `getUrl` to add a random string to generated urls to prevent browser memory-caching
* added `nullIfKeyNotExist` parameter to `getUrl`
* added `defaultReturn` parameter to `getDataUri`
* fixed `convertValue` in case of `null/undefined` returns

## [1.2.0] 2022-08-02

* added `requestPersistentStorage` and `getStorageSpaceInfo`

## [1.1.0] 2022-07-31

* added warning when image file url support isn't available because of missing service worker
* added `getDataUri` function
* fixed safari support for blob file storage by using ArrayBuffer instead

## [1.0.2] 2022-07-28

* Initial release