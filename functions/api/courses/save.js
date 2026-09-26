export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    // Bulk save
    if (Array.isArray(body)) {
      if (body.some(c => !c.id)) {
        return new Response('Invalid payload: Each item must contain an id', { status: 400 });
      }

      const statements = body.map(c => 
        env.DB.prepare(`
          INSERT INTO courses (id, data, updated_at)
          VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
          ON CONFLICT(id) DO UPDATE SET
            data = excluded.data,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        `).bind(c.id, typeof c === 'string' ? c : JSON.stringify(c))
      );

      await env.DB.batch(statements);

      return new Response(JSON.stringify({ success: true, count: body.length }), {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // Single save
    const course = body;
    if (!course.id) {
      return new Response('Missing id', { status: 400 });
    }

    const jsonStr = typeof course === 'string' ? course : JSON.stringify(course);

    await env.DB.prepare(`
      INSERT INTO courses (id, data, updated_at)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `).bind(course.id, jsonStr).run();

    const result = await env.DB.prepare(`
      SELECT id, data, updated_at 
      FROM courses 
      WHERE id = ?
    `).bind(course.id).all();

    const saved = result.results?.[0];
    if (!saved) {
      return new Response('Failed to retrieve saved course', { status: 500 });
    }

    const parsed = typeof saved.data === 'string' ? JSON.parse(saved.data) : saved.data;
    return new Response(JSON.stringify({ ...parsed, id: saved.id, updated_at: saved.updated_at }), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}
