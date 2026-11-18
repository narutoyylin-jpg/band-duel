// Give a person time to finish Cloudflare's login and consent screens.
// This only extends Wrangler's local authorization wait. OAuth permissions,
// PKCE, callback validation and Cloudflare's own expiry checks stay intact.
const isWranglerLogin=process.argv.some(arg=>/[\\/]wrangler[\\/](?:bin[\\/]wrangler|wrangler-dist[\\/]cli)\.js$/.test(arg))&&process.argv.includes('login');
if(isWranglerLogin){
  const originalSetTimeout=globalThis.setTimeout;
  globalThis.setTimeout=function(callback,delay,...args){
    const body=typeof callback==='function'?Function.prototype.toString.call(callback):'';
    const isConsentWait=Number(delay)===120000&&body.includes('Timed out waiting for authorization code')&&body.includes('user oauth authorization timeout');
    if(isConsentWait)console.log('Cloudflare authorization: allowing up to 20 minutes to complete login.');
    return Reflect.apply(originalSetTimeout,this,[callback,isConsentWait?1200000:delay,...args]);
  };
}
