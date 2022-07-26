importScripts('../dist/browstorjs.js')

const browstorjsDbName = "browstorJs"

self.addEventListener('activate',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
  // place your additional app code here
})

self.addEventListener('fetch',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
  // place your additional app code here
})

self.addEventListener('message',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
  // place your additional app code here
})