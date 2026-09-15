const CACHE="focusplan-v105";
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./manifest.json","./icons/Icon.svg"])).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request).then(r=>{let c=r.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return r}).catch(()=>caches.match("./index.html"))))});
