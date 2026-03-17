/**
 * RAG Service
 * Handles document ingestion, retrieval, and system prompt building for RAG system
 */

import { getDb } from "../db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  documentationSources,
  documentationChunks,
  platformKeywords,
  type DocumentationSource,
  type DocumentationChunk,
} from "../../drizzle/schema-rag";
import { generateEmbedding, generateEmbeddings, chunkText } from "../rag/embeddings";
import crypto from "crypto";
import { serviceLoggers } from "../lib/logger";

const logger = serviceLoggers.rag;

/** Knowledge chunk category types for tagging */
export type KnowledgeCategory = "sop" | "process" | "policy" | "reference" | "training" | "general";

export interface IngestDocumentInput {
  platform: string;
  category: string;
  title: string;
  content: string;
  sourceUrl?: string;
  sourceType?: "markdown" | "html" | "pdf" | "docx";
  version?: string;
  userId: number;
  chunkingOptions?: {
    maxTokens?: number;
    overlapTokens?: number;
  };
}

export interface IngestResult {
  sourceId: number;
  chunkCount: number;
  totalTokens: number;
}

export interface DocumentChunk {
  id: number;
  sourceId: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  similarity?: number;
  metadata?: Record<string, any>;
}

export interface RetrieveOptions {
  topK?: number;
  platforms?: string[];
  categories?: string[];
  minSimilarity?: number;
}

export interface SystemPromptResult {
  systemPrompt: string;
  retrievedChunks: DocumentChunk[];
  detectedPlatforms: string[];
}

export interface BuildSystemPromptOptions {
  platform?: string;
  customTemplate?: string;
  maxDocumentationTokens?: number;
  includeExamples?: boolean;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate content hash for deduplication
 */
function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Chunk document with custom options
 */
function chunkDocument(
  content: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  return chunkText(content, chunkSize, overlap);
}

class RAGService {
  /**
   * Ingest a document into the RAG system
   */
  async ingest(input: IngestDocumentInput): Promise<IngestResult> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      // Generate content hash for deduplication
      const contentHash = generateContentHash(input.content);

      // Check for existing document with same hash
      const existing = await db
        .select()
        .from(documentationSources)
        .where(
          and(
            eq(documentationSources.contentHash, contentHash),
            eq(documentationSources.platform, input.platform)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        logger.info({ contentHash, sourceId: existing[0].id }, 'Document already exists');
        return {
          sourceId: existing[0].id,
          chunkCount: 0,
          totalTokens: 0,
        };
      }

      // Create documentation source
      const [source] = await db
        .insert(documentationSources)
        .values({
          userId: input.userId,
          platform: input.platform,
          category: input.category,
          title: input.title,
          content: input.content,
          contentHash: contentHash,
          sourceUrl: input.sourceUrl,
          sourceType: input.sourceType || "markdown",
          version: input.version,
          isActive: true,
          metadata: {},
          tags: [],
        })
        .returning();

      logger.info({ sourceId: source.id, platform: input.platform, title: input.title }, 'Created documentation source');

      // Chunk the content
      const chunkSize = input.chunkingOptions?.maxTokens || 1000;
      const overlap = input.chunkingOptions?.overlapTokens || 200;
      const chunks = chunkDocument(input.content, chunkSize, overlap);

      logger.info({ chunkCount: chunks.length, sourceId: source.id }, 'Generated chunks');

      // Generate embeddings for all chunks in batch
      const embeddings = await generateEmbeddings(chunks);

      // Insert chunks with embeddings
      const chunkValues = chunks.map((chunk, index) => ({
        sourceId: source.id,
        chunkIndex: index,
        content: chunk,
        tokenCount: estimateTokens(chunk),
        metadata: {
          platform: input.platform,
          category: input.category,
          title: input.title,
          chunkSize: chunk.length,
        },
      }));

      await db.insert(documentationChunks).values(chunkValues);

      // Update embeddings separately (since they're not in the initial insert)
      for (let i = 0; i < chunks.length; i++) {
        const embeddingVector = `[${embeddings[i].join(",")}]`;
        await db.execute(sql`
          UPDATE documentation_chunks
          SET embedding = ${embeddingVector}::vector
          WHERE source_id = ${source.id} AND chunk_index = ${i}
        `);
      }

      const totalTokens = chunkValues.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

      logger.info({
        sourceId: source.id,
        chunkCount: chunks.length,
        totalTokens,
        platform: input.platform
      }, 'Document ingestion completed');

      return {
        sourceId: source.id,
        chunkCount: chunks.length,
        totalTokens: totalTokens,
      };
    } catch (error) {
      logger.error({ error, platform: input.platform }, 'Document ingest failed');
      throw error;
    }
  }

  /**
   * Ingest a URL by fetching and processing its content
   */
  async ingestUrl(url: string, userId: number, metadata?: {
    platform?: string;
    category?: string;
    title?: string;
  }): Promise<IngestResult> {
    try {
      logger.info({ url }, 'Fetching URL for ingestion');

      // Fetch the URL content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let content = "";
      let sourceType: "markdown" | "html" | "pdf" | "docx" = "html";

      // Parse content based on type
      if (contentType.includes("text/html")) {
        const html = await response.text();
        // Basic HTML to text conversion (strip tags)
        content = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        sourceType = "html";
      } else if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
        content = await response.text();
        sourceType = "markdown";
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      // Extract title from URL or metadata
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace("www.", "");
      const title = metadata?.title || urlObj.pathname.split("/").pop() || domain;

      // Auto-detect platform from domain
      let platform = metadata?.platform || "general";
      if (domain.includes("gohighlevel")) platform = "gohighlevel";
      else if (domain.includes("wordpress")) platform = "wordpress";
      else if (domain.includes("cloudflare")) platform = "cloudflare";
      else if (domain.includes("stripe")) platform = "stripe";

      // Ingest the content
      return await this.ingest({
        platform: platform,
        category: metadata?.category || "documentation",
        title: title,
        content: content,
        sourceUrl: url,
        sourceType: sourceType,
        userId: userId,
      });
    } catch (error) {
      logger.error({ error, url }, 'URL ingestion failed');
      throw error;
    }
  }

  /**
   * List all documentation sources
   */
  async listSources(filters?: {
    platform?: string;
    category?: string;
    userId?: number;
  }): Promise<DocumentationSource[]> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const conditions = [];
      if (filters?.platform) {
        conditions.push(eq(documentationSources.platform, filters.platform));
      }
      if (filters?.category) {
        conditions.push(eq(documentationSources.category, filters.category));
      }
      if (filters?.userId) {
        conditions.push(eq(documentationSources.userId, filters.userId));
      }

      const query = conditions.length > 0
        ? db.select().from(documentationSources).where(and(...conditions))
        : db.select().from(documentationSources);

      const sources = await query.orderBy(desc(documentationSources.createdAt));

      return sources;
    } catch (error) {
      logger.error({ error, filters }, 'List sources failed');
      throw error;
    }
  }

  /**
   * Retrieve relevant documentation chunks for a query
   */
  async retrieve(query: string, options: RetrieveOptions = {}): Promise<DocumentChunk[]> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const topK = options.topK || 5;
      const minSimilarity = options.minSimilarity || 0.5;

      // Generate embedding for query
      const queryEmbedding = await generateEmbedding(query);
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;

      // Build SQL query with filters
      let sqlQuery = sql`
        SELECT
          c.id,
          c.source_id as "sourceId",
          c.chunk_index as "chunkIndex",
          c.content,
          c.token_count as "tokenCount",
          c.metadata,
          1 - (c.embedding <=> ${sql.raw(vectorLiteral)}::vector) as similarity
        FROM documentation_chunks c
        INNER JOIN documentation_sources s ON c.source_id = s.id
        WHERE c.embedding IS NOT NULL
          AND s.is_active = true
      `;

      // Add platform filter
      if (options.platforms && options.platforms.length > 0) {
        sqlQuery = sql`${sqlQuery} AND s.platform IN ${sql.join(options.platforms.map(p => sql`${p}`), sql`, `)}`;
      }

      // Add category filter
      if (options.categories && options.categories.length > 0) {
        sqlQuery = sql`${sqlQuery} AND s.category IN ${sql.join(options.categories.map(c => sql`${c}`), sql`, `)}`;
      }

      // Add similarity threshold and ordering
      sqlQuery = sql`
        ${sqlQuery}
        AND 1 - (c.embedding <=> ${sql.raw(vectorLiteral)}::vector) >= ${minSimilarity}
        ORDER BY c.embedding <=> ${sql.raw(vectorLiteral)}::vector
        LIMIT ${topK}
      `;

      const results = await db.execute(sqlQuery);

      return results.rows as unknown as DocumentChunk[];
    } catch (error) {
      logger.error({ error, query }, 'Retrieve failed');
      throw error;
    }
  }

  /**
   * Build context from relevant chunks
   */
  async buildContext(query: string, options: RetrieveOptions = {}): Promise<string> {
    const chunks = await this.retrieve(query, options);

    if (chunks.length === 0) {
      return "";
    }

    const context = chunks
      .map((chunk, index) => {
        const similarity = ((chunk.similarity || 0) * 100).toFixed(1);
        return `[Document ${index + 1}] (Relevance: ${similarity}%)\n${chunk.content}`;
      })
      .join("\n\n---\n\n");

    return context;
  }

  /**
   * Get relevant documentation for a query
   */
  async getRelevantDocs(
    query: string,
    options: RetrieveOptions = {}
  ): Promise<DocumentChunk[]> {
    return await this.retrieve(query, options);
  }

  /**
   * Build a system prompt with RAG context
   */
  async buildSystemPrompt(
    userPrompt: string,
    options: BuildSystemPromptOptions = {}
  ): Promise<SystemPromptResult> {
    try {
      // Detect platforms if not specified
      let platforms: string[] = [];
      if (options.platform) {
        platforms = [options.platform];
      } else {
        platforms = await this.detectPlatforms(userPrompt);
      }

      // Retrieve relevant documentation
      const maxTokens = options.maxDocumentationTokens || 4000;
      const chunks = await this.retrieve(userPrompt, {
        topK: 10,
        platforms: platforms.length > 0 ? platforms : undefined,
        minSimilarity: 0.6,
      });

      // Build context from chunks, respecting token limit
      let context = "";
      let tokenCount = 0;
      const relevantChunks: DocumentChunk[] = [];

      for (const chunk of chunks) {
        if (tokenCount + chunk.tokenCount > maxTokens) {
          break;
        }
        relevantChunks.push(chunk);
        tokenCount += chunk.tokenCount;
      }

      if (relevantChunks.length > 0) {
        context = relevantChunks
          .map((chunk, index) => {
            const similarity = ((chunk.similarity || 0) * 100).toFixed(1);
            return `### Reference Document ${index + 1} (Relevance: ${similarity}%)\n${chunk.content}`;
          })
          .join("\n\n");
      }

      // Build system prompt with template
      const template = options.customTemplate || this.getDefaultTemplate();
      const systemPrompt = template
        .replace("{context}", context || "No relevant documentation found.")
        .replace("{platforms}", platforms.join(", ") || "general")
        .replace("{user_prompt}", userPrompt);

      return {
        systemPrompt,
        retrievedChunks: relevantChunks,
        detectedPlatforms: platforms,
      };
    } catch (error) {
      logger.error({ error, userPrompt }, 'Build system prompt failed');
      // Fallback to basic prompt without RAG
      return {
        systemPrompt: userPrompt,
        retrievedChunks: [],
        detectedPlatforms: [],
      };
    }
  }

  /**
   * Detect platforms from user prompt using keyword matching
   */
  private async detectPlatforms(prompt: string): Promise<string[]> {
    const db = await getDb();
    if (!db) return [];

    try {
      const keywords = await db.select().from(platformKeywords).where(
        eq(platformKeywords.isActive, true)
      );

      const promptLower = prompt.toLowerCase();
      const platformScores = new Map<string, number>();

      for (const keyword of keywords) {
        if (promptLower.includes(keyword.keyword.toLowerCase())) {
          const currentScore = platformScores.get(keyword.platform) || 0;
          platformScores.set(keyword.platform, currentScore + (keyword.weight || 1));
        }
      }

      // Return platforms sorted by score
      const platforms = Array.from(platformScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([platform]) => platform);

      return platforms;
    } catch (error) {
      logger.error({ error, prompt }, 'Platform detection failed');
      return [];
    }
  }

  /**
   * Detect the knowledge category of a document based on content analysis
   */
  detectKnowledgeCategory(content: string, declaredCategory?: string): KnowledgeCategory {
    const lower = content.toLowerCase();

    // If category is explicitly declared as SOP, trust it
    if (declaredCategory === "sop") return "sop";
    if (declaredCategory === "policy") return "policy";
    if (declaredCategory === "process") return "process";

    // SOP detection: ordered steps, numbered lists, procedure keywords
    const sopIndicators = [
      /\bstandard operating procedure\b/i,
      /\bsop\b/i,
      /\bstep\s*\d+/i,
      /\bprocedure\b/i,
      /\bwork instruction\b/i,
      /^\s*\d+\.\s+/m,  // numbered steps
    ];
    const sopScore = sopIndicators.filter(r => r.test(content)).length;
    if (sopScore >= 2) return "sop";

    // Process detection
    const processIndicators = [
      /\bworkflow\b/i,
      /\bprocess\b/i,
      /\bthen\b.*\bnext\b/i,
      /\bsequence\b/i,
    ];
    const processScore = processIndicators.filter(r => r.test(content)).length;
    if (processScore >= 2) return "process";

    // Policy detection
    const policyIndicators = [
      /\bpolicy\b/i,
      /\bguideline\b/i,
      /\bcompliance\b/i,
      /\brequirement\b/i,
      /\bmust\b/i,
      /\bshall\b/i,
    ];
    const policyScore = policyIndicators.filter(r => r.test(content)).length;
    if (policyScore >= 3) return "policy";

    // Reference detection
    if (lower.includes("reference") || lower.includes("documentation") || lower.includes("api")) {
      return "reference";
    }

    return "general";
  }

  /**
   * Extract step sequences from SOP-like documents
   * Returns structured steps for better agent retrieval
   */
  extractSOPSteps(content: string): { stepNumber: number; instruction: string; details?: string }[] {
    const steps: { stepNumber: number; instruction: string; details?: string }[] = [];

    // Pattern 1: "Step N: ..." or "Step N. ..."
    const stepPattern = /(?:step\s*(\d+))[.:]\s*(.+?)(?=(?:step\s*\d+[.:]|\n\n|$))/gis;
    let match;
    while ((match = stepPattern.exec(content)) !== null) {
      steps.push({
        stepNumber: parseInt(match[1]),
        instruction: match[2].trim().split("\n")[0].trim(),
        details: match[2].trim().split("\n").slice(1).join("\n").trim() || undefined,
      });
    }

    // Pattern 2: Numbered list "1. ...", "2. ..."
    if (steps.length === 0) {
      const numberedPattern = /^(\d+)\.\s+(.+)/gm;
      while ((match = numberedPattern.exec(content)) !== null) {
        steps.push({
          stepNumber: parseInt(match[1]),
          instruction: match[2].trim(),
        });
      }
    }

    return steps;
  }

  /**
   * Calculate priority score for a chunk based on content signals
   * Higher scores = more important for agent retrieval
   */
  calculateChunkPriority(content: string, category: KnowledgeCategory): number {
    let priority = 50; // Base priority

    // Category-based boosts
    if (category === "sop") priority += 20;
    if (category === "process") priority += 15;
    if (category === "policy") priority += 10;

    // Content signal boosts
    const lower = content.toLowerCase();
    if (lower.includes("important") || lower.includes("critical")) priority += 10;
    if (lower.includes("must") || lower.includes("required")) priority += 5;
    if (lower.includes("step")) priority += 5;
    if (lower.includes("warning") || lower.includes("caution")) priority += 5;
    if (lower.includes("example")) priority += 3;

    return Math.min(priority, 100);
  }

  /**
   * Ingest a document with SOP-aware processing
   * Enhances chunks with category tags, priority scores, and SOP step extraction
   */
  async ingestWithSOPProcessing(input: IngestDocumentInput): Promise<IngestResult & { knowledgeCategory: KnowledgeCategory; sopSteps: number }> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Detect knowledge category
    const knowledgeCategory = this.detectKnowledgeCategory(input.content, input.category);
    logger.info({ knowledgeCategory, title: input.title }, 'Detected knowledge category');

    // Extract SOP steps if applicable
    const sopSteps = knowledgeCategory === "sop" ? this.extractSOPSteps(input.content) : [];
    logger.info({ sopStepCount: sopSteps.length, title: input.title }, 'Extracted SOP steps');

    // Generate content hash for dedup
    const contentHash = generateContentHash(input.content);

    // Check for existing document with same hash
    const existing = await db
      .select()
      .from(documentationSources)
      .where(
        and(
          eq(documentationSources.contentHash, contentHash),
          eq(documentationSources.platform, input.platform)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      logger.info({ contentHash, sourceId: existing[0].id }, 'Document already exists');
      return {
        sourceId: existing[0].id,
        chunkCount: 0,
        totalTokens: 0,
        knowledgeCategory,
        sopSteps: sopSteps.length,
      };
    }

    // Create documentation source with enhanced metadata
    const [source] = await db
      .insert(documentationSources)
      .values({
        userId: input.userId,
        platform: input.platform,
        category: input.category,
        title: input.title,
        content: input.content,
        contentHash,
        sourceUrl: input.sourceUrl,
        sourceType: input.sourceType || "markdown",
        version: input.version,
        isActive: true,
        metadata: {
          knowledgeCategory,
          sopStepCount: sopSteps.length,
          sopSteps: sopSteps.length > 0 ? sopSteps : undefined,
          processedAt: new Date().toISOString(),
        },
        tags: [knowledgeCategory, input.category, input.platform].filter(Boolean),
      })
      .returning();

    // Chunk the content
    const chunkSize = input.chunkingOptions?.maxTokens || 1000;
    const overlap = input.chunkingOptions?.overlapTokens || 200;
    const chunks = chunkDocument(input.content, chunkSize, overlap);

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks);

    // Insert chunks with category tags and priority
    const chunkValues = chunks.map((chunk, index) => {
      const chunkCategory = this.detectKnowledgeCategory(chunk, input.category);
      const priority = this.calculateChunkPriority(chunk, chunkCategory);
      return {
        sourceId: source.id,
        chunkIndex: index,
        content: chunk,
        tokenCount: estimateTokens(chunk),
        metadata: {
          platform: input.platform,
          category: input.category,
          knowledgeCategory: chunkCategory,
          priority,
          title: input.title,
          chunkSize: chunk.length,
        },
      };
    });

    await db.insert(documentationChunks).values(chunkValues);

    // Update embeddings
    for (let i = 0; i < chunks.length; i++) {
      const embeddingVector = `[${embeddings[i].join(",")}]`;
      await db.execute(sql`
        UPDATE documentation_chunks
        SET embedding = ${embeddingVector}::vector
        WHERE source_id = ${source.id} AND chunk_index = ${i}
      `);
    }

    const totalTokens = chunkValues.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    logger.info({
      sourceId: source.id,
      chunkCount: chunks.length,
      totalTokens,
      knowledgeCategory,
      sopSteps: sopSteps.length,
    }, 'SOP-aware document ingestion completed');

    return {
      sourceId: source.id,
      chunkCount: chunks.length,
      totalTokens,
      knowledgeCategory,
      sopSteps: sopSteps.length,
    };
  }

  /**
   * Reprocess an existing document (re-chunk, re-embed, re-tag)
   */
  async reprocessSource(sourceId: number): Promise<IngestResult & { knowledgeCategory: KnowledgeCategory }> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const [source] = await db
      .select()
      .from(documentationSources)
      .where(eq(documentationSources.id, sourceId))
      .limit(1);

    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    // Delete existing chunks
    await db.delete(documentationChunks).where(eq(documentationChunks.sourceId, sourceId));

    // Detect category
    const knowledgeCategory = this.detectKnowledgeCategory(source.content, source.category);
    const sopSteps = knowledgeCategory === "sop" ? this.extractSOPSteps(source.content) : [];

    // Update source metadata
    await db.update(documentationSources).set({
      metadata: {
        ...(source.metadata as Record<string, unknown> || {}),
        knowledgeCategory,
        sopStepCount: sopSteps.length,
        sopSteps: sopSteps.length > 0 ? sopSteps : undefined,
        reprocessedAt: new Date().toISOString(),
      },
      tags: [knowledgeCategory, source.category, source.platform].filter(Boolean),
      updatedAt: new Date(),
    }).where(eq(documentationSources.id, sourceId));

    // Re-chunk
    const chunks = chunkDocument(source.content);
    const embeddings = await generateEmbeddings(chunks);

    const chunkValues = chunks.map((chunk, index) => {
      const chunkCat = this.detectKnowledgeCategory(chunk, source.category);
      return {
        sourceId,
        chunkIndex: index,
        content: chunk,
        tokenCount: estimateTokens(chunk),
        metadata: {
          platform: source.platform,
          category: source.category,
          knowledgeCategory: chunkCat,
          priority: this.calculateChunkPriority(chunk, chunkCat),
          title: source.title,
          chunkSize: chunk.length,
        },
      };
    });

    await db.insert(documentationChunks).values(chunkValues);

    for (let i = 0; i < chunks.length; i++) {
      const embeddingVector = `[${embeddings[i].join(",")}]`;
      await db.execute(sql`
        UPDATE documentation_chunks
        SET embedding = ${embeddingVector}::vector
        WHERE source_id = ${sourceId} AND chunk_index = ${i}
      `);
    }

    const totalTokens = chunkValues.reduce((sum, c) => sum + c.tokenCount, 0);

    logger.info({ sourceId, chunkCount: chunks.length, knowledgeCategory }, 'Source reprocessed');

    return {
      sourceId,
      chunkCount: chunks.length,
      totalTokens,
      knowledgeCategory,
    };
  }

  /**
   * Retrieve with priority-weighted ranking
   * SOP and process chunks get boosted when priority-aware retrieval is enabled
   */
  async retrieveWithPriority(query: string, options: RetrieveOptions & { priorityBoost?: boolean } = {}): Promise<DocumentChunk[]> {
    const chunks = await this.retrieve(query, options);

    if (!options.priorityBoost) {
      return chunks;
    }

    // Apply priority-weighted re-ranking
    return chunks.map(chunk => {
      const meta = chunk.metadata as Record<string, any> || {};
      const priority = (meta.priority || 50) / 100;
      const similarity = chunk.similarity || 0;
      // Blend: 70% similarity + 30% priority
      const boostedScore = similarity * 0.7 + priority * 0.3;
      return { ...chunk, similarity: boostedScore };
    }).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }

  /**
   * Get default system prompt template
   */
  private getDefaultTemplate(): string {
    return `You are an AI assistant with access to relevant documentation.

**Detected Platforms:** {platforms}

**User Question:**
{user_prompt}

**Relevant Documentation:**
{context}

**Instructions:**
- Use the provided documentation to answer the user's question accurately.
- If the documentation doesn't contain relevant information, say so.
- Cite specific sections when referencing the documentation.
- Be concise but thorough in your response.`;
  }

  /**
   * Delete a documentation source and its chunks
   */
  async deleteSource(sourceId: number): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      // Delete chunks (cascade will handle this, but explicit for clarity)
      await db
        .delete(documentationChunks)
        .where(eq(documentationChunks.sourceId, sourceId));

      // Delete source
      await db
        .delete(documentationSources)
        .where(eq(documentationSources.id, sourceId));

      logger.info({ sourceId }, 'Deleted documentation source');
    } catch (error) {
      logger.error({ error, sourceId }, 'Delete source failed');
      throw error;
    }
  }

  /**
   * Update a documentation source
   */
  async updateSource(
    sourceId: number,
    updates: {
      title?: string;
      content?: string;
      sourceUrl?: string;
      version?: string;
      isActive?: boolean;
    }
  ): Promise<void> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      // If content is being updated, we need to re-chunk and re-embed
      if (updates.content) {
        // Get the existing source
        const [source] = await db
          .select()
          .from(documentationSources)
          .where(eq(documentationSources.id, sourceId))
          .limit(1);

        if (!source) {
          throw new Error(`Source ${sourceId} not found`);
        }

        // Delete existing chunks
        await db
          .delete(documentationChunks)
          .where(eq(documentationChunks.sourceId, sourceId));

        // Update source
        const newContentHash = generateContentHash(updates.content);
        await db
          .update(documentationSources)
          .set({
            ...updates,
            contentHash: newContentHash,
            updatedAt: new Date(),
          })
          .where(eq(documentationSources.id, sourceId));

        // Re-chunk and re-embed
        const chunks = chunkDocument(updates.content);
        const embeddings = await generateEmbeddings(chunks);

        const chunkValues = chunks.map((chunk, index) => ({
          sourceId: sourceId,
          chunkIndex: index,
          content: chunk,
          tokenCount: estimateTokens(chunk),
          metadata: {
            platform: source.platform,
            category: source.category,
            title: updates.title || source.title,
            chunkSize: chunk.length,
          },
        }));

        await db.insert(documentationChunks).values(chunkValues);

        // Update embeddings
        for (let i = 0; i < chunks.length; i++) {
          const embeddingVector = `[${embeddings[i].join(",")}]`;
          await db.execute(sql`
            UPDATE documentation_chunks
            SET embedding = ${embeddingVector}::vector
            WHERE source_id = ${sourceId} AND chunk_index = ${i}
          `);
        }

        logger.info({ sourceId, chunkCount: chunks.length }, 'Re-chunked and re-embedded source');
      } else {
        // Just update metadata
        await db
          .update(documentationSources)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(eq(documentationSources.id, sourceId));

        logger.info({ sourceId, updates }, 'Updated source');
      }
    } catch (error) {
      logger.error({ error, sourceId }, 'Update source failed');
      throw error;
    }
  }
}

// Export singleton instance
export const ragService = new RAGService();
