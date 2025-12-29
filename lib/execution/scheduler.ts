/**
 * Bot Execution Engine - Job Scheduler
 * Manages cron-based scheduling for bot executions
 */

import { CronParser } from "../scheduler";
import { BotExecutor, createBotExecutor } from "./engine";
import {
  BotConfig,
  ScheduleConfig,
  ScheduleType,
  ScheduledJob,
  QueuedJob,
  ExecutionResult,
  TriggerType,
} from "./types";

/**
 * Job execution callback
 */
export type JobExecutionCallback = (
  job: ScheduledJob,
  result: ExecutionResult
) => void | Promise<void>;

/**
 * Job error callback
 */
export type JobErrorCallback = (
  job: ScheduledJob,
  error: Error
) => void | Promise<void>;

/**
 * Scheduler options
 */
export interface SchedulerOptions {
  /** Check interval in milliseconds (default: 60000 / 1 minute) */
  checkIntervalMs?: number;
  /** Maximum concurrent job executions (default: 5) */
  maxConcurrent?: number;
  /** Whether to catch up missed jobs (default: false) */
  catchUpMissedJobs?: boolean;
  /** Maximum time to look back for missed jobs in ms (default: 3600000 / 1 hour) */
  maxCatchUpWindowMs?: number;
  /** Custom bot executor instance */
  executor?: BotExecutor;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  /** Total jobs registered */
  totalJobs: number;
  /** Active jobs */
  activeJobs: number;
  /** Jobs currently executing */
  executingJobs: number;
  /** Jobs in queue */
  queuedJobs: number;
  /** Total executions since start */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Scheduler uptime in milliseconds */
  uptimeMs: number;
  /** Last check time */
  lastCheckTime?: Date;
}

/**
 * BotScheduler manages cron-based job scheduling and execution.
 * Integrates with the existing CronParser for cron expression handling.
 */
export class BotScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private queue: Map<string, QueuedJob> = new Map();
  private bots: Map<string, BotConfig> = new Map();
  private executor: BotExecutor;

  private checkIntervalMs: number;
  private maxConcurrent: number;
  private catchUpMissedJobs: boolean;
  private maxCatchUpWindowMs: number;

  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private startedAt: Date | null = null;
  private lastCheckTime: Date | null = null;

  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
  };

  private currentlyExecuting: Set<string> = new Set();
  private onExecutionCallback: JobExecutionCallback | null = null;
  private onErrorCallback: JobErrorCallback | null = null;

  constructor(options: SchedulerOptions = {}) {
    this.checkIntervalMs = options.checkIntervalMs ?? 60000;
    this.maxConcurrent = options.maxConcurrent ?? 5;
    this.catchUpMissedJobs = options.catchUpMissedJobs ?? false;
    this.maxCatchUpWindowMs = options.maxCatchUpWindowMs ?? 3600000;
    this.executor = options.executor ?? createBotExecutor();
  }

  /**
   * Register a bot for scheduled execution
   */
  registerBot(bot: BotConfig): string {
    if (!bot.schedule) {
      throw new Error("Bot must have a schedule configuration");
    }

    this.bots.set(bot.id, bot);

    const job = this.createJob(bot);
    this.jobs.set(job.id, job);

    console.log(
      `Registered scheduled job: ${job.botName} (${job.id}), next run: ${job.nextRunAt.toISOString()}`
    );

    return job.id;
  }

  /**
   * Create a scheduled job from bot config
   */
  private createJob(bot: BotConfig): ScheduledJob {
    const schedule = bot.schedule!;
    const jobId = this.generateJobId(bot.id);

    let nextRunAt: Date;

    if (schedule.type === ScheduleType.ONE_TIME && schedule.runAt) {
      nextRunAt = new Date(schedule.runAt);
    } else if (schedule.cronExpression) {
      nextRunAt = CronParser.getNextRun(schedule.cronExpression);
    } else {
      throw new Error("Schedule must have either runAt or cronExpression");
    }

    return {
      id: jobId,
      botId: bot.id,
      botName: bot.name,
      schedule,
      nextRunAt,
      active: schedule.enabled,
    };
  }

  /**
   * Unregister a bot from scheduling
   */
  unregisterBot(botId: string): boolean {
    // Find and remove the job
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.botId === botId) {
        this.jobs.delete(jobId);
        this.bots.delete(botId);

        // Remove any queued jobs
        for (const [queueId, queuedJob] of this.queue.entries()) {
          if (queuedJob.botId === botId) {
            this.queue.delete(queueId);
          }
        }

        console.log(`Unregistered scheduled job for bot: ${botId}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Update a job's schedule
   */
  updateSchedule(botId: string, schedule: ScheduleConfig): boolean {
    const bot = this.bots.get(botId);
    if (!bot) return false;

    bot.schedule = schedule;

    // Update the job
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.botId === botId) {
        job.schedule = schedule;
        job.active = schedule.enabled;

        // Recalculate next run
        if (schedule.type === ScheduleType.ONE_TIME && schedule.runAt) {
          job.nextRunAt = new Date(schedule.runAt);
        } else if (schedule.cronExpression) {
          job.nextRunAt = CronParser.getNextRun(schedule.cronExpression);
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Enable or disable a job
   */
  setJobActive(botId: string, active: boolean): boolean {
    for (const job of this.jobs.values()) {
      if (job.botId === botId) {
        job.active = active;
        return true;
      }
    }
    return false;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.warn("Scheduler is already running");
      return;
    }

    this.isRunning = true;
    this.startedAt = new Date();

    console.log(`Scheduler started with ${this.jobs.size} registered jobs`);

    // Run initial check
    this.checkJobs();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkJobs();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("Scheduler stopped");
  }

  /**
   * Check for jobs that need to run
   */
  private async checkJobs(): Promise<void> {
    const now = new Date();
    this.lastCheckTime = now;

    // Find jobs due to run
    const dueJobs: ScheduledJob[] = [];

    for (const job of this.jobs.values()) {
      if (!job.active) continue;

      // Check if job is due
      if (job.nextRunAt <= now) {
        // Check max executions
        const schedule = job.schedule;
        if (
          schedule.maxExecutions !== null &&
          schedule.executionCount !== undefined &&
          schedule.executionCount >= (schedule.maxExecutions ?? Infinity)
        ) {
          job.active = false;
          continue;
        }

        dueJobs.push(job);
      }
    }

    // Queue due jobs
    for (const job of dueJobs) {
      await this.queueJob(job);
    }

    // Process queue
    await this.processQueue();
  }

  /**
   * Add a job to the execution queue
   */
  private async queueJob(job: ScheduledJob): Promise<void> {
    const queueId = this.generateQueueId();

    const queuedJob: QueuedJob = {
      queueId,
      jobId: job.id,
      botId: job.botId,
      scheduledFor: job.nextRunAt,
      queuedAt: new Date(),
      priority: job.priority ?? 0,
      attempts: 0,
      maxAttempts: 3,
      status: "queued",
    };

    this.queue.set(queueId, queuedJob);

    // Update job's next run time
    this.updateNextRun(job);

    console.log(`Queued job ${job.botName} (queue: ${queueId})`);
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    // Get queued jobs sorted by priority and scheduled time
    const queuedJobs = Array.from(this.queue.values())
      .filter((j) => j.status === "queued")
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.scheduledFor.getTime() - b.scheduledFor.getTime();
      });

    // Process up to maxConcurrent jobs
    const available = this.maxConcurrent - this.currentlyExecuting.size;
    const toProcess = queuedJobs.slice(0, available);

    for (const queuedJob of toProcess) {
      this.executeQueuedJob(queuedJob);
    }
  }

  /**
   * Execute a queued job
   */
  private async executeQueuedJob(queuedJob: QueuedJob): Promise<void> {
    const job = this.jobs.get(queuedJob.jobId);
    const bot = this.bots.get(queuedJob.botId);

    if (!job || !bot) {
      this.queue.delete(queuedJob.queueId);
      return;
    }

    queuedJob.status = "processing";
    queuedJob.attempts++;
    this.currentlyExecuting.add(queuedJob.queueId);

    try {
      console.log(`Executing scheduled job: ${job.botName}`);

      const result = await this.executor.execute(
        bot,
        TriggerType.SCHEDULE,
        { scheduledFor: queuedJob.scheduledFor.toISOString() }
      );

      // Update stats
      this.stats.totalExecutions++;
      if (result.status === "completed") {
        this.stats.successfulExecutions++;
        job.lastRunResult = "success";
      } else {
        this.stats.failedExecutions++;
        job.lastRunResult = "failure";
      }

      job.lastRunAt = new Date();

      // Update schedule execution count
      if (job.schedule.executionCount !== undefined) {
        job.schedule.executionCount++;
      } else {
        job.schedule.executionCount = 1;
      }

      // Remove from queue
      queuedJob.status = "completed";
      this.queue.delete(queuedJob.queueId);

      // Call callback
      if (this.onExecutionCallback) {
        try {
          await this.onExecutionCallback(job, result);
        } catch (error) {
          console.error("Error in execution callback:", error);
        }
      }

    } catch (error) {
      queuedJob.lastError = error instanceof Error ? error.message : String(error);

      // Retry or fail
      if (queuedJob.attempts >= queuedJob.maxAttempts) {
        queuedJob.status = "failed";
        this.queue.delete(queuedJob.queueId);
        this.stats.failedExecutions++;
        job.lastRunResult = "failure";
      } else {
        queuedJob.status = "queued"; // Retry
      }

      // Call error callback
      if (this.onErrorCallback) {
        try {
          await this.onErrorCallback(job, error instanceof Error ? error : new Error(String(error)));
        } catch (callbackError) {
          console.error("Error in error callback:", callbackError);
        }
      }

    } finally {
      this.currentlyExecuting.delete(queuedJob.queueId);
    }
  }

  /**
   * Update a job's next run time
   */
  private updateNextRun(job: ScheduledJob): void {
    const schedule = job.schedule;

    if (schedule.type === ScheduleType.ONE_TIME) {
      // One-time jobs don't recur, deactivate after running
      job.active = false;
      return;
    }

    if (schedule.cronExpression) {
      try {
        job.nextRunAt = CronParser.getNextRun(schedule.cronExpression);
      } catch (error) {
        console.error(`Failed to calculate next run for job ${job.id}:`, error);
        job.active = false;
      }
    }
  }

  /**
   * Manually trigger a job execution
   */
  async triggerJob(botId: string): Promise<ExecutionResult | null> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot not found: ${botId}`);
    }

    return this.executor.execute(bot, TriggerType.MANUAL);
  }

  /**
   * Get upcoming scheduled runs
   */
  getUpcomingRuns(count: number = 10): Array<{
    jobId: string;
    botId: string;
    botName: string;
    nextRunAt: Date;
    cronDescription?: string;
  }> {
    const upcoming: Array<{
      jobId: string;
      botId: string;
      botName: string;
      nextRunAt: Date;
      cronDescription?: string;
    }> = [];

    for (const job of this.jobs.values()) {
      if (!job.active) continue;

      let cronDescription: string | undefined;
      if (job.schedule.cronExpression) {
        cronDescription = CronParser.describe(job.schedule.cronExpression);
      }

      upcoming.push({
        jobId: job.id,
        botId: job.botId,
        botName: job.botName,
        nextRunAt: job.nextRunAt,
        cronDescription,
      });
    }

    return upcoming
      .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime())
      .slice(0, count);
  }

  /**
   * Get upcoming runs for a specific bot
   */
  getBotUpcomingRuns(botId: string, count: number = 5): Date[] {
    const job = Array.from(this.jobs.values()).find((j) => j.botId === botId);
    if (!job || !job.schedule.cronExpression) {
      return [];
    }

    const upcoming: Date[] = [];
    let from = new Date();

    for (let i = 0; i < count; i++) {
      try {
        const next = CronParser.getNextRun(job.schedule.cronExpression, from);
        upcoming.push(next);
        from = new Date(next.getTime() + 60000);
      } catch {
        break;
      }
    }

    return upcoming;
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    return {
      totalJobs: this.jobs.size,
      activeJobs: Array.from(this.jobs.values()).filter((j) => j.active).length,
      executingJobs: this.currentlyExecuting.size,
      queuedJobs: Array.from(this.queue.values()).filter((j) => j.status === "queued").length,
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      lastCheckTime: this.lastCheckTime ?? undefined,
    };
  }

  /**
   * Get all registered jobs
   */
  getJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a specific job
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get job by bot ID
   */
  getJobByBotId(botId: string): ScheduledJob | undefined {
    return Array.from(this.jobs.values()).find((j) => j.botId === botId);
  }

  /**
   * Set execution callback
   */
  onExecution(callback: JobExecutionCallback): void {
    this.onExecutionCallback = callback;
  }

  /**
   * Set error callback
   */
  onError(callback: JobErrorCallback): void {
    this.onErrorCallback = callback;
  }

  /**
   * Validate a cron expression
   */
  validateCron(expression: string): { valid: boolean; error?: string; description?: string } {
    const validation = CronParser.validate(expression);
    return {
      valid: validation.valid,
      error: validation.error,
      description: validation.valid ? CronParser.describe(expression) : undefined,
    };
  }

  /**
   * Calculate next run time for a cron expression
   */
  getNextRunTime(cronExpression: string, from?: Date): Date {
    return CronParser.getNextRun(cronExpression, from);
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(botId: string): string {
    return `job_${botId}_${Date.now()}`;
  }

  /**
   * Generate a unique queue ID
   */
  private generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Create a new BotScheduler instance
 */
export function createBotScheduler(options?: SchedulerOptions): BotScheduler {
  return new BotScheduler(options);
}

/**
 * Default global scheduler instance
 */
export const botScheduler = new BotScheduler();
