importScripts('../dist/browstorjs.js')

const browstorjsDbName = "browstorJs"

self.addEventListener('activate',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
})

self.addEventListener('fetch',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
})

self.addEventListener('message',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event, browstorjsDbName)) return
})