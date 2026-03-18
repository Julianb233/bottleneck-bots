/**
 * Document Parser Service
 *
 * Handles parsing of various document formats (PDF, DOCX, TXT, HTML)
 * for ingestion into the RAG system for agent training.
 */

// pdf-parse is loaded dynamically to avoid serverless compatibility issues
// (pdfjs-dist uses browser APIs like DOMMatrix that aren't available in Node.js serverless)
let pdfParse: any = null;

async function getPdfParser() {
  if (pdfParse) return pdfParse;

  try {
    // Dynamic import to avoid loading at startup
    const pdfParseModule = await import('pdf-parse') as any;
    pdfParse = pdfParseModule.default ?? pdfParseModule;
    return pdfParse;
  } catch (error) {
    console.error('[DocumentParser] Failed to load pdf-parse:', error);
    throw new Error('PDF parsing is not available in this environment');
  }
}

export type DocumentCategory = 'sop' | 'process' | 'policy' | 'reference' | 'general';

export interface SOPStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    charCount: number;
    title?: string;
    author?: string;
    creationDate?: string;
    format: string;
    detectedCategory?: DocumentCategory;
    sopSteps?: SOPStep[];
    isSOP?: boolean;
  };
}

export interface ParseOptions {
  maxPages?: number;
  extractImages?: boolean;
}

class DocumentParserService {
  /**
   * Parse a PDF buffer and extract text
   */
  async parsePdf(buffer: Buffer, options: ParseOptions = {}): Promise<ParsedDocument> {
    try {
      // Load pdf-parse dynamically
      const parser = await getPdfParser();
      const data = await parser(buffer, {
        max: options.maxPages || 0, // 0 means all pages
      });

      const text = data.text.trim();

      return {
        text,
        metadata: {
          pageCount: data.numpages,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          charCount: text.length,
          title: data.info?.Title || undefined,
          author: data.info?.Author || undefined,
          creationDate: data.info?.CreationDate || undefined,
          format: 'pdf',
        },
      };
    } catch (error) {
      console.error('[DocumentParser] PDF parse error:', error);
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse plain text content
   */
  parseText(content: string): ParsedDocument {
    const text = content.trim();

    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
        format: 'text',
      },
    };
  }

  /**
   * Parse HTML content and extract text
   */
  parseHtml(content: string): ParsedDocument {
    // Strip script and style tags
    let text = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Extract title if present
    const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Strip all remaining HTML tags
    text = text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
        title,
        format: 'html',
      },
    };
  }

  /**
   * Parse markdown content
   */
  parseMarkdown(content: string): ParsedDocument {
    // Extract title from first H1
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Convert markdown to plain text (basic conversion)
    let text = content
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      // Remove headers but keep text
      .replace(/^#+\s+/gm, '')
      // Remove emphasis
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).filter(Boolean).length,
        charCount: text.length,
        title,
        format: 'markdown',
      },
    };
  }

  /**
   * Auto-detect format and parse document
   */
  async parse(
    content: Buffer | string,
    mimeType?: string,
    filename?: string
  ): Promise<ParsedDocument> {
    // Determine format from mime type or filename
    const format = this.detectFormat(mimeType, filename, content);

    let doc: ParsedDocument;

    switch (format) {
      case 'pdf':
        if (typeof content === 'string') {
          throw new Error('PDF content must be a Buffer');
        }
        doc = await this.parsePdf(content);
        break;

      case 'html':
        if (Buffer.isBuffer(content)) {
          doc = this.parseHtml(content.toString('utf-8'));
        } else {
          doc = this.parseHtml(content);
        }
        break;

      case 'markdown':
        if (Buffer.isBuffer(content)) {
          doc = this.parseMarkdown(content.toString('utf-8'));
        } else {
          doc = this.parseMarkdown(content);
        }
        break;

      case 'text':
      default:
        if (Buffer.isBuffer(content)) {
          doc = this.parseText(content.toString('utf-8'));
        } else {
          doc = this.parseText(content);
        }
        break;
    }

    // Automatically enrich with SOP detection
    return this.enrichWithSOPDetection(doc);
  }

  /**
   * Detect if a document is an SOP and extract step sequences
   */
  detectSOPContent(text: string): { isSOP: boolean; category: DocumentCategory; steps: SOPStep[] } {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Patterns that indicate SOP/procedure content
    const sopIndicators = [
      /\bstandard operating procedure\b/i,
      /\bSOP\b/,
      /\bprocedure\b/i,
      /\bstep[- ]by[- ]step\b/i,
      /\bwork instruction\b/i,
      /\bhow to\b/i,
      /\bprocess document\b/i,
    ];

    const policyIndicators = [
      /\bpolicy\b/i,
      /\bguideline\b/i,
      /\bcompliance\b/i,
      /\bregulation\b/i,
    ];

    const processIndicators = [
      /\bworkflow\b/i,
      /\bprocess flow\b/i,
      /\bpipeline\b/i,
      /\bautomation\b/i,
    ];

    // Count numbered steps (e.g., "1.", "Step 1:", "1)", etc.)
    const numberedStepPattern = /^(?:step\s+)?(\d+)[.):\-]\s*(.+)/i;
    const steps: SOPStep[] = [];
    let consecutiveSteps = 0;
    let maxConsecutive = 0;

    for (const line of lines) {
      const match = line.match(numberedStepPattern);
      if (match) {
        const stepNum = parseInt(match[1]);
        steps.push({
          stepNumber: stepNum,
          title: match[2].substring(0, 120),
          description: match[2],
        });
        consecutiveSteps++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveSteps);
      } else {
        // If we have a current step and this is continuation text, append to description
        if (steps.length > 0 && line.length > 0 && !line.match(/^[#*\-]/)) {
          steps[steps.length - 1].description += ' ' + line;
        }
        consecutiveSteps = 0;
      }
    }

    // Determine category based on content analysis
    const fullText = text.toLowerCase();
    const sopScore = sopIndicators.filter(p => p.test(fullText)).length;
    const policyScore = policyIndicators.filter(p => p.test(fullText)).length;
    const processScore = processIndicators.filter(p => p.test(fullText)).length;

    // If we found 3+ sequential numbered steps or strong SOP indicators, it's an SOP
    const isSOP = maxConsecutive >= 3 || sopScore >= 2 || (steps.length >= 3 && sopScore >= 1);

    let category: DocumentCategory = 'general';
    if (isSOP || sopScore > 0) {
      category = 'sop';
    } else if (policyScore > processScore) {
      category = 'policy';
    } else if (processScore > 0) {
      category = 'process';
    } else if (steps.length >= 2) {
      category = 'reference';
    }

    return { isSOP, category, steps: isSOP ? steps : [] };
  }

  /**
   * Enhance a parsed document with SOP detection
   */
  enrichWithSOPDetection(doc: ParsedDocument): ParsedDocument {
    const sopInfo = this.detectSOPContent(doc.text);
    return {
      ...doc,
      metadata: {
        ...doc.metadata,
        detectedCategory: sopInfo.category,
        sopSteps: sopInfo.steps,
        isSOP: sopInfo.isSOP,
      },
    };
  }

  /**
   * Detect document format from mime type, filename, or content
   */
  private detectFormat(
    mimeType?: string,
    filename?: string,
    content?: Buffer | string
  ): 'pdf' | 'html' | 'markdown' | 'text' {
    // Check mime type
    if (mimeType) {
      if (mimeType === 'application/pdf') return 'pdf';
      if (mimeType === 'text/html') return 'html';
      if (mimeType === 'text/markdown') return 'markdown';
      if (mimeType.startsWith('text/')) return 'text';
    }

    // Check filename extension
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === 'pdf') return 'pdf';
      if (ext === 'html' || ext === 'htm') return 'html';
      if (ext === 'md' || ext === 'markdown') return 'markdown';
      if (ext === 'txt') return 'text';
    }

    // Check content magic bytes for PDF
    if (Buffer.isBuffer(content)) {
      const header = content.slice(0, 5).toString();
      if (header === '%PDF-') return 'pdf';
    }

    // Check content for HTML
    if (typeof content === 'string' || Buffer.isBuffer(content)) {
      const str = Buffer.isBuffer(content) ? content.toString('utf-8', 0, 100) : content.slice(0, 100);
      if (str.trim().toLowerCase().startsWith('<!doctype html') || str.trim().toLowerCase().startsWith('<html')) {
        return 'html';
      }
    }

    return 'text';
  }
}

export const documentParserService = new DocumentParserService();
