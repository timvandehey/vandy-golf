export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.json();

    // Bulk delete
    if (Array.isArray(body)) {
      const ids = body.map(item => typeof item === 'string' ? item : item.id).filter(Boolean);
      if (ids.length === 0) {
        return new Response('Missing round IDs', { status: 400 });
      }

      const statements = ids.map(id => 
        env.DB.prepare('DELETE FROM rounds WHERE id = ?').bind(id)
      );
      await env.DB.batch(statements);

      return new Response(JSON.stringify({ success: true, count: ids.length }), {
        headers: { 'Content-Type': 'application/json;charset=UTF-8' }
      });
    }

    // Single delete
    const { id } = body;
    if (!id) {
      return new Response('Missing id', { status: 400 });
    }

    await env.DB.prepare('DELETE FROM rounds WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}
