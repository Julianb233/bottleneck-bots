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

export type DocumentKnowledgeCategory = "sop" | "process" | "policy" | "reference" | "training" | "general";

export interface SOPStep {
  stepNumber: number;
  title: string;
  instruction: string;
  expectedOutcome?: string;
}

export interface SOPExtractionResult {
  isSOPDocument: boolean;
  steps: SOPStep[];
  objective?: string;
  prerequisites?: string[];
  totalSteps: number;
}

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
  sopMetadata?: {
    detectedCategory?: string;
    isSOP?: boolean;
    sopSteps?: Array<{ stepNumber: number; title: string; description: string }>;
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
  knowledgeCategories?: DocumentKnowledgeCategory[];
  minSimilarity?: number;
  prioritizeSOPs?: boolean;
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
   * Detect if a document is an SOP and extract step sequences
   */
  extractSOPMetadata(content: string): SOPExtractionResult {
    const steps: SOPStep[] = [];
    let isSOPDocument = false;

    // Detect SOP patterns in the content
    const sopIndicators = [
      /\bSOP\b/i,
      /standard operating procedure/i,
      /step[\s-]*by[\s-]*step/i,
      /procedure\s*:/i,
      /workflow\s*:/i,
      /checklist\s*:/i,
    ];

    isSOPDocument = sopIndicators.some(pattern => pattern.test(content));

    // Extract numbered steps (e.g., "1. Do X", "Step 1:", "1) Do X")
    const numberedStepRegex = /(?:^|\n)\s*(?:step\s+)?(\d+)[.):\s]+\s*(.+?)(?=\n\s*(?:step\s+)?\d+[.):\s]|\n\n|$)/gis;
    let match;
    while ((match = numberedStepRegex.exec(content)) !== null) {
      const stepNum = parseInt(match[1]);
      const stepText = match[2].trim();
      if (stepText.length > 5) {
        const firstSentence = stepText.split(/[.!?]\s/)[0];
        steps.push({
          stepNumber: stepNum,
          title: firstSentence.substring(0, 100),
          instruction: stepText,
        });
      }
    }

    if (steps.length >= 2) {
      isSOPDocument = true;
    }

    // Extract objective if present
    const objectiveMatch = content.match(/(?:objective|purpose|goal|overview)\s*[:\-]\s*(.+?)(?:\n\n|\n(?=[A-Z#\d]))/is);
    const objective = objectiveMatch ? objectiveMatch[1].trim() : undefined;

    // Extract prerequisites if present
    const prereqMatch = content.match(/(?:prerequisites?|requirements?|before you begin)\s*[:\-]\s*([\s\S]+?)(?:\n\n(?=[A-Z#\d]))/is);
    const prerequisites: string[] = [];
    if (prereqMatch) {
      const items = prereqMatch[1].split(/\n\s*[-*]\s+/).filter(Boolean);
      prerequisites.push(...items.map(p => p.trim()).filter(p => p.length > 3));
    }

    return {
      isSOPDocument,
      steps: steps.sort((a, b) => a.stepNumber - b.stepNumber),
      objective,
      prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
      totalSteps: steps.length,
    };
  }

  /**
   * Classify the knowledge category of a document based on content
   */
  classifyKnowledgeCategory(content: string, inputCategory: string): DocumentKnowledgeCategory {
    if (inputCategory === "sop") return "sop";
    if (inputCategory === "process") return "process";
    if (inputCategory === "policy") return "policy";
    if (inputCategory === "reference") return "reference";
    if (inputCategory === "training") return "training";

    const contentLower = content.toLowerCase();
    if (/\bsop\b|standard operating procedure|step[\s-]*by[\s-]*step|procedure\s*:|checklist/i.test(contentLower)) return "sop";
    if (/workflow|process flow|flowchart|decision tree|automation/i.test(contentLower)) return "process";
    if (/policy|compliance|regulation|guidelines|governance|must not|shall not|required to/i.test(contentLower)) return "policy";

    return "general";
  }

  /**
   * Calculate priority score for a chunk (higher = retrieved first)
   */
  calculateChunkPriority(content: string, knowledgeCategory: DocumentKnowledgeCategory, isSOPStep: boolean): number {
    let priority = 50;
    if (isSOPStep) priority = 90;
    switch (knowledgeCategory) {
      case "sop": priority = Math.max(priority, 85); break;
      case "process": priority = Math.max(priority, 75); break;
      case "policy": priority = Math.max(priority, 70); break;
      case "training": priority = Math.max(priority, 60); break;
      case "reference": priority = Math.max(priority, 50); break;
    }
    if (/\b(click|navigate|type|enter|select|create|update|delete|submit|configure|set up)\b/i.test(content)) {
      priority = Math.min(100, priority + 5);
    }
    return priority;
  }

  /**
   * Retrieve structured document knowledge for agent task execution
   * Separates SOP context from reference context with priority ordering
   */
  async retrieveForTask(taskDescription: string, options: {
    userId?: number;
    platforms?: string[];
    maxTokens?: number;
  } = {}): Promise<{
    sopContext: string;
    referenceContext: string;
    allChunks: DocumentChunk[];
    sopSteps: Array<{ stepNumber: number; title: string; instruction: string }>;
  }> {
    const maxTokens = options.maxTokens || 4000;

    const chunks = await this.retrieve(taskDescription, {
      topK: 15,
      platforms: options.platforms,
      minSimilarity: 0.5,
      prioritizeSOPs: true,
    });

    let sopContext = "";
    let referenceContext = "";
    let tokenCount = 0;
    const sopSteps: Array<{ stepNumber: number; title: string; instruction: string }> = [];
    const usedChunks: DocumentChunk[] = [];

    for (const chunk of chunks) {
      if (tokenCount + chunk.tokenCount > maxTokens) break;

      const metadata = chunk.metadata as Record<string, any> || {};
      const knowledgeCategory = metadata.knowledgeCategory || metadata.documentCategory || "general";

      if (knowledgeCategory === "sop" || metadata.isSOPStep || metadata.isSOP) {
        sopContext += `\n[SOP] ${chunk.content}\n`;
        if (metadata.isSOPStep || metadata.sopStepNumber) {
          sopSteps.push({
            stepNumber: metadata.sopStepNumber || 0,
            title: metadata.sopStepTitle || "",
            instruction: chunk.content,
          });
        }
      } else {
        referenceContext += `\n[${knowledgeCategory.toUpperCase()}] ${chunk.content}\n`;
      }

      tokenCount += chunk.tokenCount;
      usedChunks.push(chunk);
    }

    return {
      sopContext: sopContext.trim(),
      referenceContext: referenceContext.trim(),
      allChunks: usedChunks,
      sopSteps: sopSteps.sort((a, b) => a.stepNumber - b.stepNumber),
    };
  }

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

      // Build metadata including SOP info
      const sourceMetadata: Record<string, any> = {};
      const sourceTags: string[] = [];
      if (input.sopMetadata) {
        if (input.sopMetadata.detectedCategory) {
          sourceMetadata.detectedCategory = input.sopMetadata.detectedCategory;
          sourceTags.push(input.sopMetadata.detectedCategory);
        }
        if (input.sopMetadata.isSOP) {
          sourceMetadata.isSOP = true;
          sourceTags.push('sop');
          if (input.sopMetadata.sopSteps) {
            sourceMetadata.sopStepCount = input.sopMetadata.sopSteps.length;
            sourceMetadata.sopSteps = input.sopMetadata.sopSteps;
          }
        }
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
          metadata: sourceMetadata,
          tags: sourceTags,
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

      // Extract SOP metadata and classify knowledge category
      const sopExtraction = this.extractSOPMetadata(input.content);
      const knowledgeCategory = this.classifyKnowledgeCategory(input.content, input.category);

      logger.info({
        sourceId: source.id,
        knowledgeCategory,
        isSOPDocument: sopExtraction.isSOPDocument,
        sopStepCount: sopExtraction.totalSteps,
      }, 'Document SOP classification complete');

      // Insert chunks with embeddings and SOP-specific metadata
      const chunkValues = chunks.map((chunk, index) => {
        // Check if this chunk contains a detected SOP step
        const matchingStep = sopExtraction.steps.find(step =>
          chunk.includes(step.instruction.substring(0, 50))
        );
        const isSOPStep = !!matchingStep;
        const priority = this.calculateChunkPriority(chunk, knowledgeCategory, isSOPStep);

        return {
          sourceId: source.id,
          chunkIndex: index,
          content: chunk,
          tokenCount: estimateTokens(chunk),
          metadata: {
            platform: input.platform,
            category: input.category,
            title: input.title,
            chunkSize: chunk.length,
            knowledgeCategory,
            priority,
            ...(input.sopMetadata?.detectedCategory && { documentCategory: input.sopMetadata.detectedCategory }),
            ...(input.sopMetadata?.isSOP && { isSOP: true }),
            ...(isSOPStep && matchingStep ? {
              isSOPStep: true,
              sopStepNumber: matchingStep.stepNumber,
              sopStepTitle: matchingStep.title,
            } : {}),
            ...(sopExtraction.isSOPDocument ? {
              sopDocument: true,
              sopTotalSteps: sopExtraction.totalSteps,
              sopObjective: sopExtraction.objective,
            } : {}),
          },
        };
      });

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

      // Add knowledge category filter (from chunk metadata)
      if (options.knowledgeCategories && options.knowledgeCategories.length > 0) {
        sqlQuery = sql`${sqlQuery} AND c.metadata->>'knowledgeCategory' IN ${sql.join(options.knowledgeCategories.map(c => sql`${c}`), sql`, `)}`;
      }

      // Add similarity threshold and ordering, with optional SOP priority boost
      if (options.prioritizeSOPs) {
        sqlQuery = sql`
          ${sqlQuery}
          AND 1 - (c.embedding <=> ${sql.raw(vectorLiteral)}::vector) >= ${minSimilarity}
          ORDER BY
            CASE WHEN (c.metadata->>'knowledgeCategory' = 'sop' OR c.metadata->>'isSOP' = 'true') THEN 0 ELSE 1 END,
            COALESCE((c.metadata->>'priority')::int, 50) DESC,
            c.embedding <=> ${sql.raw(vectorLiteral)}::vector
          LIMIT ${topK}
        `;
      } else {
        sqlQuery = sql`
          ${sqlQuery}
          AND 1 - (c.embedding <=> ${sql.raw(vectorLiteral)}::vector) >= ${minSimilarity}
          ORDER BY c.embedding <=> ${sql.raw(vectorLiteral)}::vector
          LIMIT ${topK}
        `;
      }

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
   * Re-process a document: delete chunks and re-ingest with current settings
   */
  async reprocessDocument(sourceId: number): Promise<IngestResult> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
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

      logger.info({ sourceId }, 'Deleted existing chunks for reprocessing');

      // Re-chunk and re-embed
      const chunks = chunkDocument(source.content);
      const embeddings = await generateEmbeddings(chunks);

      // Detect SOP metadata from content
      const { documentParserService } = await import('./document-parser.service');
      const sopInfo = documentParserService.detectSOPContent(source.content);

      const chunkValues = chunks.map((chunk, index) => ({
        sourceId: sourceId,
        chunkIndex: index,
        content: chunk,
        tokenCount: estimateTokens(chunk),
        metadata: {
          platform: source.platform,
          category: source.category,
          title: source.title,
          chunkSize: chunk.length,
          ...(sopInfo.category !== 'general' && { documentCategory: sopInfo.category }),
          ...(sopInfo.isSOP && { isSOP: true, sopStepCount: sopInfo.steps.length }),
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

      // Update source metadata with SOP info
      const sourceMetadata: Record<string, any> = (source.metadata as Record<string, any>) || {};
      if (sopInfo.isSOP) {
        sourceMetadata.detectedCategory = sopInfo.category;
        sourceMetadata.isSOP = true;
        sourceMetadata.sopStepCount = sopInfo.steps.length;
        sourceMetadata.sopSteps = sopInfo.steps;
      }

      await db
        .update(documentationSources)
        .set({
          metadata: sourceMetadata,
          updatedAt: new Date(),
        })
        .where(eq(documentationSources.id, sourceId));

      const totalTokens = chunkValues.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

      logger.info({ sourceId, chunkCount: chunks.length, totalTokens }, 'Document reprocessed');

      return {
        sourceId: sourceId,
        chunkCount: chunks.length,
        totalTokens,
      };
    } catch (error) {
      logger.error({ error, sourceId }, 'Reprocess failed');
      throw error;
    }
  }

  /**
   * Get chunks for a specific source
   */
  async getChunks(sourceId: number): Promise<DocumentChunk[]> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const chunks = await db
        .select({
          id: documentationChunks.id,
          sourceId: documentationChunks.sourceId,
          chunkIndex: documentationChunks.chunkIndex,
          content: documentationChunks.content,
          tokenCount: documentationChunks.tokenCount,
          metadata: documentationChunks.metadata,
        })
        .from(documentationChunks)
        .where(eq(documentationChunks.sourceId, sourceId))
        .orderBy(documentationChunks.chunkIndex);

      return chunks as unknown as DocumentChunk[];
    } catch (error) {
      logger.error({ error, sourceId }, 'Get chunks failed');
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
