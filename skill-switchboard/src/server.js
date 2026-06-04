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
  const hasCategories = typeof store.listCategories === 'function';

  function listSkills(categoryId) {
    return hasCategories ? store.listSkills(categoryId) : store.listSkills();
  }

  function toggleSkill(categoryId, skillId, enabled) {
    return hasCategories ? store.toggleSkill(categoryId, skillId, enabled) : store.toggleSkill(skillId, enabled);
  }

  function setAllSkills(categoryId, enabled) {
    return hasCategories ? store.setAllSkills(categoryId, enabled) : store.setAllSkills(enabled);
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/skills') {
        const skills = await listSkills('personal');
        sendJson(response, 200, { skills });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true, features: ['bulk', 'categories', 'custom-directories'] });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/categories') {
        const categories = hasCategories ? await store.listCategories() : [];
        sendJson(response, 200, { categories });
        return;
      }

      const categorySkillsMatch = url.pathname.match(/^\/api\/categories\/([^/]+)\/skills$/);
      if (request.method === 'GET' && categorySkillsMatch) {
        const categoryId = decodeURIComponent(categorySkillsMatch[1]);
        const skills = await listSkills(categoryId);
        sendJson(response, 200, { skills });
        return;
      }

      const categoryBulkMatch = url.pathname.match(/^\/api\/categories\/([^/]+)\/skills\/bulk$/);
      if (request.method === 'POST' && categoryBulkMatch) {
        const body = await readJson(request);
        const categoryId = decodeURIComponent(categoryBulkMatch[1]);
        const result = await setAllSkills(categoryId, Boolean(body.enabled));
        sendJson(response, 200, { result });
        return;
      }

      const categoryToggleMatch = url.pathname.match(/^\/api\/categories\/([^/]+)\/skills\/([^/]+)\/toggle$/);
      if (request.method === 'POST' && categoryToggleMatch) {
        const body = await readJson(request);
        const categoryId = decodeURIComponent(categoryToggleMatch[1]);
        const skillId = decodeURIComponent(categoryToggleMatch[2]);
        const skill = await toggleSkill(categoryId, skillId, Boolean(body.enabled));
        sendJson(response, 200, { skill });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/skills/bulk') {
        const body = await readJson(request);
        const result = await setAllSkills('personal', Boolean(body.enabled));
        sendJson(response, 200, { result });
        return;
      }

      const toggleMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/toggle$/);
      if (request.method === 'POST' && toggleMatch) {
        const body = await readJson(request);
        const name = decodeURIComponent(toggleMatch[1]);
        const skill = await toggleSkill('personal', name, Boolean(body.enabled));
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
