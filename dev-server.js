import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'bun:sqlite';
import { onRequest as onSyncRequest } from './functions/api/sync.js';
import { onRequest as onSaveRoundRequest } from './functions/api/rounds/save.js';
import { onRequest as onDeleteRoundRequest } from './functions/api/rounds/delete.js';
import { onRequest as onSaveCourseRequest } from './functions/api/courses/save.js';
import { onRequest as onDeleteCourseRequest } from './functions/api/courses/delete.js';
import { onRequest as onUserRequest } from './functions/api/auth/user.js';

// Setup local SQLite database with bun:sqlite
const db = new Database('./local-dev.db');

// Run schema and seed if db is empty
const schema = fs.readFileSync('./schema.sql', 'utf8');
db.run(schema);

const roundCount = db.prepare('SELECT count(*) as cnt FROM rounds').get()?.cnt || 0;
const courseCount = db.prepare('SELECT count(*) as cnt FROM courses').get()?.cnt || 0;
if (roundCount === 0 && courseCount === 0 && fs.existsSync('./seed.sql')) {
  const seed = fs.readFileSync('./seed.sql', 'utf8');
  db.run(seed);
  console.log('🌱 Seed data populated into local-dev.db');
}

// Emulate Cloudflare D1 API wrapper using bun:sqlite
const env = {
  DB: {
    prepare(query) {
      return {
        _params: [],
        bind(...params) {
          this._params = params;
          return this;
        },
        async all() {
          const stmt = db.prepare(query);
          const results = stmt.all(...this._params);
          return { results };
        },
        async run() {
          const stmt = db.prepare(query);
          const info = stmt.run(...this._params);
          return { success: true, meta: info };
        }
      };
    },
    async batch(statements) {
      const results = [];
      const tx = db.transaction(() => {
        for (const stmt of statements) {
          const s = db.prepare(stmt.query || stmt._query || stmt);
          results.push(s.run(...(stmt._params || [])));
        }
      });
      tx();
      return results;
    }
  }
};

const mimeTypes = {
  '.html': 'text/html;charset=UTF-8',
  '.css': 'text/css;charset=UTF-8',
  '.js': 'application/javascript;charset=UTF-8',
  '.json': 'application/json;charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    const dispatchCF = async (handler) => {
      const init = {
        method: req.method,
        headers: req.headers
      };
      if (req.method === 'POST' || req.method === 'PUT') {
        init.body = req;
        init.duplex = 'half';
      }
      const cfRequest = new Request(parsedUrl.href, init);
      const response = await handler({ request: cfRequest, env });
      res.statusCode = response.status;
      for (const [key, value] of response.headers.entries()) {
        res.setHeader(key, value);
      }
      const body = await response.text();
      return res.end(body);
    };

    // Handle API routes
    if (pathname.startsWith('/api/sync')) {
      return dispatchCF(onSyncRequest);
    }
    if (pathname.startsWith('/api/rounds/save')) {
      return dispatchCF(onSaveRoundRequest);
    }
    if (pathname.startsWith('/api/rounds/delete')) {
      return dispatchCF(onDeleteRoundRequest);
    }
    if (pathname.startsWith('/api/courses/save')) {
      return dispatchCF(onSaveCourseRequest);
    }
    if (pathname.startsWith('/api/courses/delete')) {
      return dispatchCF(onDeleteCourseRequest);
    }
    if (pathname.startsWith('/api/auth/user')) {
      return dispatchCF(onUserRequest);
    }

    // Serve static files fallback
    let filePath = path.join(process.cwd(), 'public', pathname === '/' ? 'index.html' : pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      return fs.createReadStream(filePath).pipe(res);
    }

    res.statusCode = 404;
    res.end('Not Found');
  } catch (err) {
    res.statusCode = 500;
    res.end(`<pre>${err.stack}</pre>`);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`⚡ Local golf dev server running at http://localhost:${PORT}`);
});
