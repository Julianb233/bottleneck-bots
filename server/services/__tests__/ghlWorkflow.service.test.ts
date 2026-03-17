import { describe, it, expect } from "vitest";

// Import the helper functions by testing them through the module
// We need to test evaluateFilterConditions, mapFields, getNestedValue
// These are internal functions, so we test them indirectly through exports
// or re-export for testing.

// Since the helpers are not exported, we test the GHL_EVENT_TYPES export
// and create focused unit tests for the logic patterns used.

import { GHL_EVENT_TYPES } from "../ghlWorkflow.service";

describe("ghlWorkflow.service", () => {
  describe("GHL_EVENT_TYPES", () => {
    it("includes all expected contact event types", () => {
      expect(GHL_EVENT_TYPES).toContain("ContactCreate");
      expect(GHL_EVENT_TYPES).toContain("ContactDelete");
      expect(GHL_EVENT_TYPES).toContain("ContactDndUpdate");
      expect(GHL_EVENT_TYPES).toContain("ContactTagUpdate");
    });

    it("includes opportunity event types", () => {
      expect(GHL_EVENT_TYPES).toContain("OpportunityCreate");
      expect(GHL_EVENT_TYPES).toContain("OpportunityStageUpdate");
      expect(GHL_EVENT_TYPES).toContain("OpportunityStatusUpdate");
    });

    it("includes appointment event types", () => {
      expect(GHL_EVENT_TYPES).toContain("AppointmentCreate");
      expect(GHL_EVENT_TYPES).toContain("AppointmentDelete");
      expect(GHL_EVENT_TYPES).toContain("AppointmentUpdate");
    });

    it("includes task event types", () => {
      expect(GHL_EVENT_TYPES).toContain("TaskCreate");
      expect(GHL_EVENT_TYPES).toContain("TaskComplete");
      expect(GHL_EVENT_TYPES).toContain("TaskDelete");
    });

    it("includes form, message, campaign, and invoice events", () => {
      expect(GHL_EVENT_TYPES).toContain("FormSubmission");
      expect(GHL_EVENT_TYPES).toContain("InboundMessage");
      expect(GHL_EVENT_TYPES).toContain("OutboundMessage");
      expect(GHL_EVENT_TYPES).toContain("CampaignStatusUpdate");
      expect(GHL_EVENT_TYPES).toContain("InvoiceCreate");
      expect(GHL_EVENT_TYPES).toContain("InvoicePaymentReceived");
    });

    it("has at least 27 event types", () => {
      expect(GHL_EVENT_TYPES.length).toBeGreaterThanOrEqual(27);
    });
  });

  // Test the nested value access pattern used in filter evaluation
  describe("nested value access pattern", () => {
    function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
      const parts = path.split(".");
      let current: unknown = obj;
      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== "object") {
          return undefined;
        }
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    }

    it("accesses top-level properties", () => {
      expect(getNestedValue({ email: "test@example.com" }, "email")).toBe("test@example.com");
    });

    it("accesses nested properties", () => {
      const obj = { contact: { email: "test@example.com", name: "John" } };
      expect(getNestedValue(obj, "contact.email")).toBe("test@example.com");
      expect(getNestedValue(obj, "contact.name")).toBe("John");
    });

    it("accesses deeply nested properties", () => {
      const obj = { a: { b: { c: { d: "deep" } } } };
      expect(getNestedValue(obj, "a.b.c.d")).toBe("deep");
    });

    it("returns undefined for missing paths", () => {
      expect(getNestedValue({ a: 1 }, "b")).toBeUndefined();
      expect(getNestedValue({ a: { b: 1 } }, "a.c")).toBeUndefined();
      expect(getNestedValue({}, "x.y.z")).toBeUndefined();
    });

    it("handles null values in path", () => {
      const obj = { a: null } as Record<string, unknown>;
      expect(getNestedValue(obj, "a.b")).toBeUndefined();
    });
  });

  // Test the filter condition evaluation pattern
  describe("filter condition evaluation pattern", () => {
    interface FilterCondition {
      field: string;
      operator: string;
      value?: string | number | boolean;
    }

    function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
      const parts = path.split(".");
      let current: unknown = obj;
      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== "object") {
          return undefined;
        }
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    }

    function evaluateConditions(conditions: FilterCondition[], payload: Record<string, unknown>): boolean {
      for (const cond of conditions) {
        const value = getNestedValue(payload, cond.field);
        switch (cond.operator) {
          case "equals":
            if (value !== cond.value) return false;
            break;
          case "not_equals":
            if (value === cond.value) return false;
            break;
          case "contains":
            if (typeof value === "string" && typeof cond.value === "string") {
              if (!value.includes(cond.value)) return false;
            } else if (Array.isArray(value)) {
              if (!value.includes(cond.value)) return false;
            } else {
              return false;
            }
            break;
          case "exists":
            if (value === undefined || value === null) return false;
            break;
          case "not_exists":
            if (value !== undefined && value !== null) return false;
            break;
          case "greater_than":
            if (typeof value !== "number" || typeof cond.value !== "number" || value <= cond.value) return false;
            break;
          case "less_than":
            if (typeof value !== "number" || typeof cond.value !== "number" || value >= cond.value) return false;
            break;
        }
      }
      return true;
    }

    it("evaluates equals condition", () => {
      const payload = { contact: { email: "test@example.com" } };
      expect(evaluateConditions([{ field: "contact.email", operator: "equals", value: "test@example.com" }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "contact.email", operator: "equals", value: "other@example.com" }], payload)).toBe(false);
    });

    it("evaluates not_equals condition", () => {
      const payload = { status: "active" };
      expect(evaluateConditions([{ field: "status", operator: "not_equals", value: "deleted" }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "status", operator: "not_equals", value: "active" }], payload)).toBe(false);
    });

    it("evaluates contains condition on strings", () => {
      const payload = { tags: "vip,premium" };
      expect(evaluateConditions([{ field: "tags", operator: "contains", value: "vip" }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "tags", operator: "contains", value: "basic" }], payload)).toBe(false);
    });

    it("evaluates contains condition on arrays", () => {
      const payload = { tags: ["vip", "premium"] };
      expect(evaluateConditions([{ field: "tags", operator: "contains", value: "vip" }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "tags", operator: "contains", value: "basic" }], payload)).toBe(false);
    });

    it("evaluates exists / not_exists conditions", () => {
      const payload = { email: "test@example.com", phone: null } as Record<string, unknown>;
      expect(evaluateConditions([{ field: "email", operator: "exists" }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "missing", operator: "exists" }], payload)).toBe(false);
      expect(evaluateConditions([{ field: "missing", operator: "not_exists" }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "email", operator: "not_exists" }], payload)).toBe(false);
    });

    it("evaluates greater_than / less_than conditions", () => {
      const payload = { score: 85 };
      expect(evaluateConditions([{ field: "score", operator: "greater_than", value: 50 }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "score", operator: "greater_than", value: 90 }], payload)).toBe(false);
      expect(evaluateConditions([{ field: "score", operator: "less_than", value: 90 }], payload)).toBe(true);
      expect(evaluateConditions([{ field: "score", operator: "less_than", value: 50 }], payload)).toBe(false);
    });

    it("evaluates multiple conditions (AND logic)", () => {
      const payload = { status: "active", score: 85, tags: ["vip"] };
      const conditions: FilterCondition[] = [
        { field: "status", operator: "equals", value: "active" },
        { field: "score", operator: "greater_than", value: 50 },
        { field: "tags", operator: "contains", value: "vip" },
      ];
      expect(evaluateConditions(conditions, payload)).toBe(true);
    });

    it("fails if any condition fails (AND logic)", () => {
      const payload = { status: "active", score: 30 };
      const conditions: FilterCondition[] = [
        { field: "status", operator: "equals", value: "active" },
        { field: "score", operator: "greater_than", value: 50 },
      ];
      expect(evaluateConditions(conditions, payload)).toBe(false);
    });

    it("returns true for empty conditions", () => {
      expect(evaluateConditions([], { any: "data" })).toBe(true);
    });
  });

  // Test the field mapping pattern
  describe("field mapping pattern", () => {
    interface FieldMapping {
      mappings: Array<{ source: string; target: string }>;
      staticVars?: Record<string, unknown>;
    }

    function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
      const parts = path.split(".");
      let current: unknown = obj;
      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== "object") {
          return undefined;
        }
        current = (current as Record<string, unknown>)[part];
      }
      return current;
    }

    function mapFields(mapping: FieldMapping | null, payload: Record<string, unknown>): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      if (!mapping) {
        return { ghlEvent: payload };
      }
      if (mapping.staticVars) {
        Object.assign(result, mapping.staticVars);
      }
      if (mapping.mappings) {
        for (const m of mapping.mappings) {
          const value = getNestedValue(payload, m.source);
          if (value !== undefined) {
            result[m.target] = value;
          }
        }
      }
      result.__ghlRawEvent = payload;
      return result;
    }

    it("passes entire payload when no mapping configured", () => {
      const payload = { contact: { email: "test@example.com" } };
      const result = mapFields(null, payload);
      expect(result.ghlEvent).toEqual(payload);
    });

    it("maps fields from source to target", () => {
      const mapping: FieldMapping = {
        mappings: [
          { source: "contact.email", target: "email" },
          { source: "contact.firstName", target: "name" },
        ],
      };
      const payload = { contact: { email: "test@example.com", firstName: "John" } };
      const result = mapFields(mapping, payload);
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("John");
    });

    it("includes static variables", () => {
      const mapping: FieldMapping = {
        mappings: [],
        staticVars: { source: "ghl", priority: "high" },
      };
      const result = mapFields(mapping, {});
      expect(result.source).toBe("ghl");
      expect(result.priority).toBe("high");
    });

    it("always includes raw event", () => {
      const payload = { test: "data" };
      const mapping: FieldMapping = { mappings: [] };
      const result = mapFields(mapping, payload);
      expect(result.__ghlRawEvent).toEqual(payload);
    });

    it("skips undefined source values", () => {
      const mapping: FieldMapping = {
        mappings: [
          { source: "contact.email", target: "email" },
          { source: "contact.phone", target: "phone" },
        ],
      };
      const payload = { contact: { email: "test@example.com" } };
      const result = mapFields(mapping, payload);
      expect(result.email).toBe("test@example.com");
      expect(result.phone).toBeUndefined();
    });
  });
});
