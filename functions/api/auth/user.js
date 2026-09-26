export async function onRequest(context) {
  const { request } = context;
  const email = request.headers.get('cf-access-authenticated-user-email') || null;

  return new Response(JSON.stringify({
    authenticated: Boolean(email),
    email: email || 'local-developer',
    isDev: !email
  }), {
    headers: { 'Content-Type': 'application/json;charset=UTF-8' }
  });
}
