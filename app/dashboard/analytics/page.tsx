"use client"

import { useState } from "react"

interface MetricCard {
  label: string
  value: string
  change: string
  changeType: "positive" | "negative" | "neutral"
  icon: string
}

const metrics: MetricCard[] = [
  {
    label: "Total Executions",
    value: "12,847",
    change: "+12.5%",
    changeType: "positive",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
  },
  {
    label: "Success Rate",
    value: "98.2%",
    change: "+0.8%",
    changeType: "positive",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  {
    label: "Avg Duration",
    value: "2.4s",
    change: "-0.3s",
    changeType: "positive",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
  },
  {
    label: "Failed Runs",
    value: "23",
    change: "-5",
    changeType: "positive",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
  },
]

interface BotStats {
  id: string
  name: string
  runs: number
  successRate: number
  avgDuration: string
  lastRun: string
}

const botStats: BotStats[] = [
  { id: "1", name: "Daily Report Generator", runs: 2847, successRate: 99.1, avgDuration: "3.2s", lastRun: "5m ago" },
  { id: "2", name: "API Data Sync", runs: 4521, successRate: 97.8, avgDuration: "1.8s", lastRun: "2m ago" },
  { id: "3", name: "Email Automation", runs: 1923, successRate: 98.5, avgDuration: "4.1s", lastRun: "1h ago" },
  { id: "4", name: "Slack Notifier", runs: 3156, successRate: 99.7, avgDuration: "0.8s", lastRun: "30m ago" },
  { id: "5", name: "Database Backup", runs: 400, successRate: 100, avgDuration: "45s", lastRun: "6h ago" },
]

// Simple bar chart component
function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value))
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
            style={{ height: `${(d.value / max) * 100}%` }}
          />
          <span className="text-xs text-gray-500">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d")

  const chartData = [
    { label: "Mon", value: 420 },
    { label: "Tue", value: 380 },
    { label: "Wed", value: 510 },
    { label: "Thu", value: 470 },
    { label: "Fri", value: 590 },
    { label: "Sat", value: 280 },
    { label: "Sun", value: 320 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">Monitor bot performance and trends</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={metric.icon} />
                </svg>
              </div>
              <span className={`text-sm font-medium ${
                metric.changeType === "positive" ? "text-green-600" :
                metric.changeType === "negative" ? "text-red-600" : "text-gray-600"
              }`}>
                {metric.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-sm text-gray-600">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executions Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Executions Over Time</h3>
          <BarChart data={chartData} />
        </div>

        {/* Success Rate Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Success vs Failed</h3>
          <div className="flex items-center justify-center h-40">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64" cy="64" r="56"
                  stroke="#e5e7eb" strokeWidth="12" fill="none"
                />
                <circle
                  cx="64" cy="64" r="56"
                  stroke="#22c55e" strokeWidth="12" fill="none"
                  strokeDasharray={`${98.2 * 3.52} 352`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">98.2%</span>
              </div>
            </div>
            <div className="ml-6 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm text-gray-600">Success: 12,614</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-sm text-gray-600">Failed: 233</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bot Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Bot Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bot</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Runs</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {botStats.map((bot) => (
                <tr key={bot.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">{bot.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {bot.runs.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${bot.successRate}%` }}
                        />
                      </div>
                      <span className="text-gray-600">{bot.successRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {bot.avgDuration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {bot.lastRun}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
