import { trpc } from '@/lib/trpc';

export function useAICalling() {
  const createCampaign = trpc.aiCalling.createCampaign.useMutation();
  const startCampaign = trpc.aiCalling.startCampaign.useMutation();
  const pauseCampaign = trpc.aiCalling.pauseCampaign.useMutation();
  const getCampaign = trpc.aiCalling.getCampaign.useQuery;
  const getCampaigns = trpc.aiCalling.getCampaigns.useQuery;
  const getCalls = trpc.aiCalling.getCalls.useQuery;
  const getCall = trpc.aiCalling.getCall.useQuery;
  const makeCall = trpc.aiCalling.makeCall.useMutation();
  const updateCall = trpc.aiCalling.updateCall.useMutation();
  const updateCampaign = trpc.aiCalling.updateCampaign.useMutation();
  const syncCallStatus = trpc.aiCalling.syncCallStatus.useMutation();
  const deleteCampaign = trpc.aiCalling.deleteCampaign.useMutation();

  // Campaign contact operations
  const addContacts = trpc.aiCalling.addContacts.useMutation();
  const removeContacts = trpc.aiCalling.removeContacts.useMutation();
  const getContacts = trpc.aiCalling.getContacts.useQuery;
  const updateContactStatus = trpc.aiCalling.updateContactStatus.useMutation();

  // Engagement tracking
  const logEvent = trpc.aiCalling.logEvent.useMutation();
  const getEngagementMetrics = trpc.aiCalling.getEngagementMetrics.useQuery;
  const getEventTimeline = trpc.aiCalling.getEventTimeline.useQuery;

  return {
    createCampaign,
    startCampaign,
    pauseCampaign,
    getCampaign,
    getCampaigns,
    getCalls,
    getCall,
    makeCall,
    updateCall,
    updateCampaign,
    syncCallStatus,
    deleteCampaign,
    // Contact operations
    addContacts,
    removeContacts,
    getContacts,
    updateContactStatus,
    // Engagement tracking
    logEvent,
    getEngagementMetrics,
    getEventTimeline,
  };
}
