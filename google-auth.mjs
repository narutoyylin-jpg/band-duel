const encoder = new TextEncoder();
const SESSION_COOKIE = 'band-duel-session';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
let cachedKeys = null;
let cachedUntil = 0;

const toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const fromBase64Url = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Invalid encoding');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  if (toBase64Url(bytes) !== value) throw Error('Invalid encoding');
  return bytes;
};
const jsonPart = value => JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
const hmacKey = secret => crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);

export function googleAuthConfigured(env) {
  return env?.AUTH_MODE === 'google' && typeof env.GOOGLE_CLIENT_ID === 'string' && env.GOOGLE_CLIENT_ID.length > 10 && typeof env.BAND_DUEL_SESSION_SECRET === 'string' && env.BAND_DUEL_SESSION_SECRET.length >= 32;
}

export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/play';
  try {
    const url = new URL(value, 'https://band-duel.local');
    return url.origin === 'https://band-duel.local' && ['/play', '/'].includes(url.pathname) ? url.pathname + url.search : '/play';
  } catch { return '/play'; }
}

async function googleKeys(fetcher) {
  if (cachedKeys && Date.now() < cachedUntil) return cachedKeys;
  const response = await fetcher('https://www.googleapis.com/oauth2/v3/certs', {headers: {'Accept': 'application/json'}});
  if (!response.ok) throw Error('Google keys unavailable');
  const result = await response.json();
  if (!Array.isArray(result.keys)) throw Error('Invalid Google keys');
  cachedKeys = result.keys;
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 300);
  cachedUntil = Date.now() + Math.min(Math.max(maxAge, 60), 3600) * 1000;
  return cachedKeys;
}

export async function verifyGoogleCredential(token, clientId, fetcher = fetch, expectedNonce = null) {
  if (typeof token !== 'string' || token.length > 8192) throw Error('Invalid Google credential');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Invalid Google credential');
  const header = jsonPart(parts[0]);
  const claims = jsonPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw Error('Invalid Google signature');
  const keyData = (await googleKeys(fetcher)).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
  if (!keyData) throw Error('Google signing key not found');
  const key = await crypto.subtle.importKey('jwk', keyData, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(parts[2]), encoder.encode(parts[0] + '.' + parts[1]));
  const now = Math.floor(Date.now() / 1000);
  if (!valid || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || claims.aud !== clientId || !Number.isInteger(claims.exp) || claims.exp <= now || !Number.isInteger(claims.iat) || claims.iat > now + 60 || typeof claims.sub !== 'string' || !/^[0-9]{1,64}$/.test(claims.sub)) throw Error('Invalid Google credential');
  if(expectedNonce!==null&&claims.nonce!==expectedNonce)throw Error('Invalid login nonce');
  return {sub: claims.sub};
}

// Short-lived, signed login context binds Google's redirect to the browser that started it.
export async function createGoogleLoginContext(secret,returnTo='/play',secure=true){
  const nonce=toBase64Url(crypto.getRandomValues(new Uint8Array(24))),payload=toBase64Url(encoder.encode(JSON.stringify({nonce,returnTo:safeReturnPath(returnTo),exp:Math.floor(Date.now()/1000)+600})));
  const signature=toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(secret),encoder.encode('login.'+payload))));
  return {nonce,cookie:`${secure?'__Host-band-google-login':'band-google-login'}=${payload}.${signature}; HttpOnly; SameSite=${secure?'None':'Lax'}; Path=/; Max-Age=600${secure?'; Secure':''}`};
}
export async function googleLoginContext(request,secret){
  const secure=new URL(request.url).protocol==='https:',name=secure?'__Host-band-google-login':'band-google-login',value=cookieValue(request,name);
  try{const [payload,signature,...rest]=(value||'').split('.');if(rest.length||!payload||!signature)return null;
    if(!await crypto.subtle.verify('HMAC',await hmacKey(secret),fromBase64Url(signature),encoder.encode('login.'+payload)))return null;
    const state=jsonPart(payload);return /^[A-Za-z0-9_-]{32}$/.test(state.nonce)&&Number.isInteger(state.exp)&&state.exp>Math.floor(Date.now()/1000)?{nonce:state.nonce,returnTo:safeReturnPath(state.returnTo)}:null;
  }catch{return null;}
}
export function clearGoogleLoginContext(secure=true){return `${secure?'__Host-band-google-login':'band-google-login'}=; HttpOnly; SameSite=${secure?'None':'Lax'}; Path=/; Max-Age=0${secure?'; Secure':''}`;}
export function cookieValue(request,name){return request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||null;}
export async function handleGoogleLogin(request,env,fetcher=fetch){
  const url=new URL(request.url),form=request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded'),secure=url.protocol==='https:';
  const fail=(message,status)=>{if(status!==401)console.warn('Band Duel login check',status===403?'login-origin':status===503?'login-config':status===413?'login-size':'request-format');return form?new Response(null,{status:303,headers:{Location:'/login?error=verification','Cache-Control':'no-store'}}):Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});};
  if(!googleAuthConfigured(env))return fail('Google 登入尚未設定完成。',503);
  const origin=request.headers.get('Origin');
  // Browsers may send an opaque Origin after Google's cross-origin POST redirect.
  // Form login is still bound by both Google's CSRF cookie and our signed nonce context.
  if(!form&&origin!==url.origin||form&&origin&&![url.origin,'https://accounts.google.com','null'].includes(origin))return fail('請從 Band Duel 網站登入。',403);
  if(!form&&!request.headers.get('Content-Type')?.includes('application/json'))return fail('登入資料格式錯誤。',415);
  const raw=await request.text();if(raw.length>12000)return fail('登入資料過長。',413);
  let failure='request-format';
  try{
    let credential,state;
    if(form){const body=new URLSearchParams(raw),csrf=body.get('g_csrf_token'),cookie=cookieValue(request,'g_csrf_token');
      failure=!cookie?'csrf-cookie-missing':'csrf-mismatch';if(!csrf||csrf.length>256||csrf!==cookie)throw Error('Invalid CSRF');
      failure='login-context';state=await googleLoginContext(request,env.BAND_DUEL_SESSION_SECRET);if(!state)throw Error('Login expired');credential=body.get('credential');
    }else{const body=JSON.parse(raw);if(!body||Array.isArray(body)||Object.keys(body).length!==1||typeof body.credential!=='string')throw Error('Invalid body');credential=body.credential;}
    failure='google-token';const {sub}=await verifyGoogleCredential(credential,env.GOOGLE_CLIENT_ID,fetcher,state?.nonce||null);failure='game-session';const cookie=await createSessionCookie(sub,env.BAND_DUEL_SESSION_SECRET,secure);
    if(form){const headers=new Headers({'Location':state.returnTo,'Cache-Control':'no-store'});headers.append('Set-Cookie',cookie);headers.append('Set-Cookie',clearGoogleLoginContext(secure));return new Response(null,{status:303,headers});}
    return Response.json({ok:true},{headers:{'Set-Cookie':cookie,'Cache-Control':'no-store'}});
  }catch(e){console.warn('Band Duel login check',e.message==='Invalid login nonce'?'login-nonce':failure);return fail('Google 登入驗證失敗，請再試一次。',401);}
}

export async function createSessionCookie(sub, secret, secure = true) {
  if (typeof secret !== 'string' || secret.length < 32 || !/^[0-9]{1,64}$/.test(sub)) throw Error('Invalid session configuration');
  const payload = toBase64Url(encoder.encode(JSON.stringify({sub, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS})));
  const data = 'v1.' + payload;
  const signature = toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(data))));
  return `${SESSION_COOKIE}=${data}.${signature}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

export async function sessionSubject(request, secret) {
  if (typeof secret !== 'string' || secret.length < 32) return null;
  const cookie = request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + '='));
  const value = cookie?.slice(SESSION_COOKIE.length + 1);
  if (!value || value.length > 1000) return null;
  try {
    const parts = value.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return null;
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64Url(parts[2]), encoder.encode(parts[0] + '.' + parts[1]));
    if (!valid) return null;
    const claims = jsonPart(parts[1]);
    return /^[0-9]{1,64}$/.test(claims.sub) && Number.isInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000) ? claims.sub : null;
  } catch { return null; }
}

export function clearSessionCookie(secure = true) {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}
