/**
 * GHL Pipelines & Opportunities Service
 *
 * Wraps GHL API v2 endpoints for pipeline and opportunity management:
 * - List pipelines and stages
 * - Full opportunity CRUD (create, read, update, delete)
 * - Stage transitions (move opportunity between stages)
 *
 * Uses GHLService for auth, rate limiting, and retry.
 *
 * Linear: AI-2878
 */

import { GHLService, type GHLApiResponse } from "./ghl.service";

// ========================================
// TYPES
// ========================================

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
  showInFunnel?: boolean;
  showInPieChart?: boolean;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
  locationId: string;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue?: number;
  pipelineId: string;
  pipelineStageId: string;
  assignedTo?: string;
  status: "open" | "won" | "lost" | "abandoned";
  source?: string;
  contactId?: string;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
  createdAt: string;
  updatedAt: string;
  customFields?: Array<{ id: string; fieldValue: string | string[] }>;
}

export interface GHLOpportunitySearchResult {
  opportunities: GHLOpportunity[];
  meta: {
    total: number;
    currentPage: number;
    nextPage: number | null;
    previousPage: number | null;
  };
}

export interface CreateOpportunityInput {
  pipelineId: string;
  pipelineStageId: string;
  name: string;
  contactId: string;
  status?: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  assignedTo?: string;
  source?: string;
  customFields?: Array<{ id: string; field_value: string | string[] }>;
}

export interface UpdateOpportunityInput {
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  assignedTo?: string;
  source?: string;
  customFields?: Array<{ id: string; field_value: string | string[] }>;
}

export interface OpportunitySearchParams {
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  status?: "open" | "won" | "lost" | "abandoned";
  assignedTo?: string;
  q?: string;
  limit?: number;
  startAfter?: string;
  startAfterId?: string;
  order?: "added_asc" | "added_desc" | "updated_asc" | "updated_desc";
}

// ========================================
// PIPELINES SERVICE
// ========================================

export class PipelinesService {
  private ghl: GHLService;

  constructor(ghl: GHLService) {
    this.ghl = ghl;
  }

  // ----------------------------------------
  // Pipeline operations
  // ----------------------------------------

  async listPipelines(): Promise<GHLPipeline[]> {
    const response = await this.ghl.request<{ pipelines: GHLPipeline[] }>({
      method: "GET",
      endpoint: "/opportunities/pipelines",
    });
    return response.data.pipelines || [];
  }

  async getPipeline(pipelineId: string): Promise<GHLPipeline | null> {
    const pipelines = await this.listPipelines();
    return pipelines.find((p) => p.id === pipelineId) || null;
  }

  // ----------------------------------------
  // Opportunity CRUD
  // ----------------------------------------

  async searchOpportunities(
    params: OpportunitySearchParams
  ): Promise<GHLOpportunitySearchResult> {
    const queryParams: Record<string, string> = {};

    if (params.pipelineId) queryParams.pipeline_id = params.pipelineId;
    if (params.pipelineStageId) queryParams.pipeline_stage_id = params.pipelineStageId;
    if (params.contactId) queryParams.contact_id = params.contactId;
    if (params.status) queryParams.status = params.status;
    if (params.assignedTo) queryParams.assigned_to = params.assignedTo;
    if (params.q) queryParams.q = params.q;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.startAfter) queryParams.startAfter = params.startAfter;
    if (params.startAfterId) queryParams.startAfterId = params.startAfterId;
    if (params.order) queryParams.order = params.order;

    const response = await this.ghl.request<GHLOpportunitySearchResult>({
      method: "GET",
      endpoint: "/opportunities/search",
      params: queryParams,
    });

    return response.data;
  }

  async getOpportunity(opportunityId: string): Promise<GHLOpportunity> {
    const response = await this.ghl.request<{ opportunity: GHLOpportunity }>({
      method: "GET",
      endpoint: `/opportunities/${opportunityId}`,
    });
    return response.data.opportunity;
  }

  async createOpportunity(
    input: CreateOpportunityInput
  ): Promise<GHLOpportunity> {
    const response = await this.ghl.request<{ opportunity: GHLOpportunity }>({
      method: "POST",
      endpoint: "/opportunities/",
      data: input,
    });
    return response.data.opportunity;
  }

  async updateOpportunity(
    opportunityId: string,
    input: UpdateOpportunityInput
  ): Promise<GHLOpportunity> {
    const response = await this.ghl.request<{ opportunity: GHLOpportunity }>({
      method: "PUT",
      endpoint: `/opportunities/${opportunityId}`,
      data: input,
    });
    return response.data.opportunity;
  }

  async deleteOpportunity(opportunityId: string): Promise<boolean> {
    await this.ghl.request({
      method: "DELETE",
      endpoint: `/opportunities/${opportunityId}`,
    });
    return true;
  }

  // ----------------------------------------
  // Stage transitions
  // ----------------------------------------

  /**
   * Move an opportunity to a different stage within its pipeline.
   * Optionally update status (e.g., mark as "won" when moving to final stage).
   */
  async updateStage(
    opportunityId: string,
    stageId: string,
    status?: "open" | "won" | "lost" | "abandoned"
  ): Promise<GHLOpportunity> {
    const updateData: UpdateOpportunityInput = {
      pipelineStageId: stageId,
    };
    if (status) {
      updateData.status = status;
    }
    return this.updateOpportunity(opportunityId, updateData);
  }

  /**
   * Bulk update status for multiple opportunities.
   * Useful for batch operations like marking all opportunities in a stage as won/lost.
   */
  async bulkUpdateStatus(
    opportunityIds: string[],
    status: "open" | "won" | "lost" | "abandoned"
  ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
    const succeeded: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of opportunityIds) {
      try {
        await this.updateOpportunity(id, { status });
        succeeded.push(id);
      } catch (err) {
        failed.push({
          id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return { succeeded, failed };
  }
}

// ========================================
// FACTORY
// ========================================

export function createPipelinesService(
  locationId: string,
  userId: number
): PipelinesService {
  const ghl = new GHLService(locationId, userId);
  return new PipelinesService(ghl);
}
