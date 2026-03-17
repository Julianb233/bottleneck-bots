/**
 * RAG Router
 *
 * tRPC endpoints for RAG system:
 * - Document ingestion
 * - Documentation retrieval
 * - System prompt building
 * - Source management
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { ragService } from "../../services/rag.service";
import { platformDetectionService } from "../../services/platformDetection.service";
import { documentParserService } from "../../services/document-parser.service";
import { getDb } from "../../db";
import { documentationSources, documentationChunks } from "../../../drizzle/schema-rag";
import { eq, desc, sql, and } from "drizzle-orm";

export const ragRouter = router({
  /**
   * Ingest a new documentation document
   * Requires authentication (protectedProcedure)
   */
  ingestDocument: protectedProcedure
    .input(
      z.object({
        platform: z.string().min(1).max(50),
        category: z.string().min(1).max(50),
        title: z.string().min(1),
        content: z.string().min(10),
        sourceUrl: z.string().url().optional(),
        sourceType: z.enum(["markdown", "html", "pdf", "docx"]).optional(),
        version: z.string().optional(),
        // Chunking options
        maxTokens: z.number().min(100).max(2000).optional(),
        overlapTokens: z.number().min(0).max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await ragService.ingest({
          platform: input.platform,
          category: input.category,
          title: input.title,
          content: input.content,
          sourceUrl: input.sourceUrl,
          sourceType: input.sourceType,
          version: input.version,
          userId: ctx.user.id,
          chunkingOptions: {
            maxTokens: input.maxTokens,
            overlapTokens: input.overlapTokens,
          },
        });

        return {
          success: true,
          sourceId: result.sourceId,
          chunkCount: result.chunkCount,
          totalTokens: result.totalTokens,
          message: `Successfully ingested "${input.title}" with ${result.chunkCount} chunks`,
        };
      } catch (error) {
        console.error("[RAG Router] Ingest failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ingest document: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Upload and ingest a document file (PDF, TXT, HTML, Markdown)
   * Accepts base64-encoded file content
   * Parses the document and ingests it into the RAG system for agent training
   * Uses SOP-aware processing for enhanced category tagging and step extraction
   */
  uploadDocument: protectedProcedure
    .input(
      z.object({
        fileContent: z.string().min(1, "File content is required"), // Base64 encoded
        filename: z.string().min(1, "Filename is required"),
        mimeType: z.string().optional(),
        platform: z.string().min(1).max(50).default("general"),
        category: z.string().min(1).max(50).default("training"),
        title: z.string().optional(), // Will use filename if not provided
        // Chunking options
        maxTokens: z.number().min(100).max(2000).optional(),
        overlapTokens: z.number().min(0).max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Decode base64 content to buffer
        const buffer = Buffer.from(input.fileContent, "base64");

        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;
        if (buffer.length > maxSize) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "File size exceeds maximum of 10MB",
          });
        }

        // Parse the document using the document parser service
        const parsed = await documentParserService.parse(
          buffer,
          input.mimeType,
          input.filename
        );

        // Check if we extracted any meaningful content
        if (!parsed.text || parsed.text.length < 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Could not extract text from document. File may be empty or corrupted.",
          });
        }

        // Use the title from input, parsed metadata, or filename
        const title = input.title || parsed.metadata.title || input.filename;

        // Ingest with SOP-aware processing for category tagging and step extraction
        const result = await ragService.ingestWithSOPProcessing({
          platform: input.platform,
          category: input.category,
          title,
          content: parsed.text,
          sourceType: parsed.metadata.format as "markdown" | "html" | "pdf" | "docx",
          userId: ctx.user.id,
          chunkingOptions: {
            maxTokens: input.maxTokens,
            overlapTokens: input.overlapTokens,
          },
        });

        console.log(
          `[RAG Router] Document uploaded: ${input.filename} (${parsed.metadata.format}) - ${result.chunkCount} chunks, category: ${result.knowledgeCategory}`
        );

        return {
          success: true,
          sourceId: result.sourceId,
          chunkCount: result.chunkCount,
          totalTokens: result.totalTokens,
          knowledgeCategory: result.knowledgeCategory,
          sopSteps: result.sopSteps,
          metadata: parsed.metadata,
          message: `Successfully processed "${title}" (${parsed.metadata.format}): ${result.chunkCount} chunks, ${parsed.metadata.wordCount} words, category: ${result.knowledgeCategory}`,
        };
      } catch (error) {
        console.error("[RAG Router] Upload failed:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to upload document: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Reprocess an existing document (re-chunk, re-embed, re-tag)
   * Useful when SOP processing logic is updated
   */
  reprocessSource: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const result = await ragService.reprocessSource(input.sourceId);
        return {
          success: true,
          sourceId: result.sourceId,
          chunkCount: result.chunkCount,
          totalTokens: result.totalTokens,
          knowledgeCategory: result.knowledgeCategory,
          message: `Reprocessed source ${input.sourceId}: ${result.chunkCount} chunks, category: ${result.knowledgeCategory}`,
        };
      } catch (error) {
        console.error("[RAG Router] Reprocess failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to reprocess source: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get chunks for a specific source with pagination
   * Used by the knowledge base browser to preview extracted chunks
   */
  getSourceChunks: protectedProcedure
    .input(
      z.object({
        sourceId: z.number(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new Error("Database not available");
        }

        const { sourceId, limit = 20, offset = 0 } = input;

        const chunks = await database
          .select({
            id: documentationChunks.id,
            chunkIndex: documentationChunks.chunkIndex,
            content: documentationChunks.content,
            tokenCount: documentationChunks.tokenCount,
            metadata: documentationChunks.metadata,
            createdAt: documentationChunks.createdAt,
          })
          .from(documentationChunks)
          .where(eq(documentationChunks.sourceId, sourceId))
          .orderBy(documentationChunks.chunkIndex)
          .limit(limit)
          .offset(offset);

        // Get total count
        const [countResult] = await database
          .select({ count: sql<number>`count(*)` })
          .from(documentationChunks)
          .where(eq(documentationChunks.sourceId, sourceId));

        return {
          success: true,
          chunks,
          total: Number(countResult?.count || 0),
        };
      } catch (error) {
        console.error("[RAG Router] Get source chunks failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get source chunks: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Retrieve relevant documentation for a query
   * Public endpoint for AI system prompt building
   */
  retrieve: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        topK: z.number().min(1).max(20).optional(),
        platforms: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        minSimilarity: z.number().min(0).max(1).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const chunks = await ragService.retrieve(input.query, {
          topK: input.topK,
          platforms: input.platforms,
          categories: input.categories,
          minSimilarity: input.minSimilarity,
        });

        return {
          success: true,
          chunks,
          count: chunks.length,
        };
      } catch (error) {
        console.error("[RAG Router] Retrieve failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to retrieve documentation: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Build a system prompt with RAG context
   * This is the main endpoint for AI chat integration
   */
  buildSystemPrompt: publicProcedure
    .input(
      z.object({
        userPrompt: z.string().min(1),
        platform: z.string().optional(),
        customTemplate: z.string().optional(),
        maxDocumentationTokens: z.number().min(100).max(10000).optional(),
        includeExamples: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await ragService.buildSystemPrompt(input.userPrompt, {
          platform: input.platform,
          customTemplate: input.customTemplate,
          maxDocumentationTokens: input.maxDocumentationTokens,
          includeExamples: input.includeExamples,
        });

        return {
          success: true,
          systemPrompt: result.systemPrompt,
          retrievedChunks: result.retrievedChunks,
          detectedPlatforms: result.detectedPlatforms,
          chunkCount: result.retrievedChunks.length,
        };
      } catch (error) {
        console.error("[RAG Router] Build system prompt failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to build system prompt: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Detect platforms from user input
   */
  detectPlatforms: publicProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        url: z.string().optional(),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await platformDetectionService.detect({
          prompt: input.prompt,
          url: input.url,
          context: input.context,
        });

        return {
          success: true,
          platforms: result.platforms,
          primaryPlatform: result.primaryPlatform,
          isDnsRelated: result.isDnsRelated,
          isDomainRelated: result.isDomainRelated,
        };
      } catch (error) {
        console.error("[RAG Router] Platform detection failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to detect platforms: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * List all documentation sources
   * Requires authentication
   */
  listSources: protectedProcedure
    .input(
      z.object({
        platform: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new Error("Database not available");
        }

        const { platform, category, isActive, limit = 20, offset = 0 } = input;

        let query = database
          .select({
            id: documentationSources.id,
            platform: documentationSources.platform,
            category: documentationSources.category,
            title: documentationSources.title,
            sourceUrl: documentationSources.sourceUrl,
            sourceType: documentationSources.sourceType,
            version: documentationSources.version,
            isActive: documentationSources.isActive,
            metadata: documentationSources.metadata,
            tags: documentationSources.tags,
            createdAt: documentationSources.createdAt,
            updatedAt: documentationSources.updatedAt,
          })
          .from(documentationSources);

        // Apply filters
        const conditions = [];
        if (platform) {
          conditions.push(eq(documentationSources.platform, platform));
        }
        if (category) {
          conditions.push(eq(documentationSources.category, category));
        }
        if (isActive !== undefined) {
          conditions.push(eq(documentationSources.isActive, isActive));
        }

        if (conditions.length > 0) {
          query = query.where(and(...conditions)) as any;
        }

        const sources = await query
          .orderBy(desc(documentationSources.createdAt))
          .limit(limit)
          .offset(offset);

        // Get chunk counts for each source
        const sourceIds = sources.map((s: any) => s.id);
        const chunkCounts = await database
          .select({
            sourceId: documentationChunks.sourceId,
            count: sql<number>`count(*)`,
          })
          .from(documentationChunks)
          .where(sql`${documentationChunks.sourceId} = ANY(${sourceIds})`)
          .groupBy(documentationChunks.sourceId);

        const countMap = new Map(chunkCounts.map((c: any) => [c.sourceId, Number(c.count)]));

        const sourcesWithCounts = sources.map((s: any) => ({
          ...s,
          chunkCount: countMap.get(s.id) || 0,
        }));

        return {
          success: true,
          sources: sourcesWithCounts,
          count: sourcesWithCounts.length,
        };
      } catch (error) {
        console.error("[RAG Router] List sources failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list sources: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get a single documentation source with its chunks
   */
  getSource: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .query(async ({ input }) => {
      try {
        const database = await getDb();
        if (!database) {
          throw new Error("Database not available");
        }

        const [source] = await database
          .select()
          .from(documentationSources)
          .where(eq(documentationSources.id, input.sourceId))
          .limit(1);

        if (!source) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Source ${input.sourceId} not found`,
          });
        }

        // Get chunks for this source
        const chunks = await database
          .select({
            id: documentationChunks.id,
            chunkIndex: documentationChunks.chunkIndex,
            content: documentationChunks.content,
            tokenCount: documentationChunks.tokenCount,
            metadata: documentationChunks.metadata,
          })
          .from(documentationChunks)
          .where(eq(documentationChunks.sourceId, input.sourceId))
          .orderBy(documentationChunks.chunkIndex);

        return {
          success: true,
          source,
          chunks,
          chunkCount: chunks.length,
        };
      } catch (error) {
        console.error("[RAG Router] Get source failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get source: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Delete a documentation source
   */
  deleteSource: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        await ragService.deleteSource(input.sourceId);

        return {
          success: true,
          message: `Source ${input.sourceId} deleted successfully`,
        };
      } catch (error) {
        console.error("[RAG Router] Delete source failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete source: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Update a documentation source
   */
  updateSource: protectedProcedure
    .input(
      z.object({
        sourceId: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        version: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { sourceId, ...updates } = input;

        await ragService.updateSource(sourceId, updates);

        return {
          success: true,
          message: `Source ${sourceId} updated successfully`,
        };
      } catch (error) {
        console.error("[RAG Router] Update source failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to update source: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Ingest a URL by crawling and processing its content
   */
  ingestUrl: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        platform: z.string().optional(),
        category: z.string().optional(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await ragService.ingestUrl(input.url, ctx.user.id, {
          platform: input.platform,
          category: input.category,
          title: input.title,
        });

        return {
          success: true,
          sourceId: result.sourceId,
          chunkCount: result.chunkCount,
          totalTokens: result.totalTokens,
          message: `Successfully ingested URL with ${result.chunkCount} chunks`,
        };
      } catch (error) {
        console.error("[RAG Router] URL ingestion failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to ingest URL: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Search similar documents using RAG
   */
  searchSimilar: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        topK: z.number().min(1).max(20).optional(),
        platforms: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        minSimilarity: z.number().min(0).max(1).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const chunks = await ragService.retrieve(input.query, {
          topK: input.topK,
          platforms: input.platforms,
          categories: input.categories,
          minSimilarity: input.minSimilarity,
        });

        return {
          success: true,
          chunks,
          count: chunks.length,
        };
      } catch (error) {
        console.error("[RAG Router] Search similar failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to search documents: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Build context from relevant chunks
   */
  buildContext: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        topK: z.number().min(1).max(20).optional(),
        platforms: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const context = await ragService.buildContext(input.query, {
          topK: input.topK,
          platforms: input.platforms,
          categories: input.categories,
        });

        return {
          success: true,
          context,
        };
      } catch (error) {
        console.error("[RAG Router] Build context failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to build context: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Re-process an existing document with updated SOP processing
   */
  reprocessSource: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const result = await ragService.reprocessSource(input.sourceId);

        return {
          success: true,
          sourceId: result.sourceId,
          chunkCount: result.chunkCount,
          totalTokens: result.totalTokens,
          message: `Reprocessed document: ${result.chunkCount} chunks created`,
        };
      } catch (error) {
        console.error("[RAG Router] Reprocess failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to reprocess document: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get knowledge base summary (categorized counts, SOP data, top priority docs)
   */
  knowledgeSummary: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      try {
        const summary = await ragService.getKnowledgeSummary(ctx.user.id);

        return {
          success: true,
          ...summary,
        };
      } catch (error) {
        console.error("[RAG Router] Knowledge summary failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get knowledge summary: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get chunks for a specific source (knowledge base browser preview)
   */
  getSourceChunks: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .query(async ({ input }) => {
      try {
        const chunks = await ragService.getSourceChunks(input.sourceId);
        return { success: true, chunks, count: chunks.length };
      } catch (error) {
        console.error("[RAG Router] Get source chunks failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get chunks: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Retrieve structured knowledge for agent task execution
   */
  retrieveForTask: publicProcedure
    .input(z.object({
      taskDescription: z.string().min(1),
      platforms: z.array(z.string()).optional(),
      maxTokens: z.number().min(100).max(10000).optional(),
    }))
    .query(async ({ input }) => {
      try {
        const result = await ragService.retrieveForTask(input.taskDescription, {
          platforms: input.platforms,
          maxTokens: input.maxTokens,
        });
        return {
          success: true,
          sopContext: result.sopContext,
          referenceContext: result.referenceContext,
          sopSteps: result.sopSteps,
          chunkCount: result.allChunks.length,
        };
      } catch (error) {
        console.error("[RAG Router] Retrieve for task failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to retrieve task knowledge: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Similarity search - test which chunks would be retrieved for a given query
   */
  similaritySearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(2000),
      topK: z.number().min(1).max(20).optional().default(5),
      minSimilarity: z.number().min(0).max(1).optional().default(0.5),
    }))
    .query(async ({ input }) => {
      try {
        const chunks = await ragService.retrieve(input.query, {
          topK: input.topK,
          minSimilarity: input.minSimilarity,
        });
        return {
          success: true,
          query: input.query,
          results: chunks.map((chunk) => ({
            id: chunk.id,
            sourceId: chunk.sourceId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            similarity: chunk.similarity,
            metadata: chunk.metadata,
          })),
          count: chunks.length,
        };
      } catch (error) {
        console.error("[RAG Router] Similarity search failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Similarity search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Seed platform keywords (admin operation)
   * This should be called once during initial setup
   */
  seedPlatformKeywords: protectedProcedure.mutation(async () => {
    try {
      await platformDetectionService.seedPlatformKeywords();

      return {
        success: true,
        message: "Platform keywords seeded successfully",
      };
    } catch (error) {
      console.error("[RAG Router] Seed keywords failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to seed keywords: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }),
});
