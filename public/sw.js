const CACHE='band-duel-shell-v1';
const SHELL=['/offline.html','/app-icon-192.png','/app-icon-512.png','/apple-touch-icon.png','/band-duel-mark.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('band-duel-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
// Always fetch the current game. Never cache profiles, API responses, login or moves.
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'&&['/','/play'].includes(url.pathname)){
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));return;
  }
  if(SHELL.includes(url.pathname))event.respondWith(fetch(request).catch(()=>caches.match(url.pathname)));
});
