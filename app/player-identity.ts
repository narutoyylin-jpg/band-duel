import { env } from 'cloudflare:workers';
import { sessionSubject } from '../google-auth.mjs';

// All game services already read this trusted header. In independent mode we
// replace it with a verified Google session before handing the request over.
export async function withPlayerIdentity(request: Request): Promise<Request> {
  if (env.AUTH_MODE !== 'google') return request;
  const headers = new Headers(request.headers);
  headers.delete('oai-authenticated-user-id');
  headers.delete('oai-authenticated-user-email');
  const sub = await sessionSubject(request, env.BAND_DUEL_SESSION_SECRET);
  if (sub) headers.set('oai-authenticated-user-id', 'google:' + sub);
  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
    duplex: 'half',
  } as RequestInit & {duplex: 'half'});
}
