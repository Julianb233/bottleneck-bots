# GoHighLevel API - Expert Knowledge Base

## Overview
GoHighLevel (GHL) is an all-in-one marketing and CRM platform. The API enables automation of contacts, opportunities, calendars, messaging, and more.

## Authentication

### OAuth 2.0 Flow
```typescript
// Authorization URL
const authUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${redirectUri}&client_id=${clientId}&scope=${scopes}`;

// Exchange code for tokens
const tokenResponse = await fetch("https://services.leadconnectorhq.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code: authCode,
    redirect_uri: redirectUri,
  }),
});

const { access_token, refresh_token, expires_in } = await tokenResponse.json();
```

### API Key (Legacy)
```typescript
const headers = {
  "Authorization": `Bearer ${accessToken}`,
  "Version": "2021-07-28",
  "Content-Type": "application/json",
};
```

## Base URL
```
https://services.leadconnectorhq.com
```

## Core Endpoints

### Contacts

#### Create Contact
```typescript
POST /contacts/
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "locationId": "location_id",
  "tags": ["lead", "website"],
  "customFields": [
    { "key": "company", "value": "Acme Inc" }
  ]
}
```

#### Get Contact
```typescript
GET /contacts/{contactId}
```

#### Update Contact
```typescript
PUT /contacts/{contactId}
{
  "firstName": "John",
  "tags": ["customer", "premium"]
}
```

#### Search Contacts
```typescript
GET /contacts/?locationId={locationId}&query={searchQuery}&limit=20
```

#### Add Tags
```typescript
POST /contacts/{contactId}/tags
{
  "tags": ["new_tag", "another_tag"]
}
```

### Opportunities (Deals)

#### Create Opportunity
```typescript
POST /opportunities/
{
  "pipelineId": "pipeline_id",
  "pipelineStageId": "stage_id",
  "locationId": "location_id",
  "contactId": "contact_id",
  "name": "New Deal",
  "monetaryValue": 5000,
  "status": "open"
}
```

#### Update Pipeline Stage
```typescript
PUT /opportunities/{opportunityId}
{
  "pipelineStageId": "new_stage_id"
}
```

#### Search Opportunities
```typescript
GET /opportunities/search?locationId={locationId}&pipelineId={pipelineId}&status=open
```

### Conversations (Messaging)

#### Send SMS
```typescript
POST /conversations/messages
{
  "type": "SMS",
  "contactId": "contact_id",
  "message": "Hello! This is your appointment reminder."
}
```

#### Send Email
```typescript
POST /conversations/messages
{
  "type": "Email",
  "contactId": "contact_id",
  "subject": "Your Quote",
  "message": "<html><body>Here is your quote...</body></html>",
  "emailFrom": "sales@company.com"
}
```

#### Get Conversation History
```typescript
GET /conversations/{conversationId}/messages
```

### Calendars

#### Get Available Slots
```typescript
GET /calendars/{calendarId}/free-slots?startDate=2024-01-15&endDate=2024-01-20&timezone=America/New_York
```

#### Create Appointment
```typescript
POST /calendars/events/appointments
{
  "calendarId": "calendar_id",
  "locationId": "location_id",
  "contactId": "contact_id",
  "startTime": "2024-01-15T10:00:00-05:00",
  "endTime": "2024-01-15T11:00:00-05:00",
  "title": "Consultation Call",
  "appointmentStatus": "confirmed"
}
```

#### Update Appointment
```typescript
PUT /calendars/events/{eventId}
{
  "appointmentStatus": "cancelled"
}
```

### Pipelines

#### Get Pipelines
```typescript
GET /opportunities/pipelines?locationId={locationId}
```

#### Get Pipeline Stages
```typescript
GET /opportunities/pipelines/{pipelineId}
```

### Workflows

#### Trigger Workflow
```typescript
POST /contacts/{contactId}/workflow/{workflowId}
```

### Tags

#### Get All Tags
```typescript
GET /locations/{locationId}/tags
```

#### Create Tag
```typescript
POST /locations/{locationId}/tags
{
  "name": "Hot Lead"
}
```

### Custom Fields

#### Get Custom Fields
```typescript
GET /locations/{locationId}/customFields
```

#### Update Custom Field Value
```typescript
PUT /contacts/{contactId}
{
  "customFields": [
    { "id": "field_id", "value": "new_value" }
  ]
}
```

## Common Patterns

### Lead Capture Workflow
```typescript
// 1. Create contact
const contact = await createContact({
  firstName: leadData.name,
  email: leadData.email,
  phone: leadData.phone,
  tags: ["new_lead", "website"],
});

// 2. Create opportunity
const opportunity = await createOpportunity({
  contactId: contact.id,
  pipelineId: "sales_pipeline",
  pipelineStageId: "new_lead_stage",
  monetaryValue: leadData.estimatedValue,
});

// 3. Trigger workflow
await triggerWorkflow(contact.id, "welcome_sequence");

// 4. Send notification
await sendSMS(contact.id, "Thanks for your interest! We'll be in touch soon.");
```

### Appointment Booking
```typescript
// 1. Get available slots
const slots = await getAvailableSlots(calendarId, startDate, endDate);

// 2. Book appointment
const appointment = await createAppointment({
  calendarId,
  contactId,
  startTime: selectedSlot.startTime,
  endTime: selectedSlot.endTime,
  title: "Discovery Call",
});

// 3. Send confirmation
await sendEmail(contactId, {
  subject: "Appointment Confirmed",
  message: `Your appointment is scheduled for ${selectedSlot.startTime}`,
});
```

## Rate Limits
- 100 requests per minute per location
- Implement exponential backoff for 429 errors

## Error Handling
```typescript
try {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GHL Error: ${error.message}`);
  }
  return response.json();
} catch (error) {
  if (error.status === 429) {
    // Rate limited - wait and retry
    await delay(60000);
    return retry();
  }
  throw error;
}
```

## Webhooks
GHL can send webhooks for:
- Contact created/updated
- Opportunity stage changed
- Appointment booked/cancelled
- Form submitted
- Call completed

Configure in Settings > Webhooks in GHL dashboard.
