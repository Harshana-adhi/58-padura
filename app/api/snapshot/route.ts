import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses the anon key deliberately: this route must only ever be able
// to do what a public visitor's browser could do directly.
function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export async function GET(request: NextRequest) {
  const version = request.nextUrl.searchParams.get("v");
  const supabase = anonClient();
  const { data, error } = await supabase.rpc("get_public_snapshot");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json(data);
  if (version) {
    // The snapshot for a given version never changes, so the first
    // request reads the database and every later one is served from
    // the edge.
    res.headers.set("Cache-Control", "public, s-maxage=31536000, immutable");
  } else {
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
  }
  return res;
}
