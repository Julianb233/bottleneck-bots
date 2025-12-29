# Zapier Integration - Expert Knowledge Base

## Overview
Zapier connects apps through "Zaps" - automated workflows with triggers and actions. The API enables programmatic Zap management and webhook integrations.

## Core Concepts

### Zap Structure
- **Trigger**: Event that starts the Zap (e.g., "New row in Google Sheets")
- **Action**: Task performed when trigger fires (e.g., "Create contact in HubSpot")
- **Filter**: Conditional logic between steps
- **Path**: Branching logic for multiple outcomes

### Webhooks Integration

#### Webhooks by Zapier (Catch Hook)
Use Zapier as a receiver for your application's events.

```typescript
// 1. Create a Zap with "Webhooks by Zapier" trigger
// 2. Zapier provides a unique webhook URL

// 3. Send data to Zapier
const zapierWebhookUrl = "https://hooks.zapier.com/hooks/catch/123456/abcdef/";

await fetch(zapierWebhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
    name: "John Doe",
    event: "signup",
    timestamp: new Date().toISOString(),
  }),
});
```

#### Webhooks by Zapier (Send Hook)
Zapier sends data to your application.

```typescript
// Your endpoint receives POST requests from Zapier
app.post("/zapier-webhook", async (req, res) => {
  const data = req.body;

  // Process the incoming data
  await processZapierEvent(data);

  res.status(200).json({ success: true });
});
```

### Custom Integration (Zapier Platform)

For building your own Zapier integration:

```javascript
// zapier/index.js
const App = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication: {
    type: 'oauth2',
    test: { url: 'https://api.yourapp.com/me' },
    oauth2Config: {
      authorizeUrl: { url: 'https://yourapp.com/oauth/authorize' },
      getAccessToken: { url: 'https://yourapp.com/oauth/token' },
      refreshAccessToken: { url: 'https://yourapp.com/oauth/token' },
    },
  },

  triggers: {
    newContact: require('./triggers/new_contact'),
  },

  creates: {
    createContact: require('./creates/create_contact'),
  },

  searches: {
    findContact: require('./searches/find_contact'),
  },
};

module.exports = App;
```

#### Trigger Definition
```javascript
// triggers/new_contact.js
module.exports = {
  key: 'new_contact',
  noun: 'Contact',
  display: {
    label: 'New Contact',
    description: 'Triggers when a new contact is created.',
  },

  operation: {
    inputFields: [
      { key: 'list_id', label: 'List', required: false },
    ],

    perform: async (z, bundle) => {
      const response = await z.request({
        url: 'https://api.yourapp.com/contacts',
        params: { since: bundle.meta.page ? undefined : Date.now() - 86400000 },
      });
      return response.data.contacts;
    },

    sample: {
      id: '1',
      email: 'sample@example.com',
      name: 'Sample Contact',
    },
  },
};
```

#### Action Definition
```javascript
// creates/create_contact.js
module.exports = {
  key: 'create_contact',
  noun: 'Contact',
  display: {
    label: 'Create Contact',
    description: 'Creates a new contact.',
  },

  operation: {
    inputFields: [
      { key: 'email', label: 'Email', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'phone', label: 'Phone', required: false },
    ],

    perform: async (z, bundle) => {
      const response = await z.request({
        method: 'POST',
        url: 'https://api.yourapp.com/contacts',
        body: {
          email: bundle.inputData.email,
          name: bundle.inputData.name,
          phone: bundle.inputData.phone,
        },
      });
      return response.data;
    },
  },
};
```

## Common Webhook Patterns

### Lead Capture to CRM
```typescript
// When form submitted, send to Zapier
async function handleFormSubmission(formData: FormData) {
  // Process locally
  const lead = await saveLead(formData);

  // Send to Zapier for CRM sync
  await fetch(process.env.ZAPIER_LEAD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "new_lead",
      lead: {
        id: lead.id,
        email: formData.email,
        name: formData.name,
        company: formData.company,
        source: "website",
        createdAt: new Date().toISOString(),
      },
    }),
  });

  return lead;
}
```

### Event Notifications
```typescript
// Send events to Zapier for multi-app notifications
async function notifyZapier(event: AppEvent) {
  const webhookUrl = getWebhookForEvent(event.type);

  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_type: event.type,
      timestamp: event.timestamp,
      data: event.payload,
      user_id: event.userId,
    }),
  });
}

const EVENT_WEBHOOKS = {
  "user.signup": process.env.ZAPIER_SIGNUP_WEBHOOK,
  "order.completed": process.env.ZAPIER_ORDER_WEBHOOK,
  "subscription.cancelled": process.env.ZAPIER_CHURN_WEBHOOK,
};
```

### Batch Processing
```typescript
// Zapier Webhooks can receive arrays
async function syncBatchToZapier(records: Record[]) {
  // Zapier prefers individual records, so chunk if needed
  const chunks = chunkArray(records, 100);

  for (const chunk of chunks) {
    await fetch(process.env.ZAPIER_BATCH_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: chunk,
        batch_id: generateBatchId(),
        total_count: records.length,
      }),
    });

    // Rate limit - Zapier recommends max 1 request/second
    await delay(1000);
  }
}
```

### Receiving Zapier Actions
```typescript
// Endpoint to receive Zapier POST requests
app.post("/api/zapier/create-task", async (req, res) => {
  // Validate Zapier signature (if using signed webhooks)
  if (!validateZapierSignature(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { title, description, due_date, assignee } = req.body;

  try {
    const task = await createTask({
      title,
      description,
      dueDate: new Date(due_date),
      assigneeEmail: assignee,
    });

    // Zapier expects a 2xx response with created object
    res.status(201).json({
      id: task.id,
      title: task.title,
      created_at: task.createdAt,
    });
  } catch (error) {
    // Zapier will retry on 4xx/5xx errors
    res.status(500).json({ error: error.message });
  }
});
```

## Zapier API (for Zap Management)

### List Zaps
```typescript
GET https://api.zapier.com/v1/zaps
Authorization: Bearer {api_key}
```

### Get Zap Details
```typescript
GET https://api.zapier.com/v1/zaps/{zap_id}
```

### Enable/Disable Zap
```typescript
PATCH https://api.zapier.com/v1/zaps/{zap_id}
{
  "is_enabled": true
}
```

## Best Practices

### Webhook Design
1. **Idempotency**: Include unique IDs so Zapier can deduplicate
2. **Timestamps**: Always include ISO 8601 timestamps
3. **Flat data**: Avoid deeply nested objects when possible
4. **Clear naming**: Use descriptive field names

### Error Handling
```typescript
// Implement retry logic for failed webhooks
async function sendToZapierWithRetry(url: string, data: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok && attempt < maxRetries) {
        await delay(1000 * attempt); // Exponential backoff
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await delay(1000 * attempt);
    }
  }
}
```

### Testing
- Use Zapier's webhook testing tools
- Log all webhook payloads for debugging
- Set up separate webhooks for dev/staging/prod

## Rate Limits
- Webhooks: No hard limit, but 1 request/second recommended
- API: 100 requests per minute
- Zap executions: Based on plan (100-50,000/month)

## Common Zapier Apps to Integrate With
- Google Sheets (data storage)
- Slack (notifications)
- Gmail (email)
- Salesforce (CRM)
- HubSpot (CRM)
- Mailchimp (email marketing)
- Trello (project management)
- Airtable (database)
- Notion (documentation)
