/**
 * GHL Pipeline, Campaign, Workflow & Messaging Service (FR-015 through FR-039)
 *
 * Pipeline operations, opportunity management, campaigns,
 * workflow triggers, SMS/email messaging, and template management.
 * Built on top of GHLService.request() base HTTP client.
 */

import { getGHLService, type GHLApiResponse } from "./ghl.service";

// ========================================
// TYPES -- PIPELINES & OPPORTUNITIES
// ========================================

export interface GhlPipeline {
  id: string;
  name: string;
  locationId: string;
  stages: GhlPipelineStage[];
  showInFunnel?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GhlPipelineStage {
  id: string;
  name: string;
  position: number;
  showInFunnel?: boolean;
}

export interface GhlOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  contactId: string;
  monetaryValue?: number;
  assignedTo?: string;
  source?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value: unknown }>;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GhlOpportunityCreateInput {
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  status?: string;
  monetaryValue?: number;
  assignedTo?: string;
  source?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value: unknown }>;
}

export interface GhlOpportunityUpdateInput {
  name?: string;
  pipelineStageId?: string;
  status?: string;
  monetaryValue?: number;
  assignedTo?: string;
  source?: string;
  tags?: string[];
  customFields?: Array<{ id: string; value: unknown }>;
  notes?: string;
}

export interface GhlOpportunitySearchParams {
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  assignedTo?: string;
  contactId?: string;
  q?: string;
  limit?: number;
  startAfterId?: string;
}

// ========================================
// TYPES -- CAMPAIGNS
// ========================================

export interface GhlCampaign {
  id: string;
  name: string;
  locationId: string;
  status: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ========================================
// TYPES -- WORKFLOWS
// ========================================

export interface GhlWorkflow {
  id: string;
  name: string;
  locationId: string;
  status: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ========================================
// TYPES -- MESSAGING
// ========================================

export interface GhlMessageStatus {
  id: string;
  type: string;
  status: string;
  direction: string;
  contactId: string;
  body?: string;
  dateAdded?: string;
}

export interface GhlTemplate {
  id: string;
  name: string;
  type: string;
  body?: string;
  subject?: string;
  locationId: string;
  createdAt?: string;
}

// ========================================
// PIPELINES SERVICE
// ========================================

export class GhlPipelinesService {
  private ghl = getGHLService();

  // ----------------------------------------
  // Pipelines (FR-015)
  // ----------------------------------------

  /** List all pipelines for a location */
  async listPipelines(userId: number, locationId: string) {
    return this.ghl.request<{ pipelines: GhlPipeline[] }>({
      method: "GET",
      endpoint: "/opportunities/pipelines",
      locationId,
      userId,
      params: { locationId },
    });
  }

  /** Get a single pipeline with stages */
  async getPipeline(userId: number, locationId: string, pipelineId: string) {
    return this.ghl.request<{ pipeline: GhlPipeline }>({
      method: "GET",
      endpoint: `/opportunities/pipelines/${pipelineId}`,
      locationId,
      userId,
    });
  }

  // ----------------------------------------
  // Opportunities (FR-016 through FR-020)
  // ----------------------------------------

  /** Create an opportunity (FR-016) */
  async createOpportunity(userId: number, locationId: string, data: GhlOpportunityCreateInput) {
    return this.ghl.request<{ opportunity: GhlOpportunity }>({
      method: "POST",
      endpoint: "/opportunities/",
      locationId,
      userId,
      data,
    });
  }

  /** Get an opportunity by ID (FR-017) */
  async getOpportunity(userId: number, locationId: string, opportunityId: string) {
    return this.ghl.request<{ opportunity: GhlOpportunity }>({
      method: "GET",
      endpoint: `/opportunities/${opportunityId}`,
      locationId,
      userId,
    });
  }

  /** Update an opportunity (FR-018) */
  async updateOpportunity(
    userId: number,
    locationId: string,
    opportunityId: string,
    data: GhlOpportunityUpdateInput
  ) {
    return this.ghl.request<{ opportunity: GhlOpportunity }>({
      method: "PUT",
      endpoint: `/opportunities/${opportunityId}`,
      locationId,
      userId,
      data,
    });
  }

  /** Delete an opportunity (FR-019) */
  async deleteOpportunity(userId: number, locationId: string, opportunityId: string) {
    return this.ghl.request({
      method: "DELETE",
      endpoint: `/opportunities/${opportunityId}`,
      locationId,
      userId,
    });
  }

  /** Move an opportunity to a different pipeline stage (FR-020) */
  async moveOpportunityStage(
    userId: number,
    locationId: string,
    opportunityId: string,
    stageId: string
  ) {
    return this.updateOpportunity(userId, locationId, opportunityId, {
      pipelineStageId: stageId,
    });
  }

  /** Assign an opportunity to a user */
  async assignOpportunity(
    userId: number,
    locationId: string,
    opportunityId: string,
    assignedUserId: string
  ) {
    return this.updateOpportunity(userId, locationId, opportunityId, {
      assignedTo: assignedUserId,
    });
  }

  /** Search opportunities */
  async searchOpportunities(
    userId: number,
    locationId: string,
    searchParams: GhlOpportunitySearchParams = {}
  ) {
    const params: Record<string, string> = { location_id: locationId };
    if (searchParams.pipelineId) params.pipeline_id = searchParams.pipelineId;
    if (searchParams.pipelineStageId) params.pipeline_stage_id = searchParams.pipelineStageId;
    if (searchParams.status) params.status = searchParams.status;
    if (searchParams.assignedTo) params.assigned_to = searchParams.assignedTo;
    if (searchParams.contactId) params.contact_id = searchParams.contactId;
    if (searchParams.q) params.q = searchParams.q;
    if (searchParams.limit) params.limit = String(searchParams.limit);
    if (searchParams.startAfterId) params.startAfterId = searchParams.startAfterId;

    return this.ghl.request<{ opportunities: GhlOpportunity[]; meta?: { total: number } }>({
      method: "GET",
      endpoint: "/opportunities/search",
      locationId,
      userId,
      params,
    });
  }

  // ----------------------------------------
  // Campaigns (FR-021 through FR-026)
  // ----------------------------------------

  /** List campaigns for a location (FR-021) */
  async listCampaigns(userId: number, locationId: string) {
    return this.ghl.request<{ campaigns: GhlCampaign[] }>({
      method: "GET",
      endpoint: "/campaigns/",
      locationId,
      userId,
      params: { locationId },
    });
  }

  /** Add a contact to a campaign (FR-022) */
  async addContactToCampaign(
    userId: number,
    locationId: string,
    campaignId: string,
    contactId: string
  ) {
    return this.ghl.request({
      method: "POST",
      endpoint: `/campaigns/${campaignId}/contacts/${contactId}`,
      locationId,
      userId,
    });
  }

  /** Remove a contact from a campaign (FR-023) */
  async removeContactFromCampaign(
    userId: number,
    locationId: string,
    campaignId: string,
    contactId: string
  ) {
    return this.ghl.request({
      method: "DELETE",
      endpoint: `/campaigns/${campaignId}/contacts/${contactId}`,
      locationId,
      userId,
    });
  }

  /** Get campaign details (FR-025) */
  async getCampaign(userId: number, locationId: string, campaignId: string) {
    return this.ghl.request<GhlCampaign>({
      method: "GET",
      endpoint: `/campaigns/${campaignId}`,
      locationId,
      userId,
    });
  }

  // ----------------------------------------
  // Workflows (FR-027 through FR-030)
  // ----------------------------------------

  /** List workflows for a location (FR-027) */
  async listWorkflows(userId: number, locationId: string) {
    return this.ghl.request<{ workflows: GhlWorkflow[] }>({
      method: "GET",
      endpoint: "/workflows/",
      locationId,
      userId,
      params: { locationId },
    });
  }

  /** Trigger a workflow for a contact (FR-028) */
  async triggerWorkflow(
    userId: number,
    locationId: string,
    workflowId: string,
    contactId: string,
    eventData?: Record<string, unknown>
  ) {
    return this.ghl.request({
      method: "POST",
      endpoint: `/contacts/${contactId}/workflow/${workflowId}`,
      locationId,
      userId,
      data: eventData ? { eventData } : undefined,
    });
  }

  /** Remove a contact from a workflow */
  async removeFromWorkflow(
    userId: number,
    locationId: string,
    workflowId: string,
    contactId: string
  ) {
    return this.ghl.request({
      method: "DELETE",
      endpoint: `/contacts/${contactId}/workflow/${workflowId}`,
      locationId,
      userId,
    });
  }

  // ----------------------------------------
  // Messaging (FR-031 through FR-035)
  // ----------------------------------------

  /** Send an SMS message (FR-031) */
  async sendSms(userId: number, locationId: string, contactId: string, message: string) {
    return this.ghl.request<GhlMessageStatus>({
      method: "POST",
      endpoint: "/conversations/messages",
      locationId,
      userId,
      data: { type: "SMS", contactId, message },
    });
  }

  /** Send an email (FR-032) */
  async sendEmail(
    userId: number,
    locationId: string,
    contactId: string,
    options: {
      subject?: string;
      html?: string;
      message?: string;
      emailFrom?: string;
      templateId?: string;
    }
  ) {
    return this.ghl.request<GhlMessageStatus>({
      method: "POST",
      endpoint: "/conversations/messages",
      locationId,
      userId,
      data: { type: "Email", contactId, ...options },
    });
  }

  /** Get message delivery status (FR-033) */
  async getMessageStatus(userId: number, locationId: string, messageId: string) {
    return this.ghl.request<GhlMessageStatus>({
      method: "GET",
      endpoint: `/conversations/messages/${messageId}`,
      locationId,
      userId,
    });
  }

  /** Get conversation messages for a contact */
  async getConversationMessages(userId: number, locationId: string, contactId: string) {
    return this.ghl.request<{ messages: GhlMessageStatus[]; lastMessageId?: string }>({
      method: "GET",
      endpoint: "/conversations/messages",
      locationId,
      userId,
      params: { contactId },
    });
  }

  // ----------------------------------------
  // Templates (FR-036 through FR-039)
  // ----------------------------------------

  /** List email/SMS templates (FR-036) */
  async listTemplates(userId: number, locationId: string, type?: "sms" | "email") {
    const params: Record<string, string> = { locationId };
    if (type) params.type = type;

    return this.ghl.request<{ templates: GhlTemplate[] }>({
      method: "GET",
      endpoint: "/conversations/messages/templates",
      locationId,
      userId,
      params,
    });
  }

  /** Get a specific template */
  async getTemplate(userId: number, locationId: string, templateId: string) {
    return this.ghl.request<{ template: GhlTemplate }>({
      method: "GET",
      endpoint: `/conversations/messages/templates/${templateId}`,
      locationId,
      userId,
    });
  }
}

// ========================================
// SINGLETON
// ========================================

let pipelinesServiceInstance: GhlPipelinesService | null = null;

export function getGhlPipelinesService(): GhlPipelinesService {
  if (!pipelinesServiceInstance) {
    pipelinesServiceInstance = new GhlPipelinesService();
  }
  return pipelinesServiceInstance;
}
