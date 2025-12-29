/**
 * Mock Database Functions for Bots and Executions
 *
 * TODO: Replace in-memory storage with Supabase integration
 * - Import getServerSupabase from '@/lib/supabase'
 * - Replace all mock functions with actual Supabase queries
 * - Add proper error handling for database operations
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type BotStatus = 'active' | 'paused' | 'stopped'
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type TriggerType = 'manual' | 'schedule' | 'webhook'
export type ScheduleType = 'cron' | 'one-time'

export interface BotAction {
  id: string
  type: 'http_request' | 'email' | 'slack' | 'discord' | 'scrape' | 'custom' | 'webhook' | 'delay' | 'filter' | 'transform'
  config: Record<string, unknown>
  order: number
}

export interface BotSchedule {
  type: ScheduleType
  cronExpression?: string // For cron type: "0 9 * * 1-5" (9 AM weekdays)
  oneTimeDate?: string // For one-time type: ISO 8601 date string
  timezone?: string // e.g., "America/New_York"
  enabled: boolean
}

export interface BotConfig {
  type: 'schedule' | 'webhook' | 'manual'
  schedule?: string // Legacy: cron expression
  scheduleConfig?: BotSchedule // New: detailed schedule config
  webhookUrl?: string
  actions: BotAction[]
  settings?: Record<string, unknown>
}

export interface Bot {
  id: string
  userId: string
  name: string
  description: string | null
  config: BotConfig
  status: BotStatus
  createdAt: string
  updatedAt: string
}

export interface ActionResult {
  actionId: string
  type: string
  success: boolean
  result?: unknown
  error?: string
  startedAt: string
  completedAt: string
  duration: number // milliseconds
}

export interface ExecutionLog {
  id: string
  executionId: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface Execution {
  id: string
  botId: string
  userId: string
  status: ExecutionStatus
  triggerType: TriggerType
  triggerData?: Record<string, unknown>
  actionResults: ActionResult[]
  startedAt: string
  completedAt: string | null
  error: string | null
  duration: number | null // milliseconds
}

export interface CreateBotInput {
  name: string
  description?: string | null
  config: BotConfig
  status?: BotStatus
}

export interface UpdateBotInput {
  name?: string
  description?: string | null
  config?: BotConfig
  status?: BotStatus
}

export interface ExecutionFilters {
  botId?: string
  userId?: string
  status?: ExecutionStatus
  triggerType?: TriggerType
  dateFrom?: string
  dateTo?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

// ============================================================================
// In-Memory Storage (Mock Database)
// ============================================================================

// TODO: Replace with Supabase tables
const botsStore = new Map<string, Bot>()
const executionsStore = new Map<string, Execution>()
const logsStore = new Map<string, ExecutionLog[]>()

// Initialize with some sample data for development
function initializeSampleData() {
  const sampleBot: Bot = {
    id: 'sample-bot-1',
    userId: 'sample-user-1',
    name: 'Sample Monitoring Bot',
    description: 'A sample bot that monitors a website',
    config: {
      type: 'schedule',
      schedule: '*/15 * * * *',
      scheduleConfig: {
        type: 'cron',
        cronExpression: '*/15 * * * *',
        timezone: 'America/New_York',
        enabled: true,
      },
      actions: [
        {
          id: 'action-1',
          type: 'http_request',
          config: {
            url: 'https://api.example.com/health',
            method: 'GET',
          },
          order: 1,
        },
        {
          id: 'action-2',
          type: 'slack',
          config: {
            webhookUrl: 'https://hooks.slack.com/...',
            message: 'Health check completed: {{status}}',
          },
          order: 2,
        },
      ],
      settings: {
        retryOnFailure: true,
        maxRetries: 3,
      },
    },
    status: 'active',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  }

  botsStore.set(sampleBot.id, sampleBot)

  // Add sample executions
  const sampleExecution: Execution = {
    id: 'exec-1',
    botId: 'sample-bot-1',
    userId: 'sample-user-1',
    status: 'completed',
    triggerType: 'schedule',
    actionResults: [
      {
        actionId: 'action-1',
        type: 'http_request',
        success: true,
        result: { status: 200, body: { healthy: true } },
        startedAt: new Date(Date.now() - 60000).toISOString(),
        completedAt: new Date(Date.now() - 59500).toISOString(),
        duration: 500,
      },
    ],
    startedAt: new Date(Date.now() - 60000).toISOString(),
    completedAt: new Date(Date.now() - 59000).toISOString(),
    error: null,
    duration: 1000,
  }

  executionsStore.set(sampleExecution.id, sampleExecution)

  // Add sample logs
  logsStore.set('exec-1', [
    {
      id: 'log-1',
      executionId: 'exec-1',
      level: 'info',
      message: 'Bot execution started',
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'log-2',
      executionId: 'exec-1',
      level: 'info',
      message: 'Executing action: http_request',
      timestamp: new Date(Date.now() - 59800).toISOString(),
    },
    {
      id: 'log-3',
      executionId: 'exec-1',
      level: 'debug',
      message: 'HTTP request completed with status 200',
      timestamp: new Date(Date.now() - 59500).toISOString(),
      metadata: { url: 'https://api.example.com/health', status: 200 },
    },
    {
      id: 'log-4',
      executionId: 'exec-1',
      level: 'info',
      message: 'Bot execution completed successfully',
      timestamp: new Date(Date.now() - 59000).toISOString(),
    },
  ])
}

// Initialize sample data on module load (only in development)
if (process.env.NODE_ENV !== 'production') {
  initializeSampleData()
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// ============================================================================
// Bot CRUD Functions
// ============================================================================

/**
 * Get all bots for a user
 * TODO: Replace with Supabase query
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bots')
 *   .select('*')
 *   .eq('user_id', userId)
 *   .order('created_at', { ascending: false })
 * ```
 */
export async function getBots(userId: string): Promise<Bot[]> {
  const bots: Bot[] = []

  botsStore.forEach((bot) => {
    if (bot.userId === userId) {
      bots.push(bot)
    }
  })

  // Sort by createdAt descending
  return bots.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * Get a bot by ID
 * TODO: Replace with Supabase query
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bots')
 *   .select('*')
 *   .eq('id', botId)
 *   .single()
 * ```
 */
export async function getBotById(botId: string): Promise<Bot | null> {
  return botsStore.get(botId) || null
}

/**
 * Get a bot by ID with user ownership check
 */
export async function getBotByIdForUser(botId: string, userId: string): Promise<Bot | null> {
  const bot = botsStore.get(botId)
  if (!bot || bot.userId !== userId) {
    return null
  }
  return bot
}

/**
 * Create a new bot
 * TODO: Replace with Supabase insert
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bots')
 *   .insert({
 *     user_id: userId,
 *     name: config.name,
 *     description: config.description,
 *     config: config.config,
 *     status: config.status || 'active',
 *   })
 *   .select()
 *   .single()
 * ```
 */
export async function createBot(userId: string, input: CreateBotInput): Promise<Bot> {
  const now = new Date().toISOString()

  const bot: Bot = {
    id: generateId(),
    userId,
    name: input.name,
    description: input.description ?? null,
    config: input.config,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }

  botsStore.set(bot.id, bot)
  return bot
}

/**
 * Update a bot
 * TODO: Replace with Supabase update
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bots')
 *   .update({
 *     ...updates,
 *     updated_at: new Date().toISOString(),
 *   })
 *   .eq('id', botId)
 *   .eq('user_id', userId) // Ensure ownership
 *   .select()
 *   .single()
 * ```
 */
export async function updateBot(
  botId: string,
  userId: string,
  input: UpdateBotInput
): Promise<Bot | null> {
  const bot = botsStore.get(botId)

  if (!bot || bot.userId !== userId) {
    return null
  }

  const updatedBot: Bot = {
    ...bot,
    name: input.name ?? bot.name,
    description: input.description !== undefined ? input.description : bot.description,
    config: input.config ?? bot.config,
    status: input.status ?? bot.status,
    updatedAt: new Date().toISOString(),
  }

  botsStore.set(botId, updatedBot)
  return updatedBot
}

/**
 * Delete a bot
 * TODO: Replace with Supabase delete
 * ```typescript
 * const { error } = await supabase
 *   .from('bots')
 *   .delete()
 *   .eq('id', botId)
 *   .eq('user_id', userId) // Ensure ownership
 * ```
 */
export async function deleteBot(botId: string, userId: string): Promise<boolean> {
  const bot = botsStore.get(botId)

  if (!bot || bot.userId !== userId) {
    return false
  }

  botsStore.delete(botId)

  // Also delete associated executions and logs
  executionsStore.forEach((exec, execId) => {
    if (exec.botId === botId) {
      executionsStore.delete(execId)
      logsStore.delete(execId)
    }
  })

  return true
}

// ============================================================================
// Schedule Functions
// ============================================================================

/**
 * Get schedule for a bot
 */
export async function getBotSchedule(botId: string, userId: string): Promise<BotSchedule | null> {
  const bot = await getBotByIdForUser(botId, userId)
  if (!bot) {
    return null
  }

  // Return the new schedule config if available, otherwise construct from legacy
  if (bot.config.scheduleConfig) {
    return bot.config.scheduleConfig
  }

  // Legacy support: construct schedule from old format
  if (bot.config.schedule) {
    return {
      type: 'cron',
      cronExpression: bot.config.schedule,
      enabled: bot.status === 'active',
    }
  }

  return null
}

/**
 * Update bot schedule
 */
export async function updateBotSchedule(
  botId: string,
  userId: string,
  schedule: BotSchedule
): Promise<Bot | null> {
  const bot = botsStore.get(botId)

  if (!bot || bot.userId !== userId) {
    return null
  }

  const updatedConfig: BotConfig = {
    ...bot.config,
    type: 'schedule',
    schedule: schedule.cronExpression || bot.config.schedule,
    scheduleConfig: schedule,
  }

  return updateBot(botId, userId, { config: updatedConfig })
}

/**
 * Disable bot schedule
 */
export async function disableBotSchedule(botId: string, userId: string): Promise<Bot | null> {
  const bot = botsStore.get(botId)

  if (!bot || bot.userId !== userId) {
    return null
  }

  const schedule = bot.config.scheduleConfig || {
    type: 'cron' as ScheduleType,
    cronExpression: bot.config.schedule,
    enabled: false,
  }

  const updatedConfig: BotConfig = {
    ...bot.config,
    scheduleConfig: {
      ...schedule,
      enabled: false,
    },
  }

  return updateBot(botId, userId, { config: updatedConfig })
}

// ============================================================================
// Execution Functions
// ============================================================================

/**
 * Get executions with filtering and pagination
 * TODO: Replace with Supabase query with filters
 * ```typescript
 * let query = supabase
 *   .from('bot_runs')
 *   .select('*', { count: 'exact' })
 *
 * if (filters.botId) query = query.eq('bot_id', filters.botId)
 * if (filters.status) query = query.eq('status', filters.status)
 * if (filters.dateFrom) query = query.gte('started_at', filters.dateFrom)
 * if (filters.dateTo) query = query.lte('started_at', filters.dateTo)
 *
 * const { data, count, error } = await query
 *   .order('started_at', { ascending: false })
 *   .range(offset, offset + limit - 1)
 * ```
 */
export async function getExecutions(
  filters: ExecutionFilters = {},
  pagination: PaginationOptions = {}
): Promise<PaginatedResult<Execution>> {
  const { page = 1, limit = 20 } = pagination

  let executions: Execution[] = []

  executionsStore.forEach((exec) => {
    // Apply filters
    if (filters.botId && exec.botId !== filters.botId) return
    if (filters.userId && exec.userId !== filters.userId) return
    if (filters.status && exec.status !== filters.status) return
    if (filters.triggerType && exec.triggerType !== filters.triggerType) return

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      const execDate = new Date(exec.startedAt)
      if (execDate < fromDate) return
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      const execDate = new Date(exec.startedAt)
      if (execDate > toDate) return
    }

    executions.push(exec)
  })

  // Sort by startedAt descending
  executions.sort((a, b) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  // Calculate pagination
  const total = executions.length
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const paginatedData = executions.slice(offset, offset + limit)

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

/**
 * Get execution by ID
 * TODO: Replace with Supabase query
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bot_runs')
 *   .select('*')
 *   .eq('id', executionId)
 *   .single()
 * ```
 */
export async function getExecutionById(executionId: string): Promise<Execution | null> {
  return executionsStore.get(executionId) || null
}

/**
 * Get execution by ID with user ownership check
 */
export async function getExecutionByIdForUser(
  executionId: string,
  userId: string
): Promise<Execution | null> {
  const execution = executionsStore.get(executionId)
  if (!execution || execution.userId !== userId) {
    return null
  }
  return execution
}

/**
 * Create a new execution record
 * TODO: Replace with Supabase insert
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bot_runs')
 *   .insert({
 *     bot_id: botId,
 *     status: 'pending',
 *     started_at: new Date().toISOString(),
 *   })
 *   .select()
 *   .single()
 * ```
 */
export async function createExecution(
  botId: string,
  userId: string,
  triggerType: TriggerType,
  triggerData?: Record<string, unknown>
): Promise<Execution> {
  const execution: Execution = {
    id: generateId(),
    botId,
    userId,
    status: 'pending',
    triggerType,
    triggerData,
    actionResults: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    duration: null,
  }

  executionsStore.set(execution.id, execution)

  // Initialize empty logs array for this execution
  logsStore.set(execution.id, [])

  return execution
}

/**
 * Update execution status and result
 * TODO: Replace with Supabase update
 * ```typescript
 * const { data, error } = await supabase
 *   .from('bot_runs')
 *   .update({
 *     status,
 *     result,
 *     completed_at: status !== 'running' ? new Date().toISOString() : null,
 *     error: result?.error,
 *   })
 *   .eq('id', executionId)
 *   .select()
 *   .single()
 * ```
 */
export async function updateExecution(
  executionId: string,
  status: ExecutionStatus,
  result?: {
    actionResults?: ActionResult[]
    error?: string
  }
): Promise<Execution | null> {
  const execution = executionsStore.get(executionId)

  if (!execution) {
    return null
  }

  const now = new Date()
  const startedAt = new Date(execution.startedAt)
  const isComplete = ['completed', 'failed', 'cancelled'].includes(status)

  const updatedExecution: Execution = {
    ...execution,
    status,
    actionResults: result?.actionResults ?? execution.actionResults,
    error: result?.error ?? execution.error,
    completedAt: isComplete ? now.toISOString() : execution.completedAt,
    duration: isComplete ? now.getTime() - startedAt.getTime() : execution.duration,
  }

  executionsStore.set(executionId, updatedExecution)
  return updatedExecution
}

/**
 * Cancel a running execution
 */
export async function cancelExecution(
  executionId: string,
  userId: string
): Promise<Execution | null> {
  const execution = executionsStore.get(executionId)

  if (!execution || execution.userId !== userId) {
    return null
  }

  // Can only cancel pending or running executions
  if (!['pending', 'running'].includes(execution.status)) {
    return null
  }

  return updateExecution(executionId, 'cancelled', {
    error: 'Execution cancelled by user',
  })
}

// ============================================================================
// Execution Logs Functions
// ============================================================================

/**
 * Get logs for an execution
 * TODO: Replace with Supabase query
 * ```typescript
 * const { data, error } = await supabase
 *   .from('execution_logs')
 *   .select('*')
 *   .eq('execution_id', executionId)
 *   .order('timestamp', { ascending: true })
 * ```
 */
export async function getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
  return logsStore.get(executionId) || []
}

/**
 * Add a log entry for an execution
 * TODO: Replace with Supabase insert
 * ```typescript
 * const { data, error } = await supabase
 *   .from('execution_logs')
 *   .insert({
 *     execution_id: executionId,
 *     level,
 *     message,
 *     timestamp: new Date().toISOString(),
 *     metadata,
 *   })
 * ```
 */
export async function addExecutionLog(
  executionId: string,
  level: ExecutionLog['level'],
  message: string,
  metadata?: Record<string, unknown>
): Promise<ExecutionLog> {
  const log: ExecutionLog = {
    id: generateId(),
    executionId,
    level,
    message,
    timestamp: new Date().toISOString(),
    metadata,
  }

  const existingLogs = logsStore.get(executionId) || []
  logsStore.set(executionId, [...existingLogs, log])

  return log
}

// ============================================================================
// Helper Functions for API Routes
// ============================================================================

/**
 * Check if a user owns a bot
 */
export async function userOwnsBot(botId: string, userId: string): Promise<boolean> {
  const bot = await getBotById(botId)
  return bot !== null && bot.userId === userId
}

/**
 * Check if a user owns an execution (via the associated bot)
 */
export async function userOwnsExecution(executionId: string, userId: string): Promise<boolean> {
  const execution = await getExecutionById(executionId)
  if (!execution) return false

  return execution.userId === userId
}
