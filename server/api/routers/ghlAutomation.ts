/**
 * GHL Automation tRPC Router
 * Exposes all 48 GoHighLevel automation functions as type-safe API endpoints
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { Stagehand } from "@browserbasehq/stagehand";
import { browserbaseSDK } from "../../_core/browserbaseSDK";

// Import all automation function modules
import {
  contactCreate, contactImportCsv, contactEdit,
  contactAddTags, contactDelete, customFieldCreate, smartListCreate,
} from "../../workflows/ghl/contacts";
import {
  workflowCreate, workflowEdit, workflowDuplicate,
  workflowDelete, workflowTest,
} from "../../workflows/ghl/workflows-automation";
import {
  funnelCreate, funnelPageEdit, formCreate, websiteCreate,
} from "../../workflows/ghl/funnels";
import {
  emailCampaignCreate, emailTemplateCreate, emailAbTest,
} from "../../workflows/ghl/email-marketing";
import {
  smsCampaignCreate, smsTemplateCreate,
} from "../../workflows/ghl/sms-marketing";
import {
  calendarCreate, appointmentTypeCreate, appointmentBook,
  appointmentReschedule, appointmentCancel,
} from "../../workflows/ghl/calendars";
import {
  pipelineCreate, opportunityCreate, opportunityUpdateStage,
} from "../../workflows/ghl/opportunities";
import {
  conversationSendMessage, conversationAiSetup,
} from "../../workflows/ghl/conversations";
import {
  reviewRequestCreate, reviewMonitor,
} from "../../workflows/ghl/reputation";
import { socialPostCreate } from "../../workflows/ghl/social";
import { membershipCreate, courseCreate } from "../../workflows/ghl/memberships";
import {
  productCreate, orderFormCreate, stripeConnect,
} from "../../workflows/ghl/payments";
import { dashboardView, reportCreate } from "../../workflows/ghl/reporting";
import {
  subaccountCreate, userCreate, integrationSetup, customDomainSetup,
} from "../../workflows/ghl/settings-automation";
import { triggerLinkCreate } from "../../workflows/ghl/trigger-links";
import { surveyCreate } from "../../workflows/ghl/surveys";
import { taskCreate } from "../../workflows/ghl/tasks-automation";

// Import schemas
import {
  contactCreateSchema, contactEditSchema, contactTagSchema,
  contactDeleteSchema, contactImportSchema, customFieldCreateSchema,
  smartListCreateSchema, workflowCreateSchema, workflowEditSchema,
  workflowDuplicateSchema, workflowDeleteSchema, workflowTestSchema,
  funnelCreateSchema, funnelPageEditSchema, formCreateSchema,
  websiteCreateSchema, emailCampaignCreateSchema, emailTemplateCreateSchema,
  emailAbTestSchema, smsCampaignCreateSchema, smsTemplateCreateSchema,
  calendarCreateSchema, appointmentTypeCreateSchema, appointmentBookSchema,
  appointmentRescheduleSchema, appointmentCancelSchema,
  pipelineCreateSchema, opportunityCreateSchema, opportunityUpdateStageSchema,
  conversationSendMessageSchema, conversationAiSetupSchema,
  reviewRequestCreateSchema, reviewMonitorSchema, socialPostCreateSchema,
  membershipCreateSchema, courseCreateSchema,
  productCreateSchema, orderFormCreateSchema, stripeConnectSchema,
  dashboardViewSchema, reportCreateSchema,
  subaccountCreateSchema, userCreateSchema, integrationSetupSchema,
  customDomainSetupSchema, triggerLinkCreateSchema, surveyCreateSchema,
  taskCreateSchema,
  FUNCTION_TIERS,
  type GHLFunctionId,
  type GHLAutomationContext,
} from "../../workflows/ghl/types";

// Common input wrapper: every mutation needs a sessionId and locationId
const automationInputBase = z.object({
  sessionId: z.string().min(1).describe("BrowserBase session ID with active GHL login"),
  locationId: z.string().min(1).describe("GHL location/sub-account ID"),
});

/**
 * Helper to get or create a Stagehand instance for a session.
 * In production this would reuse existing sessions; here we create a fresh connection.
 */
async function getStagehandForSession(sessionId: string): Promise<Stagehand> {
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    browserbaseSessionID: sessionId,
  });
  await stagehand.init();
  return stagehand;
}

function makeCtx(locationId: string): GHLAutomationContext {
  return { locationId };
}

export const ghlAutomationRouter = router({
  // ============================================================
  // META: List available functions and their tiers
  // ============================================================
  listFunctions: protectedProcedure
    .query(() => {
      return {
        functions: Object.entries(FUNCTION_TIERS).map(([id, tier]) => ({
          id: id as GHLFunctionId,
          tier,
          module: getModule(id as GHLFunctionId),
        })),
        totalCount: Object.keys(FUNCTION_TIERS).length,
        tierCounts: {
          tier1: Object.values(FUNCTION_TIERS).filter(t => t === 1).length,
          tier2: Object.values(FUNCTION_TIERS).filter(t => t === 2).length,
          tier3: Object.values(FUNCTION_TIERS).filter(t => t === 3).length,
          tier4: Object.values(FUNCTION_TIERS).filter(t => t === 4).length,
        },
      };
    }),

  // ============================================================
  // MODULE 1: CONTACTS & CRM (7 functions)
  // ============================================================
  contactCreate: protectedProcedure
    .input(automationInputBase.extend({ data: contactCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await contactCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  contactImportCsv: protectedProcedure
    .input(automationInputBase.extend({ data: contactImportSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await contactImportCsv(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  contactEdit: protectedProcedure
    .input(automationInputBase.extend({ data: contactEditSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await contactEdit(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  contactAddTags: protectedProcedure
    .input(automationInputBase.extend({ data: contactTagSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await contactAddTags(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  contactDelete: protectedProcedure
    .input(automationInputBase.extend({ data: contactDeleteSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await contactDelete(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  customFieldCreate: protectedProcedure
    .input(automationInputBase.extend({ data: customFieldCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await customFieldCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  smartListCreate: protectedProcedure
    .input(automationInputBase.extend({ data: smartListCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await smartListCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 2: WORKFLOWS & AUTOMATION (5 functions)
  // ============================================================
  workflowCreate: protectedProcedure
    .input(automationInputBase.extend({ data: workflowCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await workflowCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  workflowEdit: protectedProcedure
    .input(automationInputBase.extend({ data: workflowEditSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await workflowEdit(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  workflowDuplicate: protectedProcedure
    .input(automationInputBase.extend({ data: workflowDuplicateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await workflowDuplicate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  workflowDelete: protectedProcedure
    .input(automationInputBase.extend({ data: workflowDeleteSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await workflowDelete(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  workflowTest: protectedProcedure
    .input(automationInputBase.extend({ data: workflowTestSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await workflowTest(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 3: FUNNELS & WEBSITES (4 functions)
  // ============================================================
  funnelCreate: protectedProcedure
    .input(automationInputBase.extend({ data: funnelCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await funnelCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  funnelPageEdit: protectedProcedure
    .input(automationInputBase.extend({ data: funnelPageEditSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await funnelPageEdit(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  formCreate: protectedProcedure
    .input(automationInputBase.extend({ data: formCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await formCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  websiteCreate: protectedProcedure
    .input(automationInputBase.extend({ data: websiteCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await websiteCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 4: EMAIL MARKETING (3 functions)
  // ============================================================
  emailCampaignCreate: protectedProcedure
    .input(automationInputBase.extend({ data: emailCampaignCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await emailCampaignCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  emailTemplateCreate: protectedProcedure
    .input(automationInputBase.extend({ data: emailTemplateCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await emailTemplateCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  emailAbTest: protectedProcedure
    .input(automationInputBase.extend({ data: emailAbTestSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await emailAbTest(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 5: SMS MARKETING (2 functions)
  // ============================================================
  smsCampaignCreate: protectedProcedure
    .input(automationInputBase.extend({ data: smsCampaignCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await smsCampaignCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  smsTemplateCreate: protectedProcedure
    .input(automationInputBase.extend({ data: smsTemplateCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await smsTemplateCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 6: CALENDARS & APPOINTMENTS (5 functions)
  // ============================================================
  calendarCreate: protectedProcedure
    .input(automationInputBase.extend({ data: calendarCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await calendarCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  appointmentTypeCreate: protectedProcedure
    .input(automationInputBase.extend({ data: appointmentTypeCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await appointmentTypeCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  appointmentBook: protectedProcedure
    .input(automationInputBase.extend({ data: appointmentBookSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await appointmentBook(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  appointmentReschedule: protectedProcedure
    .input(automationInputBase.extend({ data: appointmentRescheduleSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await appointmentReschedule(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  appointmentCancel: protectedProcedure
    .input(automationInputBase.extend({ data: appointmentCancelSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await appointmentCancel(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 7: OPPORTUNITIES & PIPELINES (3 functions)
  // ============================================================
  pipelineCreate: protectedProcedure
    .input(automationInputBase.extend({ data: pipelineCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await pipelineCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  opportunityCreate: protectedProcedure
    .input(automationInputBase.extend({ data: opportunityCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await opportunityCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  opportunityUpdateStage: protectedProcedure
    .input(automationInputBase.extend({ data: opportunityUpdateStageSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await opportunityUpdateStage(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 8: CONVERSATIONS & MESSAGING (2 functions)
  // ============================================================
  conversationSendMessage: protectedProcedure
    .input(automationInputBase.extend({ data: conversationSendMessageSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await conversationSendMessage(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  conversationAiSetup: protectedProcedure
    .input(automationInputBase.extend({ data: conversationAiSetupSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await conversationAiSetup(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 9: REPUTATION MANAGEMENT (2 functions)
  // ============================================================
  reviewRequestCreate: protectedProcedure
    .input(automationInputBase.extend({ data: reviewRequestCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await reviewRequestCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  reviewMonitor: protectedProcedure
    .input(automationInputBase.extend({ data: reviewMonitorSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await reviewMonitor(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 10: SOCIAL PLANNER (1 function)
  // ============================================================
  socialPostCreate: protectedProcedure
    .input(automationInputBase.extend({ data: socialPostCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await socialPostCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 11: MEMBERSHIPS & COURSES (2 functions)
  // ============================================================
  membershipCreate: protectedProcedure
    .input(automationInputBase.extend({ data: membershipCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await membershipCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  courseCreate: protectedProcedure
    .input(automationInputBase.extend({ data: courseCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await courseCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 12: PAYMENTS & COMMERCE (3 functions)
  // ============================================================
  productCreate: protectedProcedure
    .input(automationInputBase.extend({ data: productCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await productCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  orderFormCreate: protectedProcedure
    .input(automationInputBase.extend({ data: orderFormCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await orderFormCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  stripeConnect: protectedProcedure
    .input(automationInputBase.extend({ data: stripeConnectSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await stripeConnect(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 13: REPORTING & ANALYTICS (2 functions)
  // ============================================================
  dashboardView: protectedProcedure
    .input(automationInputBase.extend({ data: dashboardViewSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await dashboardView(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  reportCreate: protectedProcedure
    .input(automationInputBase.extend({ data: reportCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await reportCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 14: SETTINGS & CONFIGURATION (4 functions)
  // ============================================================
  subaccountCreate: protectedProcedure
    .input(automationInputBase.extend({ data: subaccountCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await subaccountCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  userCreate: protectedProcedure
    .input(automationInputBase.extend({ data: userCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await userCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  integrationSetup: protectedProcedure
    .input(automationInputBase.extend({ data: integrationSetupSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await integrationSetup(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  customDomainSetup: protectedProcedure
    .input(automationInputBase.extend({ data: customDomainSetupSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await customDomainSetup(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 15: TRIGGER LINKS (1 function)
  // ============================================================
  triggerLinkCreate: protectedProcedure
    .input(automationInputBase.extend({ data: triggerLinkCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await triggerLinkCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 16: FORMS / SURVEYS (1 function)
  // ============================================================
  surveyCreate: protectedProcedure
    .input(automationInputBase.extend({ data: surveyCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await surveyCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),

  // ============================================================
  // MODULE 17: TASKS (1 function)
  // ============================================================
  taskCreate: protectedProcedure
    .input(automationInputBase.extend({ data: taskCreateSchema }))
    .mutation(async ({ input }) => {
      const stagehand = await getStagehandForSession(input.sessionId);
      try {
        return await taskCreate(stagehand, makeCtx(input.locationId), input.data);
      } finally {
        await stagehand.close().catch(() => {});
      }
    }),
});

// Helper to categorize functions by module
function getModule(id: GHLFunctionId): string {
  if (id.startsWith("contact_") || id === "custom_field_create" || id === "smart_list_create") return "contacts";
  if (id.startsWith("workflow_")) return "workflows";
  if (id.startsWith("funnel_") || id === "form_create" || id === "website_create") return "funnels";
  if (id.startsWith("email_")) return "email_marketing";
  if (id.startsWith("sms_")) return "sms_marketing";
  if (id.startsWith("calendar_") || id.startsWith("appointment_")) return "calendars";
  if (id.startsWith("pipeline_") || id.startsWith("opportunity_")) return "opportunities";
  if (id.startsWith("conversation_")) return "conversations";
  if (id.startsWith("review_")) return "reputation";
  if (id.startsWith("social_")) return "social";
  if (id.startsWith("membership_") || id === "course_create") return "memberships";
  if (id.startsWith("product_") || id.startsWith("order_") || id === "stripe_connect") return "payments";
  if (id.startsWith("dashboard_") || id === "report_create") return "reporting";
  if (id.startsWith("subaccount_") || id.startsWith("user_") || id.startsWith("integration_") || id === "custom_domain_setup") return "settings";
  if (id === "trigger_link_create") return "trigger_links";
  if (id === "survey_create") return "surveys";
  if (id === "task_create") return "tasks";
  return "unknown";
}
