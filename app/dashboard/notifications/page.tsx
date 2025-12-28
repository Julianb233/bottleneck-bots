"use client"

import { useState, useEffect } from "react"
import { notificationIcons, notificationColors, formatNotificationTime, type Notification, type NotificationPreferences, defaultPreferences } from "@/lib/notifications"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences)
  const [activeTab, setActiveTab] = useState<"all" | "settings">("all")
  const [filter, setFilter] = useState<"all" | "unread">("all")

  useEffect(() => {
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications?limit=50")
      const data = await res.json()
      setNotifications(data.notifications)
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  async function markAsRead(ids: string[]) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setNotifications(prev =>
      prev.map(n => (ids.includes(n.id) ? { ...n, read: true } : n))
    )
  }

  async function markAllAsRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function deleteNotification(id: string) {
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter(n => !n.read)
      : notifications

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Manage your notification preferences and history</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Settings
          </button>
        </nav>
      </div>

      {activeTab === "all" ? (
        <>
          {/* Filter & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  filter === "unread"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Unread
              </button>
            </div>
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Mark all as read
            </button>
          </div>

          {/* Notification List */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No notifications found
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.read ? "bg-blue-50/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${notificationColors[notification.type]}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={notificationIcons[notification.type]}
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{notification.title}</p>
                        {!notification.read && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mt-0.5">{notification.message}</p>
                      {notification.botName && (
                        <p className="text-xs text-gray-500 mt-1">Bot: {notification.botName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead([notification.id])}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Mark as read"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Settings Tab */
        <div className="space-y-6">
          {/* Email Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Enable email notifications</span>
                <input
                  type="checkbox"
                  checked={preferences.email.enabled}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      email: { ...preferences.email, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Notify on bot failures</span>
                <input
                  type="checkbox"
                  checked={preferences.email.onFailure}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      email: { ...preferences.email, onFailure: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Notify on successful runs</span>
                <input
                  type="checkbox"
                  checked={preferences.email.onSuccess}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      email: { ...preferences.email, onSuccess: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Daily digest summary</span>
                <input
                  type="checkbox"
                  checked={preferences.email.dailyDigest}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      email: { ...preferences.email, dailyDigest: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
            </div>
          </div>

          {/* In-App Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">In-App Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Enable in-app notifications</span>
                <input
                  type="checkbox"
                  checked={preferences.inApp.enabled}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      inApp: { ...preferences.inApp, enabled: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Show failure alerts</span>
                <input
                  type="checkbox"
                  checked={preferences.inApp.onFailure}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      inApp: { ...preferences.inApp, onFailure: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Show success alerts</span>
                <input
                  type="checkbox"
                  checked={preferences.inApp.onSuccess}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      inApp: { ...preferences.inApp, onSuccess: e.target.checked },
                    })
                  }
                  className="w-5 h-5 text-blue-600 rounded"
                />
              </label>
            </div>
          </div>

          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Preferences
          </button>
        </div>
      )}
    </div>
  )
}
