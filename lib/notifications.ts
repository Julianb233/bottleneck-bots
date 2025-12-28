// Notification types and utilities

export type NotificationType =
  | "bot_completed"
  | "bot_failed"
  | "bot_created"
  | "webhook_triggered"
  | "system_alert"
  | "usage_warning"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  botId?: string
  botName?: string
  read: boolean
  createdAt: string
  actionUrl?: string
}

export interface NotificationPreferences {
  email: {
    enabled: boolean
    onFailure: boolean
    onSuccess: boolean
    dailyDigest: boolean
  }
  inApp: {
    enabled: boolean
    onFailure: boolean
    onSuccess: boolean
  }
  slack?: {
    enabled: boolean
    webhookUrl: string
    onFailure: boolean
  }
}

export const defaultPreferences: NotificationPreferences = {
  email: {
    enabled: true,
    onFailure: true,
    onSuccess: false,
    dailyDigest: true,
  },
  inApp: {
    enabled: true,
    onFailure: true,
    onSuccess: true,
  },
}

export const notificationIcons: Record<NotificationType, string> = {
  bot_completed: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  bot_failed: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  bot_created: "M12 6v6m0 0v6m0-6h6m-6 0H6",
  webhook_triggered: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101",
  system_alert: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  usage_warning: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
}

export const notificationColors: Record<NotificationType, string> = {
  bot_completed: "text-green-500 bg-green-100",
  bot_failed: "text-red-500 bg-red-100",
  bot_created: "text-blue-500 bg-blue-100",
  webhook_triggered: "text-purple-500 bg-purple-100",
  system_alert: "text-yellow-500 bg-yellow-100",
  usage_warning: "text-orange-500 bg-orange-100",
}

// Create a notification
export function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  options?: {
    botId?: string
    botName?: string
    actionUrl?: string
  }
): Notification {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    message,
    botId: options?.botId,
    botName: options?.botName,
    read: false,
    createdAt: new Date().toISOString(),
    actionUrl: options?.actionUrl,
  }
}

// Format notification for display
export function formatNotificationTime(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
