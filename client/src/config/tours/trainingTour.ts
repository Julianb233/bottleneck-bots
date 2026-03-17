import { Tour } from '@/stores/tourStore';

export const trainingTour: Tour = {
  id: 'training',
  name: 'Agent Training',
  description: 'Learn how to train your AI agent with documents, workflows, and custom skills',
  icon: '🎓',
  estimatedTime: '3 min',
  steps: [
    {
      target: '[data-tour="training-header"]',
      title: 'Welcome to Agent Training',
      content: 'This is where you teach your AI agent how your agency works. Upload SOPs, define workflows, configure skills, and set behavior preferences.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="training-tabs"]',
      title: 'Training Tabs',
      content: 'Training is organized into tabs: Documents for uploading SOPs, Knowledge for browsing what your agent knows, Workflows for step-by-step processes, Skills for toggling capabilities, Behavior for personality settings, and Escalation for when to hand off to humans.',
      placement: 'bottom',
    },
  ],
};
