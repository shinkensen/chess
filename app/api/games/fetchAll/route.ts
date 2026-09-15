export async function GET() {
  return new Response(JSON.stringify({ message: "API route placeholder" }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
