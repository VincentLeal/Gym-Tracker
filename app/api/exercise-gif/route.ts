import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  try {
    const encoded = encodeURIComponent(name)
    const res = await fetch(
      `https://exercisedb.dev/api/exercises/name/${encoded}?limit=1`,
      { next: { revalidate: 86400 } } // cache 24h
    )

    if (!res.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const data = await res.json()
    const gifUrl = data?.[0]?.gifUrl ?? null

    return NextResponse.json({ gifUrl })
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}
