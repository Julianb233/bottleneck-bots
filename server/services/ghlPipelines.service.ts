/**
 * GHL Pipelines, Campaigns, Workflows & Messaging Service
 *
 * Wraps the GHL API for:
 * - Pipelines & Opportunities (FR-015 to FR-021)
 * - Campaigns (FR-022 to FR-025)
 * - Workflows (FR-026, FR-027)
 * - Messaging: SMS & Email (FR-028, FR-029)
 *
 * All methods use the rate-limited, auto-refreshing HTTP client from GHLService.
 *
 * Linear: AI-2870
 */

import { GHLService } from "./ghl.service";

// ========================================
// TYPES — Pipelines & Opportunities
// ========================================

export interface GHLPipelineStage {
  id: string;
  name: string;
  position: number;
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
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  contactId: string;
  monetaryValue?: number;
  assignedTo?: string;
  locationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpportunityData {
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  name: string;
  status?: string;
  monetaryValue?: number;
  assignedTo?: string;
}

export interface UpdateOpportunityData {
  name?: string;
  pipelineStageId?: string;
  status?: string;
  monetaryValue?: number;
  assignedTo?: string;
}

// ========================================
// TYPES — Campaigns
// ========================================

export interface GHLCampaign {
  id: string;
  name: string;
  status: string;
  locationId: string;
}

export interface GHLCampaignStats {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
}

// ========================================
// TYPES — Workflows
// ========================================

export interface GHLWorkflow {
  id: string;
  name: string;
  status: string;
  locationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerWorkflowData {
  contactId: string;
  [key: string]: unknown;
}

// ========================================
// TYPES — Messaging
// ========================================

export interface SendSMSResult {
  conversationId: string;
  messageId: string;
  message: string;
  contactId: string;
}

export interface SendEmailData {
  subject?: string;
  htmlBody?: string;
  altText?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  conversationId: string;
  messageId: string;
  contactId: string;
  emailMessageId?: string;
}

// ========================================
// SERVICE CLASS
// ========================================

export class GHLPipelinesService {
  private ghl: GHLService;

  constructor(ghl: GHLService) {
    this.ghl = ghl;
  }

  // ----------------------------------------
  // Pipelines
  // ----------------------------------------

  /**
   * List all pipelines (with stages) for a location.
   */
  async listPipelines(locationId: string): Promise<GHLPipeline[]> {
    const response = await this.ghl.request<{ pipelines: GHLPipeline[] }>({
      method: "GET",
      endpoint: "/opportunities/pipelines",
      params: { locationId },
    });
    return response.data.pipelines ?? [];
  }

  // ----------------------------------------
  // Opportunities
  // ----------------------------------------

  /**
   * Create an opportunity in a pipeline.
   */
  async createOpportunity(
    locationId: string,
    data: CreateOpportunityData
  ): Promise<GHLOpportunity> {
    const response = await this.ghl.request<{ opportunity: GHLOpportunity }>({
      method: "POST",
      endpoint: "/opportunities/",
      data: { ...data, locationId },
    });
    return response.data.opportunity;
  }

  /**
   * Get a single opportunity by ID.
   */
  async getOpportunity(
    locationId: string,
    opportunityId: string
  ): Promise<GHLOpportunity> {
    const response = await this.ghl.request<{ opportunity: GHLOpportunity }>({
      method: "GET",
      endpoint: `/opportunities/${opportunityId}`,
      params: { locationId },
    });
    return response.data.opportunity;
  }

  /**
   * Update an opportunity.
   */
  async updateOpportunity(
    locationId: string,
    opportunityId: string,
    data: UpdateOpportunityData
  ): Promise<GHLOpportunity> {
    const response = await this.ghl.request<{ opportunity: GHLOpportunity }>({
      method: "PUT",
      endpoint: `/opportunities/${opportunityId}`,
      data: { ...data, locationId },
    });
    return response.data.opportunity;
  }

  /**
   * Delete an opportunity.
   */
  async deleteOpportunity(
    locationId: string,
    opportunityId: string
  ): Promise<{ succeded: boolean }> {
    const response = await this.ghl.request<{ succeded: boolean }>({
      method: "DELETE",
      endpoint: `/opportunities/${opportunityId}`,
      params: { locationId },
    });
    return response.data;
  }

  /**
   * Move an opportunity to a different pipeline stage.
   */
  async moveOpportunityStage(
    locationId: string,
    opportunityId: string,
    stageId: string
  ): Promise<GHLOpportunity> {
    return this.updateOpportunity(locationId, opportunityId, {
      pipelineStageId: stageId,
    });
  }

  /**
   * Assign an opportunity to a user.
   */
  async assignOpportunity(
    locationId: string,
    opportunityId: string,
    userId: string
  ): Promise<GHLOpportunity> {
    return this.updateOpportunity(locationId, opportunityId, {
      assignedTo: userId,
    });
  }

  // ----------------------------------------
  // Campaigns
  // ----------------------------------------

  /**
   * List all campaigns for a location.
   */
  async listCampaigns(locationId: string): Promise<GHLCampaign[]> {
    const response = await this.ghl.request<{ campaigns: GHLCampaign[] }>({
      method: "GET",
      endpoint: "/campaigns/",
      params: { locationId },
    });
    return response.data.campaigns ?? [];
  }

  /**
   * Add a contact to a campaign.
   */
  async addContactToCampaign(
    locationId: string,
    campaignId: string,
    contactId: string
  ): Promise<{ success: boolean }> {
    const response = await this.ghl.request<{ success: boolean }>({
      method: "POST",
      endpoint: `/campaigns/${campaignId}/contacts/${contactId}`,
      data: { locationId },
    });
    return response.data;
  }

  /**
   * Remove a contact from a campaign.
   */
  async removeContactFromCampaign(
    locationId: string,
    campaignId: string,
    contactId: string
  ): Promise<{ success: boolean }> {
    const response = await this.ghl.request<{ success: boolean }>({
      method: "DELETE",
      endpoint: `/campaigns/${campaignId}/contacts/${contactId}`,
      params: { locationId },
    });
    return response.data;
  }

  /**
   * Get campaign statistics.
   */
  async getCampaignStats(
    locationId: string,
    campaignId: string
  ): Promise<GHLCampaignStats> {
    // The GHL API does not have a dedicated stats endpoint; campaign list
    // returns status & contact counts.  We fetch the campaign list and
    // filter to the requested campaignId, then return what the API gives us.
    const campaigns = await this.listCampaigns(locationId);
    const campaign = campaigns.find((c) => c.id === campaignId);

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found in location ${locationId}`);
    }

    // Return the campaign data cast to our stats interface — the GHL response
    // includes these numeric fields when available.
    return campaign as unknown as GHLCampaignStats;
  }

  // ----------------------------------------
  // Workflows
  // ----------------------------------------

  /**
   * List all workflows for a location.
   */
  async listWorkflows(locationId: string): Promise<GHLWorkflow[]> {
    const response = await this.ghl.request<{ workflows: GHLWorkflow[] }>({
      method: "GET",
      endpoint: "/workflows/",
      params: { locationId },
    });
    return response.data.workflows ?? [];
  }

  /**
   * Trigger a workflow for a contact.
   */
  async triggerWorkflow(
    locationId: string,
    workflowId: string,
    data: TriggerWorkflowData
  ): Promise<{ success: boolean }> {
    const response = await this.ghl.request<{ success: boolean }>({
      method: "POST",
      endpoint: `/workflows/${workflowId}/trigger`,
      data: { ...data, locationId },
    });
    return response.data;
  }

  // ----------------------------------------
  // Messaging
  // ----------------------------------------

  /**
   * Send an SMS message to a contact.
   */
  async sendSMS(
    locationId: string,
    contactId: string,
    message: string
  ): Promise<SendSMSResult> {
    const response = await this.ghl.request<SendSMSResult>({
      method: "POST",
      endpoint: "/conversations/messages",
      data: {
        type: "SMS",
        contactId,
        message,
        locationId,
      },
    });
    return response.data;
  }

  /**
   * Send an email to a contact.
   */
  async sendEmail(
    locationId: string,
    contactId: string,
    templateId: string,
    data?: SendEmailData
  ): Promise<SendEmailResult> {
    const response = await this.ghl.request<SendEmailResult>({
      method: "POST",
      endpoint: "/conversations/messages",
      data: {
        type: "Email",
        contactId,
        locationId,
        templateId,
        ...data,
      },
    });
    return response.data;
  }
}

// ========================================
// FACTORY
// ========================================

/**
 * Create a GHLPipelinesService backed by a user's authenticated GHLService.
 */
export function createGHLPipelinesService(
  locationId: string,
  userId: number
): GHLPipelinesService {
  const ghl = new GHLService(locationId, userId);
  return new GHLPipelinesService(ghl);
}
