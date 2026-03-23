/**
 * Unit Tests for GHL Service Layer
 *
 * Tests core GHL API interactions:
 * - Contact operations (search, create, update, tags)
 * - Opportunity/pipeline operations
 * - Campaign management
 * - Workflow triggering
 * - Communication (SMS, Email)
 * - Appointments
 * - Error handling and token refresh
 *
 * Mocks HTTP requests and database calls.
 * Linear: AI-3461
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GHLService, GHLError } from "./ghl.service";
import { getCredentialVault } from "./credentialVault.service";

// Mock the credential vault
vi.mock("./credentialVault.service");

// Mock fetch globally
global.fetch = vi.fn();

describe("GHL Service Layer", () => {
  const mockLocationId = "test-location-123";
  const mockUserId = 1;
  const mockAccessToken = "test-access-token";
  const mockRefreshToken = "test-refresh-token";

  let service: GHLService;
  let mockVault: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GHLService(mockLocationId, mockUserId);

    // Mock credential vault
    mockVault = {
      getEncrypted: vi.fn(),
      setEncrypted: vi.fn(),
    };
    vi.mocked(getCredentialVault).mockResolvedValue(mockVault);

    // Clear fetch mocks
    vi.mocked(global.fetch).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // Token Management Tests
  // ========================================

  describe("Token Management", () => {
    it("should retrieve access token from vault", async () => {
      const tokenSetJson = JSON.stringify({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Date.now() + 3600000,
        tokenType: "Bearer",
        scope: "contacts.write opportunities.write",
        locationId: mockLocationId,
        companyId: "company-123",
        userId: "user-456",
      });

      mockVault.getEncrypted.mockResolvedValue(tokenSetJson);

      const token = await service.getAccessToken();
      expect(token).toBe(mockAccessToken);
      expect(mockVault.getEncrypted).toHaveBeenCalledWith(
        expect.stringContaining("ghl"),
        expect.any(String)
      );
    });

    it("should refresh token when approaching expiry", async () => {
      const expiredTokenSetJson = JSON.stringify({
        accessToken: "old-token",
        refreshToken: mockRefreshToken,
        expiresAt: Date.now() + 100000,
        tokenType: "Bearer",
        scope: "contacts.write",
        locationId: mockLocationId,
        companyId: "company-123",
        userId: "user-456",
      });

      mockVault.getEncrypted.mockResolvedValue(expiredTokenSetJson);

      const newTokenResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "contacts.write",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(newTokenResponse), { status: 200 })
      );

      mockVault.setEncrypted.mockResolvedValue(undefined);

      const token = await service.getAccessToken();
      expect(token).toBe("new-access-token");
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/oauth/token"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should throw GHLError with auth category when token refresh fails", async () => {
      const tokenSetJson = JSON.stringify({
        accessToken: "old-token",
        refreshToken: "invalid-token",
        expiresAt: Date.now() + 100000,
        tokenType: "Bearer",
        scope: "contacts.write",
        locationId: mockLocationId,
        companyId: "company-123",
        userId: "user-456",
      });

      mockVault.getEncrypted.mockResolvedValue(tokenSetJson);

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response("Invalid refresh token", { status: 401 })
      );

      await expect(service.getAccessToken()).rejects.toThrow(GHLError);
    });
  });

  // ========================================
  // Contact Operations Tests
  // ========================================

  describe("Contact Operations", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "contacts.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should search contacts with query parameters", async () => {
      const mockResponse = {
        contacts: [
          {
            id: "contact-123",
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            phone: "+1234567890",
            tags: ["vip"],
          },
        ],
        count: 1,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.searchContacts({
        query: "john",
        limit: 10,
      });

      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/contacts/search"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Bearer"),
          }),
        })
      );
    });

    it("should handle empty search results", async () => {
      const mockResponse = {
        contacts: [],
        count: 0,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.searchContacts({ query: "nonexistent" });
      expect(result.contacts).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it("should create a contact with required fields", async () => {
      const newContact = {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        phone: "+1987654321",
      };

      const mockResponse = {
        id: "contact-456",
        ...newContact,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 201 })
      );

      const result = await service.createContact(newContact);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/contacts"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Jane"),
        })
      );
    });

    it("should update a contact", async () => {
      const contactId = "contact-123";
      const updates = {
        firstName: "Jonathan",
        tags: ["premium"],
      };

      const mockResponse = {
        id: contactId,
        firstName: "Jonathan",
        lastName: "Doe",
        tags: ["premium"],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.updateContact(contactId, updates);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/contacts/${contactId}`),
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should add tags to a contact", async () => {
      const contactId = "contact-123";
      const tags = ["vip", "premium"];

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.addContactTags(contactId, tags);
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/contacts/${contactId}/tags`),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("vip"),
        })
      );
    });

    it("should remove tags from a contact", async () => {
      const contactId = "contact-123";
      const tags = ["old-tag"];

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.removeContactTags(contactId, tags);
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/contacts/${contactId}/tags`),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should merge contacts", async () => {
      const params = {
        primaryContactId: "contact-123",
        mergeContactId: "contact-456",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.mergeContacts(params);
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/contacts/merge"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should bulk import contacts", async () => {
      const contacts = [
        { firstName: "Alice", email: "alice@example.com" },
        { firstName: "Bob", email: "bob@example.com" },
      ];

      const mockResponse = {
        imported: 2,
        failed: 0,
        errors: [],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.bulkImportContacts(contacts);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/contacts/bulk"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  // ========================================
  // Pipeline & Opportunity Tests
  // ========================================

  describe("Pipeline & Opportunity Operations", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "opportunities.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should list pipelines", async () => {
      const mockResponse = {
        pipelines: [
          {
            id: "pipeline-1",
            name: "Sales Pipeline",
            stages: [
              { id: "stage-1", name: "Lead" },
              { id: "stage-2", name: "Proposal" },
            ],
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.listPipelines();
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/pipelines"),
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("should create an opportunity with required fields", async () => {
      const newOpp = {
        name: "Big Deal",
        pipelineId: "pipeline-1",
        pipelineStageId: "stage-1",
        contactId: "contact-123",
      };

      const mockResponse = {
        id: "opp-123",
        ...newOpp,
        status: "open",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 201 })
      );

      const result = await service.createOpportunity(newOpp);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/opportunities"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Big Deal"),
        })
      );
    });

    it("should update an opportunity", async () => {
      const oppId = "opp-123";
      const updates = {
        pipelineStageId: "stage-2",
        monetaryValue: 50000,
      };

      const mockResponse = {
        id: oppId,
        name: "Big Deal",
        pipelineId: "pipeline-1",
        pipelineStageId: "stage-2",
        monetaryValue: 50000,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.updateOpportunity(oppId, updates);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/opportunities/${oppId}`),
        expect.objectContaining({
          method: "PUT",
        })
      );
    });
  });

  // ========================================
  // Campaign Tests
  // ========================================

  describe("Campaign Operations", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "campaigns.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should list campaigns", async () => {
      const mockResponse = {
        campaigns: [
          {
            id: "campaign-1",
            name: "Summer Sale",
            status: "active",
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.listCampaigns();
      expect(result).toEqual(mockResponse);
    });

    it("should add contact to campaign", async () => {
      const campaignId = "campaign-1";
      const contactId = "contact-123";

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.addContactToCampaign(campaignId, contactId);
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/campaigns/${campaignId}/contacts`),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should remove contact from campaign", async () => {
      const campaignId = "campaign-1";
      const contactId = "contact-123";

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.removeContactFromCampaign(
        campaignId,
        contactId
      );
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/campaigns/${campaignId}/contacts`),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should get campaign stats", async () => {
      const campaignId = "campaign-1";
      const mockResponse = {
        campaignId,
        totalContacts: 1000,
        opened: 500,
        clicked: 250,
        conversions: 50,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.getCampaignStats(campaignId);
      expect(result).toEqual(mockResponse);
    });
  });

  // ========================================
  // Workflow Tests
  // ========================================

  describe("Workflow Operations", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "workflows.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should list workflows", async () => {
      const mockResponse = {
        workflows: [
          {
            id: "workflow-1",
            name: "Welcome Series",
            status: "active",
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.listWorkflows();
      expect(result).toEqual(mockResponse);
    });

    it("should trigger a workflow", async () => {
      const workflowId = "workflow-1";
      const contactId = "contact-123";

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.triggerWorkflow(workflowId, contactId);
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/workflows/${workflowId}/trigger`),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(contactId),
        })
      );
    });
  });

  // ========================================
  // Communication Tests
  // ========================================

  describe("Communication Operations", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "conversations.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should send SMS to contact", async () => {
      const contactId = "contact-123";
      const message = "Hello there!";

      const mockResponse = {
        id: "message-123",
        status: "sent",
        contactId,
        type: "SMS",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 201 })
      );

      const result = await service.sendSMS(contactId, message);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/messages"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("SMS"),
        })
      );
    });

    it("should send email to contact", async () => {
      const contactId = "contact-123";
      const subject = "Important Update";
      const body = "This is an important message";

      const mockResponse = {
        id: "message-456",
        status: "sent",
        contactId,
        type: "Email",
        subject,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 201 })
      );

      const result = await service.sendEmail(contactId, subject, body);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/messages"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Email"),
        })
      );
    });

    it("should get message status", async () => {
      const messageId = "message-123";
      const mockResponse = {
        id: messageId,
        status: "delivered",
        deliveredAt: "2026-03-23T10:00:00Z",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.getMessageStatus(messageId);
      expect(result).toEqual(mockResponse);
    });

    it("should list templates", async () => {
      const mockResponse = {
        templates: [
          {
            id: "template-1",
            name: "Welcome SMS",
            type: "sms",
            body: "Welcome to our service!",
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.listTemplates("sms");
      expect(result).toEqual(mockResponse);
    });
  });

  // ========================================
  // Appointment Tests
  // ========================================

  describe("Appointment Operations", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "calendars.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should create an appointment", async () => {
      const appointmentData = {
        calendarId: "calendar-1",
        contactId: "contact-123",
        title: "Consultation",
        startTime: "2026-03-24T10:00:00Z",
        endTime: "2026-03-24T11:00:00Z",
      };

      const mockResponse = {
        id: "apt-123",
        ...appointmentData,
        status: "scheduled",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 201 })
      );

      const result = await service.createAppointment(appointmentData);
      expect(result).toEqual(mockResponse);
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/appointments"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should get an appointment", async () => {
      const appointmentId = "apt-123";
      const mockResponse = {
        id: appointmentId,
        title: "Consultation",
        startTime: "2026-03-24T10:00:00Z",
        endTime: "2026-03-24T11:00:00Z",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.getAppointment(appointmentId);
      expect(result).toEqual(mockResponse);
    });

    it("should update an appointment", async () => {
      const appointmentId = "apt-123";
      const updates = {
        title: "Extended Consultation",
        endTime: "2026-03-24T12:00:00Z",
      };

      const mockResponse = {
        id: appointmentId,
        ...updates,
        startTime: "2026-03-24T10:00:00Z",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.updateAppointment(appointmentId, updates);
      expect(result).toEqual(mockResponse);
    });

    it("should delete an appointment", async () => {
      const appointmentId = "apt-123";

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

      const result = await service.deleteAppointment(appointmentId);
      expect(result).toBeDefined();
      expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
        expect.stringContaining(`/appointments/${appointmentId}`),
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should get appointment availability", async () => {
      const calendarId = "calendar-1";
      const mockResponse = {
        slots: [
          {
            startTime: "2026-03-24T10:00:00Z",
            endTime: "2026-03-24T11:00:00Z",
          },
          {
            startTime: "2026-03-24T14:00:00Z",
            endTime: "2026-03-24T15:00:00Z",
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await service.getAvailability(calendarId);
      expect(result).toEqual(mockResponse);
    });
  });

  // ========================================
  // Error Handling Tests
  // ========================================

  describe("Error Handling", () => {
    beforeEach(() => {
      mockVault.getEncrypted.mockResolvedValue(
        JSON.stringify({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken,
          expiresAt: Date.now() + 3600000,
          tokenType: "Bearer",
          scope: "contacts.write",
          locationId: mockLocationId,
          companyId: "company-123",
          userId: "user-456",
        })
      );
    });

    it("should throw GHLError with auth category for 401 responses", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
      );

      await expect(service.searchContacts({ query: "test" })).rejects.toThrow(
        GHLError
      );
    });

    it("should throw GHLError with rate_limit category for 429 responses", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
        })
      );

      await expect(service.searchContacts({ query: "test" })).rejects.toThrow(
        GHLError
      );
    });

    it("should throw GHLError with server category for 500 responses", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Internal server error" }), {
          status: 500,
        })
      );

      await expect(service.searchContacts({ query: "test" })).rejects.toThrow(
        GHLError
      );
    });

    it("should mark retryable errors appropriately", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Temporary error" }), {
          status: 503,
        })
      );

      const error: any = await service
        .searchContacts({ query: "test" })
        .catch((e) => e);
      expect(error.retryable).toBe(true);
    });
  });
});
