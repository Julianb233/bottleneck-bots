# HubSpot CRM API - Expert Knowledge Base

## Overview
HubSpot is a comprehensive CRM platform with marketing, sales, and service hubs. The API provides access to contacts, companies, deals, tickets, and more.

## Authentication

### Private App Token (Recommended)
```typescript
const headers = {
  "Authorization": `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};
```

### OAuth 2.0
```typescript
const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}`;
```

## Base URL
```
https://api.hubapi.com
```

## Core Endpoints

### Contacts

#### Create Contact
```typescript
POST /crm/v3/objects/contacts
{
  "properties": {
    "email": "john@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "phone": "+1234567890",
    "company": "Acme Inc",
    "lifecyclestage": "lead"
  }
}
```

#### Get Contact
```typescript
GET /crm/v3/objects/contacts/{contactId}?properties=email,firstname,lastname,phone
```

#### Update Contact
```typescript
PATCH /crm/v3/objects/contacts/{contactId}
{
  "properties": {
    "lifecyclestage": "customer",
    "hs_lead_status": "QUALIFIED"
  }
}
```

#### Search Contacts
```typescript
POST /crm/v3/objects/contacts/search
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "email",
          "operator": "EQ",
          "value": "john@example.com"
        }
      ]
    }
  ],
  "properties": ["email", "firstname", "lastname"],
  "limit": 10
}
```

#### Batch Create Contacts
```typescript
POST /crm/v3/objects/contacts/batch/create
{
  "inputs": [
    { "properties": { "email": "a@example.com", "firstname": "Alice" } },
    { "properties": { "email": "b@example.com", "firstname": "Bob" } }
  ]
}
```

### Companies

#### Create Company
```typescript
POST /crm/v3/objects/companies
{
  "properties": {
    "name": "Acme Corporation",
    "domain": "acme.com",
    "industry": "Technology",
    "numberofemployees": "100",
    "annualrevenue": "5000000"
  }
}
```

#### Search Companies
```typescript
POST /crm/v3/objects/companies/search
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "domain",
          "operator": "EQ",
          "value": "acme.com"
        }
      ]
    }
  ]
}
```

### Deals

#### Create Deal
```typescript
POST /crm/v3/objects/deals
{
  "properties": {
    "dealname": "New Software License",
    "amount": "50000",
    "dealstage": "appointmentscheduled",
    "pipeline": "default",
    "closedate": "2024-03-31"
  }
}
```

#### Update Deal Stage
```typescript
PATCH /crm/v3/objects/deals/{dealId}
{
  "properties": {
    "dealstage": "closedwon"
  }
}
```

#### Search Deals
```typescript
POST /crm/v3/objects/deals/search
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "dealstage",
          "operator": "EQ",
          "value": "appointmentscheduled"
        }
      ]
    }
  ],
  "sorts": [
    { "propertyName": "closedate", "direction": "ASCENDING" }
  ]
}
```

### Associations

#### Associate Contact with Company
```typescript
PUT /crm/v3/objects/contacts/{contactId}/associations/companies/{companyId}/contact_to_company
```

#### Associate Contact with Deal
```typescript
PUT /crm/v3/objects/contacts/{contactId}/associations/deals/{dealId}/contact_to_deal
```

#### Get Contact's Companies
```typescript
GET /crm/v3/objects/contacts/{contactId}/associations/companies
```

### Engagements (Activities)

#### Create Note
```typescript
POST /crm/v3/objects/notes
{
  "properties": {
    "hs_note_body": "Had a great call with the client. They're interested in our enterprise plan.",
    "hs_timestamp": "2024-01-15T10:00:00.000Z"
  },
  "associations": [
    {
      "to": { "id": "contact_id" },
      "types": [{ "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 202 }]
    }
  ]
}
```

#### Create Task
```typescript
POST /crm/v3/objects/tasks
{
  "properties": {
    "hs_task_subject": "Follow up call",
    "hs_task_body": "Schedule a demo",
    "hs_task_status": "NOT_STARTED",
    "hs_task_priority": "HIGH",
    "hs_timestamp": "2024-01-20T14:00:00.000Z"
  }
}
```

#### Log Email
```typescript
POST /crm/v3/objects/emails
{
  "properties": {
    "hs_email_direction": "OUTBOUND",
    "hs_email_subject": "Your Quote",
    "hs_email_text": "Please find attached...",
    "hs_timestamp": "2024-01-15T10:00:00.000Z"
  }
}
```

### Properties

#### Get All Contact Properties
```typescript
GET /crm/v3/properties/contacts
```

#### Create Custom Property
```typescript
POST /crm/v3/properties/contacts
{
  "name": "custom_score",
  "label": "Custom Score",
  "type": "number",
  "fieldType": "number",
  "groupName": "contactinformation"
}
```

### Lists

#### Get Lists
```typescript
GET /crm/v3/lists
```

#### Add Contacts to List
```typescript
PUT /crm/v3/lists/{listId}/memberships/add
{
  "recordIdsToAdd": ["contact_id_1", "contact_id_2"]
}
```

### Workflows

#### Enroll Contact in Workflow
```typescript
POST /automation/v4/actions/enrollments/enroll
{
  "objectType": "contacts",
  "objectIds": ["contact_id"],
  "enrollmentSource": "API",
  "workflowId": "workflow_id"
}
```

## Common Patterns

### Lead Processing
```typescript
// 1. Check if contact exists
const existing = await searchContacts({ email: lead.email });

let contactId;
if (existing.results.length > 0) {
  // 2a. Update existing contact
  contactId = existing.results[0].id;
  await updateContact(contactId, {
    lifecyclestage: "lead",
    hs_lead_status: "NEW"
  });
} else {
  // 2b. Create new contact
  const contact = await createContact({
    email: lead.email,
    firstname: lead.firstName,
    lastname: lead.lastName,
    lifecyclestage: "lead"
  });
  contactId = contact.id;
}

// 3. Create or find company
const company = await findOrCreateCompany(lead.company);

// 4. Associate contact with company
await associateContactWithCompany(contactId, company.id);

// 5. Create deal
const deal = await createDeal({
  dealname: `${lead.company} - New Opportunity`,
  amount: lead.estimatedValue,
  dealstage: "appointmentscheduled"
});

// 6. Associate deal with contact
await associateContactWithDeal(contactId, deal.id);
```

### Deal Stage Progression
```typescript
const DEAL_STAGES = {
  qualifiedtobuy: { weight: 20 },
  appointmentscheduled: { weight: 40 },
  decisionmakerboughtin: { weight: 60 },
  contractsent: { weight: 80 },
  closedwon: { weight: 100 },
  closedlost: { weight: 0 }
};

async function progressDeal(dealId: string, newStage: string) {
  await updateDeal(dealId, { dealstage: newStage });

  // Log activity
  await createNote({
    body: `Deal moved to ${newStage}`,
    associations: [{ type: "deal", id: dealId }]
  });
}
```

## Search Operators
- `EQ` - Equals
- `NEQ` - Not equals
- `LT` - Less than
- `LTE` - Less than or equal
- `GT` - Greater than
- `GTE` - Greater than or equal
- `CONTAINS_TOKEN` - Contains word
- `NOT_CONTAINS_TOKEN` - Does not contain word
- `HAS_PROPERTY` - Has value
- `NOT_HAS_PROPERTY` - Has no value

## Rate Limits
- Private apps: 100 requests per 10 seconds
- OAuth apps: 100-500 requests per 10 seconds (varies by tier)
- Burst limit: 150 requests per 10 seconds

## Error Handling
```typescript
try {
  const response = await hubspotClient.crm.contacts.basicApi.create(contact);
  return response;
} catch (error) {
  if (error.code === 409) {
    // Contact already exists
    return findExistingContact(contact.email);
  }
  if (error.code === 429) {
    // Rate limited
    await delay(10000);
    return retry();
  }
  throw error;
}
```

## Webhooks
Subscribe to events in HubSpot Developer settings:
- contact.creation
- contact.propertyChange
- deal.creation
- deal.propertyChange
- company.creation
