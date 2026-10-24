import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  txt: 'text/plain; charset=utf-8'
};

serve(async (req) => {
  const url = new URL(req.url);
  if (url.pathname === '/site' || url.pathname === '/functions/v1/site') {
    return Response.redirect(`${url.origin}${url.pathname}/`, 302);
  }

  let assetPath = url.pathname
    .replace(/^\/functions\/v1\/site/, '')
    .replace(/^\/site/, '');
  if (!assetPath || assetPath === '/') assetPath = '/index.html';
  if (assetPath.endsWith('/')) assetPath += 'index.html';

  const upstream = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/site${assetPath}`;
  const response = await fetch(upstream);
  if (!response.ok) {
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  }

  const ext = assetPath.split('.').pop()?.toLowerCase() || '';
  const headers = new Headers();
  headers.set('content-type', MIME[ext] || 'application/octet-stream');
  headers.set('cache-control', 'public, max-age=60');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: 200, headers });
});
