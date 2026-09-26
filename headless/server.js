import { Database } from "bun:sqlite";
import path from "node:path";
import fs from "node:fs";
import schemaSql from "../schema.sql" with { type: "text" };

// Load .env configuration file if present
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (key && val) {
          process.env[key] = val;
        }
      }
    }
  });
}

const PORT = process.env.PORT || 8080;
const DB_PATH = process.env.DB_PATH || "golf.db";
const CF_REMOTE_URL = process.env.CF_REMOTE_URL;

// Initialize SQLite database
const db = new Database(DB_PATH);

// Ensure tables exist using embedded schema.sql
db.run(schemaSql);

console.info(`[Headless Golf Server] Database loaded: ${DB_PATH}`);
console.info(`[Headless Golf Server] Listening on port: ${PORT}`);

// Helper to perform synchronization logic against remote Cloudflare D1
async function doApiSync() {
  if (!CF_REMOTE_URL) {
    throw new Error("CF_REMOTE_URL environment variable is not defined");
  }

  let lastSync = "1970-01-01T00:00:00.000Z";
  const kvRow = db.prepare("SELECT val FROM kv WHERE key = ?").get("last_sync_timestamp");
  if (kvRow) {
    lastSync = kvRow.val;
  }

  const syncUrl = `${CF_REMOTE_URL.replace(/\/$/, "")}/api/sync?since=${encodeURIComponent(lastSync)}`;
  console.info(`[Headless Golf Server] Fetching sync updates from: ${syncUrl}`);

  const headers = {};
  if (process.env.CF_CLIENT_ID && process.env.CF_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = process.env.CF_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.CF_CLIENT_SECRET;
  }

  const response = await fetch(syncUrl, { headers });
  if (!response.ok) {
    throw new Error(`CF remote sync request failed: ${response.statusText}`);
  }

  const delta = await response.json();

  const syncTx = db.transaction((rounds, deletedRounds, courses, deletedCourses, timestamp) => {
    const insertRound = db.prepare(`
      INSERT INTO rounds (id, data, created_at, updated_at)
      VALUES ($id, $data, $created_at, $updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    const deleteRound = db.prepare("DELETE FROM rounds WHERE id = ?");

    const insertCourse = db.prepare(`
      INSERT INTO courses (id, data, created_at, updated_at)
      VALUES ($id, $data, $created_at, $updated_at)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    const deleteCourse = db.prepare("DELETE FROM courses WHERE id = ?");

    (rounds || []).forEach(r => {
      insertRound.run({
        $id: r.id,
        $data: typeof r === 'string' ? r : JSON.stringify(r),
        $created_at: r.created_at || new Date().toISOString(),
        $updated_at: r.updated_at || new Date().toISOString()
      });
    });

    (deletedRounds || []).forEach(id => {
      deleteRound.run(id);
    });

    (courses || []).forEach(c => {
      insertCourse.run({
        $id: c.id,
        $data: typeof c === 'string' ? c : JSON.stringify(c),
        $created_at: c.created_at || new Date().toISOString(),
        $updated_at: c.updated_at || new Date().toISOString()
      });
    });

    (deletedCourses || []).forEach(id => {
      deleteCourse.run(id);
    });

    db.prepare(`
      INSERT INTO kv (key, val)
      VALUES ('last_sync_timestamp', ?)
      ON CONFLICT(key) DO UPDATE SET val = excluded.val
    `).run(timestamp);
  });

  syncTx(delta.rounds, delta.deleted_rounds, delta.courses, delta.deleted_courses, delta.timestamp);

  console.info(`[Headless Golf Server] Synced ${delta.rounds?.length || 0} rounds, ${delta.courses?.length || 0} courses. Timestamp: ${delta.timestamp}`);

  return {
    success: true,
    roundsCount: delta.rounds?.length || 0,
    coursesCount: delta.courses?.length || 0,
    timestamp: delta.timestamp
  };
}

// Serve HTTP API
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /api/auth/user
    if (url.pathname === "/api/auth/user" && req.method === "GET") {
      const email = req.headers.get("cf-access-authenticated-user-email") || null;
      return Response.json({
        authenticated: Boolean(email),
        email: email || "local-developer",
        isDev: !email
      }, { headers: corsHeaders });
    }

    // GET /api/sync
    if (url.pathname === "/api/sync" && req.method === "GET") {
      try {
        const since = url.searchParams.get("since") || "1970-01-01T00:00:00.000Z";
        const roundsRows = db.prepare("SELECT * FROM rounds WHERE updated_at > ?").all(since);
        const deletedRoundsRows = db.prepare("SELECT id FROM deleted_rounds WHERE deleted_at > ? AND id NOT IN (SELECT id FROM rounds)").all(since);
        const coursesRows = db.prepare("SELECT * FROM courses WHERE updated_at > ?").all(since);
        const deletedCoursesRows = db.prepare("SELECT id FROM deleted_courses WHERE deleted_at > ? AND id NOT IN (SELECT id FROM courses)").all(since);

        const rounds = roundsRows.map(r => {
          try {
            const p = JSON.parse(r.data);
            return { ...p, id: r.id, updated_at: r.updated_at };
          } catch {
            return { id: r.id, updated_at: r.updated_at };
          }
        });

        const courses = coursesRows.map(c => {
          try {
            const p = JSON.parse(c.data);
            return { ...p, id: c.id, updated_at: c.updated_at };
          } catch {
            return { id: c.id, updated_at: c.updated_at };
          }
        });

        return Response.json({
          rounds,
          deleted_rounds: deletedRoundsRows.map(r => r.id),
          courses,
          deleted_courses: deletedCoursesRows.map(c => c.id),
          timestamp: new Date().toISOString()
        }, { headers: corsHeaders });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // POST /api/rounds/save
    if (url.pathname === "/api/rounds/save" && req.method === "POST") {
      try {
        const body = await req.json();
        const isBatch = Array.isArray(body);
        const now = new Date().toISOString();
        const insertStmt = db.prepare(`
          INSERT INTO rounds (id, data, created_at, updated_at)
          VALUES ($id, $data, $created_at, $updated_at)
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        `);

        if (isBatch) {
          db.transaction(() => {
            body.forEach(r => {
              insertStmt.run({
                $id: r.id,
                $data: JSON.stringify(r),
                $created_at: now,
                $updated_at: now
              });
            });
          })();
          return Response.json({ success: true, count: body.length }, { headers: corsHeaders });
        } else {
          insertStmt.run({
            $id: body.id,
            $data: JSON.stringify(body),
            $created_at: now,
            $updated_at: now
          });
          return Response.json(body, { headers: corsHeaders });
        }
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // POST /api/rounds/delete
    if (url.pathname === "/api/rounds/delete" && req.method === "POST") {
      try {
        const body = await req.json();
        const deleteStmt = db.prepare("DELETE FROM rounds WHERE id = ?");
        if (Array.isArray(body)) {
          const ids = body.map(i => typeof i === 'string' ? i : i.id).filter(Boolean);
          db.transaction(() => {
            ids.forEach(id => deleteStmt.run(id));
          })();
          return Response.json({ success: true, count: ids.length }, { headers: corsHeaders });
        } else {
          deleteStmt.run(body.id);
          return Response.json({ success: true, id: body.id }, { headers: corsHeaders });
        }
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // POST /api/courses/save
    if (url.pathname === "/api/courses/save" && req.method === "POST") {
      try {
        const body = await req.json();
        const isBatch = Array.isArray(body);
        const now = new Date().toISOString();
        const insertStmt = db.prepare(`
          INSERT INTO courses (id, data, created_at, updated_at)
          VALUES ($id, $data, $created_at, $updated_at)
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = excluded.updated_at
        `);

        if (isBatch) {
          db.transaction(() => {
            body.forEach(c => {
              insertStmt.run({
                $id: c.id,
                $data: JSON.stringify(c),
                $created_at: now,
                $updated_at: now
              });
            });
          })();
          return Response.json({ success: true, count: body.length }, { headers: corsHeaders });
        } else {
          insertStmt.run({
            $id: body.id,
            $data: JSON.stringify(body),
            $created_at: now,
            $updated_at: now
          });
          return Response.json(body, { headers: corsHeaders });
        }
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    // POST /api/courses/delete
    if (url.pathname === "/api/courses/delete" && req.method === "POST") {
      try {
        const body = await req.json();
        const deleteStmt = db.prepare("DELETE FROM courses WHERE id = ?");
        if (Array.isArray(body)) {
          const ids = body.map(i => typeof i === 'string' ? i : i.id).filter(Boolean);
          db.transaction(() => {
            ids.forEach(id => deleteStmt.run(id));
          })();
          return Response.json({ success: true, count: ids.length }, { headers: corsHeaders });
        } else {
          deleteStmt.run(body.id);
          return Response.json({ success: true, id: body.id }, { headers: corsHeaders });
        }
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
});
