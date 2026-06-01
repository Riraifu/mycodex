'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function safeStaticPath(publicDir, requestPath) {
  const pathname = requestPath === '/' ? '/index.html' : requestPath;
  const decoded = decodeURIComponent(pathname);
  const target = path.normalize(path.join(publicDir, decoded));
  if (!target.startsWith(publicDir)) {
    return null;
  }
  return target;
}

async function serveStatic(request, response, publicDir) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const target = safeStaticPath(publicDir, url.pathname);
  if (!target) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(target);
    const type = MIME_TYPES[path.extname(target)] || 'application/octet-stream';
    response.writeHead(200, { 'content-type': type });
    response.end(content);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    throw error;
  }
}

function createServer({ store, publicDir = DEFAULT_PUBLIC_DIR }) {
  const resolvedPublicDir = path.resolve(publicDir);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/skills') {
        const skills = await store.listSkills();
        sendJson(response, 200, { skills });
        return;
      }

      const toggleMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/toggle$/);
      if (request.method === 'POST' && toggleMatch) {
        const body = await readJson(request);
        const name = decodeURIComponent(toggleMatch[1]);
        const skill = await store.toggleSkill(name, Boolean(body.enabled));
        sendJson(response, 200, { skill });
        return;
      }

      if (request.method === 'GET') {
        await serveStatic(request, response, resolvedPublicDir);
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const status = error.status || 500;
      sendJson(response, status, { error: error.message || 'Internal server error' });
    }
  });
}

module.exports = {
  createServer
};
