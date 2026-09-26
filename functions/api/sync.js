export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const since = url.searchParams.get('since') || '1970-01-01T00:00:00.000Z';
  const serverTime = new Date().toISOString();

  try {
    // 1. Fetch updated/new rounds
    const roundsResult = await env.DB.prepare(`
      SELECT id, data, updated_at 
      FROM rounds 
      WHERE updated_at > ?
    `).bind(since).all();

    // 2. Fetch deleted round IDs
    const deletedRoundsResult = await env.DB.prepare(`
      SELECT id 
      FROM deleted_rounds 
      WHERE deleted_at > ?
        AND id NOT IN (SELECT id FROM rounds)
    `).bind(since).all();

    // 3. Fetch updated/new courses
    const coursesResult = await env.DB.prepare(`
      SELECT id, data, updated_at 
      FROM courses 
      WHERE updated_at > ?
    `).bind(since).all();

    // 4. Fetch deleted course IDs
    const deletedCoursesResult = await env.DB.prepare(`
      SELECT id 
      FROM deleted_courses 
      WHERE deleted_at > ?
        AND id NOT IN (SELECT id FROM courses)
    `).bind(since).all();

    // Parse JSON data for ease of consumption
    const rounds = (roundsResult.results || []).map(r => {
      try {
        const parsed = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        return { ...parsed, id: r.id, updated_at: r.updated_at };
      } catch {
        return { id: r.id, updated_at: r.updated_at };
      }
    });

    const courses = (coursesResult.results || []).map(c => {
      try {
        const parsed = typeof c.data === 'string' ? JSON.parse(c.data) : c.data;
        return { ...parsed, id: c.id, updated_at: c.updated_at };
      } catch {
        return { id: c.id, updated_at: c.updated_at };
      }
    });

    return new Response(JSON.stringify({
      rounds,
      deleted_rounds: (deletedRoundsResult.results || []).map(row => row.id),
      courses,
      deleted_courses: (deletedCoursesResult.results || []).map(row => row.id),
      timestamp: serverTime
    }), {
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json;charset=UTF-8' }
    });
  }
}
