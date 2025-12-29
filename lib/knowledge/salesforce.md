# Salesforce API - Expert Knowledge Base

## Overview
Salesforce is the world's leading CRM platform. The REST API provides access to accounts, contacts, leads, opportunities, cases, and custom objects.

## Authentication

### OAuth 2.0 (User Agent Flow)
```typescript
const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=token&client_id=${clientId}&redirect_uri=${redirectUri}`;
```

### OAuth 2.0 (Web Server Flow)
```typescript
// Step 1: Get authorization code
const authUrl = `https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}`;

// Step 2: Exchange code for tokens
const tokenResponse = await fetch("https://login.salesforce.com/services/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  }),
});

const { access_token, instance_url, refresh_token } = await tokenResponse.json();
```

### Connected App (Server-to-Server)
```typescript
const tokenResponse = await fetch("https://login.salesforce.com/services/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }),
});
```

## Base URL
```
{instance_url}/services/data/v59.0
```

## Core Endpoints

### SObjects (Standard & Custom Objects)

#### Get Object Metadata
```typescript
GET /sobjects/
GET /sobjects/Account/describe
```

#### Create Record
```typescript
POST /sobjects/Account
{
  "Name": "Acme Corporation",
  "Website": "https://acme.com",
  "Industry": "Technology",
  "NumberOfEmployees": 500,
  "AnnualRevenue": 10000000
}
```

#### Get Record
```typescript
GET /sobjects/Account/{id}
GET /sobjects/Account/{id}?fields=Name,Website,Industry
```

#### Update Record
```typescript
PATCH /sobjects/Account/{id}
{
  "Industry": "Software",
  "NumberOfEmployees": 600
}
```

#### Delete Record
```typescript
DELETE /sobjects/Account/{id}
```

### SOQL Queries

#### Basic Query
```typescript
GET /query?q=SELECT+Id,Name,Website+FROM+Account+WHERE+Industry='Technology'
```

#### With Relationships
```typescript
GET /query?q=SELECT+Id,Name,(SELECT+Id,FirstName,LastName+FROM+Contacts)+FROM+Account+WHERE+Id='001xxx'
```

#### Aggregate Functions
```typescript
GET /query?q=SELECT+Industry,COUNT(Id)+FROM+Account+GROUP+BY+Industry
```

#### Date Filters
```typescript
GET /query?q=SELECT+Id,Name+FROM+Opportunity+WHERE+CloseDate=THIS_QUARTER
```

### Composite Requests

#### Create Multiple Records
```typescript
POST /composite/sobjects
{
  "allOrNone": true,
  "records": [
    {
      "attributes": { "type": "Account" },
      "Name": "Account 1"
    },
    {
      "attributes": { "type": "Account" },
      "Name": "Account 2"
    }
  ]
}
```

#### Update Multiple Records
```typescript
PATCH /composite/sobjects
{
  "allOrNone": true,
  "records": [
    { "id": "001xxx", "Name": "Updated 1" },
    { "id": "001yyy", "Name": "Updated 2" }
  ]
}
```

### Accounts

#### Create Account
```typescript
POST /sobjects/Account
{
  "Name": "Acme Inc",
  "Website": "https://acme.com",
  "Phone": "555-1234",
  "BillingStreet": "123 Main St",
  "BillingCity": "San Francisco",
  "BillingState": "CA",
  "BillingPostalCode": "94102",
  "Industry": "Technology",
  "Type": "Customer",
  "NumberOfEmployees": 100
}
```

### Contacts

#### Create Contact
```typescript
POST /sobjects/Contact
{
  "FirstName": "John",
  "LastName": "Doe",
  "Email": "john@acme.com",
  "Phone": "555-5678",
  "Title": "CEO",
  "AccountId": "001xxx",
  "LeadSource": "Web"
}
```

### Leads

#### Create Lead
```typescript
POST /sobjects/Lead
{
  "FirstName": "Jane",
  "LastName": "Smith",
  "Company": "New Corp",
  "Email": "jane@newcorp.com",
  "Phone": "555-9999",
  "Status": "Open - Not Contacted",
  "LeadSource": "Web",
  "Rating": "Hot"
}
```

#### Convert Lead
```typescript
POST /sobjects/Lead/{leadId}/convert
{
  "convertedStatus": "Qualified",
  "createOpportunity": true,
  "opportunityName": "New Corp - Opportunity"
}
```

### Opportunities

#### Create Opportunity
```typescript
POST /sobjects/Opportunity
{
  "Name": "Acme - Enterprise Deal",
  "AccountId": "001xxx",
  "CloseDate": "2024-06-30",
  "StageName": "Prospecting",
  "Amount": 50000,
  "Probability": 20,
  "Type": "New Customer"
}
```

#### Update Stage
```typescript
PATCH /sobjects/Opportunity/{id}
{
  "StageName": "Proposal/Price Quote",
  "Probability": 60
}
```

### Cases

#### Create Case
```typescript
POST /sobjects/Case
{
  "AccountId": "001xxx",
  "ContactId": "003xxx",
  "Subject": "Product issue",
  "Description": "Customer reported...",
  "Status": "New",
  "Priority": "High",
  "Origin": "Web"
}
```

### Tasks & Events

#### Create Task
```typescript
POST /sobjects/Task
{
  "Subject": "Follow up call",
  "WhoId": "003xxx",
  "WhatId": "006xxx",
  "Status": "Not Started",
  "Priority": "High",
  "ActivityDate": "2024-01-20"
}
```

#### Create Event
```typescript
POST /sobjects/Event
{
  "Subject": "Demo Meeting",
  "WhoId": "003xxx",
  "StartDateTime": "2024-01-15T10:00:00.000Z",
  "EndDateTime": "2024-01-15T11:00:00.000Z",
  "Location": "Zoom"
}
```

### Attachments & Files

#### Upload File
```typescript
POST /sobjects/ContentVersion
{
  "Title": "Contract",
  "PathOnClient": "contract.pdf",
  "VersionData": "{base64_encoded_file}"
}
```

## SOQL Reference

### Operators
- `=`, `!=`, `<`, `>`, `<=`, `>=`
- `LIKE` (with % wildcard)
- `IN`, `NOT IN`
- `INCLUDES`, `EXCLUDES` (multi-select picklists)

### Date Literals
- `TODAY`, `YESTERDAY`, `TOMORROW`
- `THIS_WEEK`, `LAST_WEEK`, `NEXT_WEEK`
- `THIS_MONTH`, `LAST_MONTH`, `NEXT_MONTH`
- `THIS_QUARTER`, `LAST_QUARTER`, `NEXT_QUARTER`
- `THIS_YEAR`, `LAST_YEAR`, `NEXT_YEAR`
- `LAST_N_DAYS:n`, `NEXT_N_DAYS:n`

### Common Queries
```sql
-- Accounts with recent opportunities
SELECT Id, Name, (SELECT Id, Name, Amount FROM Opportunities WHERE CreatedDate = THIS_QUARTER)
FROM Account
WHERE Industry = 'Technology'

-- Contacts without activities
SELECT Id, FirstName, LastName
FROM Contact
WHERE Id NOT IN (SELECT WhoId FROM Task WHERE WhoId != null)

-- Top opportunities by amount
SELECT Id, Name, Amount, StageName
FROM Opportunity
WHERE IsClosed = false
ORDER BY Amount DESC
LIMIT 10
```

## Common Patterns

### Lead to Opportunity Flow
```typescript
async function processLead(leadData: LeadInput) {
  // 1. Check for existing lead/account
  const existing = await query(`
    SELECT Id FROM Lead WHERE Email = '${leadData.email}'
  `);

  if (existing.records.length > 0) {
    // Update existing lead
    return updateLead(existing.records[0].Id, leadData);
  }

  // 2. Create new lead
  const lead = await createLead({
    FirstName: leadData.firstName,
    LastName: leadData.lastName,
    Email: leadData.email,
    Company: leadData.company,
    LeadSource: "Web",
    Status: "Open - Not Contacted",
  });

  // 3. Create follow-up task
  await createTask({
    Subject: "New Lead Follow-up",
    WhoId: lead.id,
    Status: "Not Started",
    Priority: "High",
    ActivityDate: addDays(new Date(), 1),
  });

  return lead;
}
```

### Account Hierarchy
```typescript
async function getAccountHierarchy(accountId: string) {
  const account = await query(`
    SELECT Id, Name, ParentId,
      (SELECT Id, Name FROM ChildAccounts),
      (SELECT Id, FirstName, LastName FROM Contacts),
      (SELECT Id, Name, Amount, StageName FROM Opportunities WHERE IsClosed = false)
    FROM Account
    WHERE Id = '${accountId}'
  `);

  return account.records[0];
}
```

## Rate Limits
- API requests: Based on org edition and licenses
- Bulk API: 15,000 batches per 24 hours
- Streaming API: 20,000 events per 24 hours

## Error Handling
```typescript
try {
  const result = await createRecord("Account", data);
  return result;
} catch (error) {
  if (error.errorCode === "DUPLICATE_VALUE") {
    // Handle duplicate
    return findExisting(data.email);
  }
  if (error.errorCode === "INVALID_SESSION_ID") {
    // Refresh token and retry
    await refreshAccessToken();
    return retry();
  }
  throw error;
}
```
