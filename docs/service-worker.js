importScripts('scripts/browstorjs.min.js')

self.addEventListener('activate',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event)) return
  // place your additional app code here
})

self.addEventListener('fetch',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event)) return
  // place your additional app code here
})

self.addEventListener('message',  event => {
  if(BrowstorJS.handleServiceWorkerEvents(event)) return
  // place your additional app code here
})