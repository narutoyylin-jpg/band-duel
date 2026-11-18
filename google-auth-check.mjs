import assert from 'node:assert/strict';
import {createSessionCookie,sessionSubject,safeReturnPath,verifyGoogleCredential,createGoogleLoginContext,googleLoginContext,handleGoogleLogin} from './google-auth.mjs';

const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',publicKey);
const clientId='test-client.apps.googleusercontent.com';
const now=Math.floor(Date.now()/1000);
async function token(extra={}){
  const head=encode({alg:'RS256',kid:'test-key'});
  const payload=encode({iss:'https://accounts.google.com',aud:clientId,sub:'123456789012345678901',iat:now,exp:now+3600,...extra});
  const signed=head+'.'+payload;
  const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(signed))).toString('base64url');
  return signed+'.'+signature;
}
const fetchKeys=async()=>new Response(JSON.stringify({keys:[{...jwk,kid:'test-key',alg:'RS256',use:'sig'}]}),{headers:{'Cache-Control':'max-age=60'}});
const valid=await token();
assert.equal((await verifyGoogleCredential(valid,clientId,fetchKeys)).sub,'123456789012345678901');
await assert.rejects(verifyGoogleCredential(valid,'other-client',fetchKeys));
await assert.rejects(verifyGoogleCredential(await token({exp:now-1}),clientId,fetchKeys));
await assert.rejects(verifyGoogleCredential(valid.slice(0,-1)+(valid.endsWith('A')?'B':'A'),clientId,fetchKeys));
const secret='local-test-secret-with-at-least-thirty-two-chars';
const cookie=await createSessionCookie('123456789012345678901',secret,false);
const request=new Request('http://localhost',{headers:{Cookie:cookie.split(';')[0]}});
assert.equal(await sessionSubject(request,secret),'123456789012345678901');
assert.equal(await sessionSubject(request,secret+'-wrong'),null);
assert.equal(await sessionSubject(new Request('http://localhost',{headers:{Cookie:cookie.replace('v1.','v2.').split(';')[0]}}),secret),null);
assert.equal(safeReturnPath('/play?room=ABC123'),'/play?room=ABC123');
assert.equal(safeReturnPath('//evil.example/'),'/play');
assert.equal(safeReturnPath('/api/rooms'),'/play');
const env={AUTH_MODE:'google',GOOGLE_CLIENT_ID:clientId,BAND_DUEL_SESSION_SECRET:secret},state=await createGoogleLoginContext(secret,'/play?room=ABC123',true),stateCookie=state.cookie.split(';')[0];
assert.equal((await googleLoginContext(new Request('https://band.test/login',{headers:{Cookie:stateCookie}}),secret)).returnTo,'/play?room=ABC123');
const redirectRequest=(credential,csrf='csrf-test',cookie=stateCookie+'; g_csrf_token=csrf-test')=>new Request('https://band.test/api/auth/google',{method:'POST',headers:{Origin:'https://accounts.google.com','Content-Type':'application/x-www-form-urlencoded',Cookie:cookie},body:new URLSearchParams({credential,g_csrf_token:csrf})});
const redirect=await handleGoogleLogin(redirectRequest(await token({nonce:state.nonce})),env,fetchKeys);assert.equal(redirect.status,303);assert.equal(redirect.headers.get('Location'),'/play?room=ABC123');assert(redirect.headers.getSetCookie().some(c=>c.startsWith('band-duel-session=')));assert(redirect.headers.getSetCookie().some(c=>c.startsWith('__Host-band-google-login=;')));
const opaque=redirectRequest(await token({nonce:state.nonce}));opaque.headers.set('Origin','null');assert.equal((await handleGoogleLogin(opaque,env,fetchKeys)).headers.get('Location'),'/play?room=ABC123','opaque redirect Origin still requires matching CSRF and signed nonce');
const malicious=redirectRequest(await token({nonce:state.nonce}));malicious.headers.set('Origin','https://evil.test');assert.equal((await handleGoogleLogin(malicious,env,fetchKeys)).headers.get('Location'),'/login?error=verification');
for(const invalid of [redirectRequest(valid),redirectRequest(await token({nonce:'wrong'})),redirectRequest(await token({nonce:state.nonce}),'wrong-csrf'),redirectRequest(await token({nonce:state.nonce}),'csrf-test','g_csrf_token=csrf-test')]){const reply=await handleGoogleLogin(invalid,env,fetchKeys);assert.equal(reply.status,303);assert.equal(reply.headers.get('Location'),'/login?error=verification');assert(!reply.headers.get('Set-Cookie'));}
assert.equal(await googleLoginContext(new Request('https://band.test/login',{headers:{Cookie:stateCookie}}),secret+'-wrong'),null);
await assert.rejects(verifyGoogleCredential(valid,clientId,fetchKeys,state.nonce));
console.log('Google credential, session and return-path checks passed.');
