import { NextResponse } from "next/server"

// POST /api/bots/[id]/clone - Clone a bot
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const { name } = body

    // In production, this would:
    // 1. Fetch the original bot from database
    // 2. Create a copy with new ID and optional new name
    // 3. Copy all configuration, but reset run history

    // Mock response
    const clonedBot = {
      id: crypto.randomUUID(),
      originalId: id,
      name: name || `Copy of Bot ${id}`,
      description: "Cloned bot",
      status: "paused", // Start paused
      config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      message: "Bot cloned successfully",
      bot: clonedBot,
    }, { status: 201 })

  } catch {
    return NextResponse.json(
      { error: "Failed to clone bot" },
      { status: 500 }
    )
  }
}
