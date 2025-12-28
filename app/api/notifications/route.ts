import { NextResponse } from "next/server"
import { createNotification, type Notification } from "@/lib/notifications"

// In-memory store (replace with database in production)
let notifications: Notification[] = [
  createNotification("bot_completed", "Bot Completed", "Daily Report Generator finished successfully", {
    botId: "1",
    botName: "Daily Report Generator",
    actionUrl: "/dashboard/bots/1",
  }),
  createNotification("bot_failed", "Bot Failed", "API Sync Bot encountered an error: Connection timeout", {
    botId: "2",
    botName: "API Sync Bot",
    actionUrl: "/dashboard/bots/2",
  }),
  createNotification("webhook_triggered", "Webhook Triggered", "External service triggered Slack Notifier", {
    botId: "3",
    botName: "Slack Notifier",
  }),
  createNotification("system_alert", "System Alert", "Scheduled maintenance in 24 hours"),
]

// Set timestamps to recent
notifications = notifications.map((n, i) => ({
  ...n,
  createdAt: new Date(Date.now() - i * 1000 * 60 * 30).toISOString(),
}))

// GET /api/notifications - List notifications
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = parseInt(searchParams.get("limit") || "20")

  let result = notifications
  if (unreadOnly) {
    result = notifications.filter(n => !n.read)
  }
  result = result.slice(0, limit)

  return NextResponse.json({
    notifications: result,
    unreadCount: notifications.filter(n => !n.read).length,
    total: notifications.length,
  })
}

// POST /api/notifications - Create notification
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, title, message, botId, botName, actionUrl } = body

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: "type, title, and message are required" },
        { status: 400 }
      )
    }

    const notification = createNotification(type, title, message, {
      botId,
      botName,
      actionUrl,
    })

    notifications.unshift(notification)

    return NextResponse.json(notification, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { ids, markAllRead } = body

    if (markAllRead) {
      notifications = notifications.map(n => ({ ...n, read: true }))
      return NextResponse.json({ message: "All notifications marked as read" })
    }

    if (ids && Array.isArray(ids)) {
      notifications = notifications.map(n =>
        ids.includes(n.id) ? { ...n, read: true } : n
      )
      return NextResponse.json({ message: `${ids.length} notifications marked as read` })
    }

    return NextResponse.json({ error: "ids or markAllRead required" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

// DELETE /api/notifications - Clear notifications
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (id) {
    notifications = notifications.filter(n => n.id !== id)
    return NextResponse.json({ message: "Notification deleted" })
  }

  // Clear all read notifications
  notifications = notifications.filter(n => !n.read)
  return NextResponse.json({ message: "Read notifications cleared" })
}
