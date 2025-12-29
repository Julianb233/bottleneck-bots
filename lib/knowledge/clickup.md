# ClickUp API - Expert Knowledge Base

## Overview
ClickUp is a productivity and project management platform. The API enables automation of tasks, spaces, folders, lists, and time tracking.

## Authentication

### Personal API Token
```typescript
const headers = {
  "Authorization": CLICKUP_API_TOKEN,
  "Content-Type": "application/json",
};
```

### OAuth 2.0
```typescript
const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${redirectUri}`;
```

## Base URL
```
https://api.clickup.com/api/v2
```

## Core Endpoints

### Workspaces (Teams)

#### Get Workspaces
```typescript
GET /team
```

Returns all workspaces the user has access to.

### Spaces

#### Get Spaces
```typescript
GET /team/{team_id}/space?archived=false
```

#### Create Space
```typescript
POST /team/{team_id}/space
{
  "name": "Engineering",
  "multiple_assignees": true,
  "features": {
    "due_dates": {
      "enabled": true,
      "start_date": true,
      "remap_due_dates": true
    },
    "time_tracking": { "enabled": true },
    "tags": { "enabled": true },
    "priorities": { "enabled": true }
  }
}
```

### Folders

#### Get Folders
```typescript
GET /space/{space_id}/folder?archived=false
```

#### Create Folder
```typescript
POST /space/{space_id}/folder
{
  "name": "Q1 Projects"
}
```

### Lists

#### Get Lists
```typescript
GET /folder/{folder_id}/list?archived=false
```

#### Get Folderless Lists
```typescript
GET /space/{space_id}/list?archived=false
```

#### Create List
```typescript
POST /folder/{folder_id}/list
{
  "name": "Sprint Backlog",
  "content": "Tasks for current sprint",
  "priority": 1,
  "status": "red"
}
```

### Tasks

#### Create Task
```typescript
POST /list/{list_id}/task
{
  "name": "Implement user authentication",
  "description": "Add OAuth2 login flow",
  "assignees": [183],
  "tags": ["backend", "security"],
  "status": "to do",
  "priority": 2,
  "due_date": 1704067200000,
  "due_date_time": true,
  "time_estimate": 28800000,
  "notify_all": true,
  "custom_fields": [
    {
      "id": "custom_field_id",
      "value": "High"
    }
  ]
}
```

#### Get Task
```typescript
GET /task/{task_id}?include_subtasks=true&custom_fields=true
```

#### Update Task
```typescript
PUT /task/{task_id}
{
  "name": "Updated task name",
  "status": "in progress",
  "priority": 1
}
```

#### Delete Task
```typescript
DELETE /task/{task_id}
```

#### Get Tasks from List
```typescript
GET /list/{list_id}/task?archived=false&page=0&order_by=due_date&statuses[]=to%20do&statuses[]=in%20progress
```

#### Search Tasks
```typescript
GET /team/{team_id}/task?include_closed=true&subtasks=true&custom_fields=[{"field_id":"uuid","operator":"=","value":"value"}]
```

### Subtasks

#### Create Subtask
```typescript
POST /list/{list_id}/task
{
  "name": "Write unit tests",
  "parent": "parent_task_id"
}
```

### Comments

#### Create Comment
```typescript
POST /task/{task_id}/comment
{
  "comment_text": "This is looking good! Ready for review.",
  "notify_all": true
}
```

#### Get Comments
```typescript
GET /task/{task_id}/comment
```

### Checklists

#### Create Checklist
```typescript
POST /task/{task_id}/checklist
{
  "name": "Review Checklist"
}
```

#### Add Checklist Item
```typescript
POST /checklist/{checklist_id}/checklist_item
{
  "name": "Code review completed",
  "assignee": 183
}
```

#### Update Checklist Item
```typescript
PUT /checklist/{checklist_id}/checklist_item/{checklist_item_id}
{
  "resolved": true
}
```

### Time Tracking

#### Start Timer
```typescript
POST /team/{team_id}/time_entries/start
{
  "tid": "task_id",
  "description": "Working on feature"
}
```

#### Stop Timer
```typescript
POST /team/{team_id}/time_entries/stop
```

#### Get Time Entries
```typescript
GET /team/{team_id}/time_entries?start_date={start}&end_date={end}&assignee={user_id}
```

#### Create Time Entry (Manual)
```typescript
POST /team/{team_id}/time_entries
{
  "tid": "task_id",
  "start": 1704067200000,
  "duration": 3600000,
  "description": "Bug fixing session"
}
```

### Custom Fields

#### Get Custom Fields
```typescript
GET /list/{list_id}/field
```

#### Set Custom Field Value
```typescript
POST /task/{task_id}/field/{field_id}
{
  "value": "custom_value"
}
```

### Tags

#### Get Space Tags
```typescript
GET /space/{space_id}/tag
```

#### Add Tag to Task
```typescript
POST /task/{task_id}/tag/{tag_name}
```

### Goals

#### Get Goals
```typescript
GET /team/{team_id}/goal
```

#### Create Goal
```typescript
POST /team/{team_id}/goal
{
  "name": "Q1 Revenue Target",
  "due_date": 1711929599000,
  "description": "Achieve $1M in revenue",
  "multiple_owners": true,
  "owners": [183],
  "color": "#7B68EE"
}
```

### Views

#### Get Views
```typescript
GET /team/{team_id}/view
```

## Task Statuses

Default statuses (can be customized per list):
- `to do`
- `in progress`
- `review`
- `complete`
- `closed`

## Priority Values
- 1 = Urgent
- 2 = High
- 3 = Normal
- 4 = Low

## Common Patterns

### Project Setup Automation
```typescript
async function setupProject(workspaceId: string, projectName: string) {
  // 1. Create space
  const space = await createSpace(workspaceId, {
    name: projectName,
    features: { due_dates: { enabled: true }, time_tracking: { enabled: true } }
  });

  // 2. Create standard folders
  const folders = ["Planning", "Development", "Testing", "Documentation"];
  for (const folderName of folders) {
    const folder = await createFolder(space.id, { name: folderName });

    // 3. Create lists in each folder
    if (folderName === "Development") {
      await createList(folder.id, { name: "Backlog" });
      await createList(folder.id, { name: "Sprint 1" });
    }
  }

  return space;
}
```

### Task Creation with Full Details
```typescript
async function createDetailedTask(listId: string, taskData: TaskInput) {
  // 1. Create main task
  const task = await createTask(listId, {
    name: taskData.title,
    description: taskData.description,
    assignees: taskData.assigneeIds,
    priority: taskData.priority,
    due_date: taskData.dueDate,
    tags: taskData.tags,
  });

  // 2. Add subtasks
  for (const subtask of taskData.subtasks) {
    await createTask(listId, {
      name: subtask.name,
      parent: task.id,
    });
  }

  // 3. Add checklist
  if (taskData.checklist) {
    const checklist = await createChecklist(task.id, { name: "Requirements" });
    for (const item of taskData.checklist) {
      await addChecklistItem(checklist.id, { name: item });
    }
  }

  // 4. Add comment
  if (taskData.notes) {
    await createComment(task.id, { comment_text: taskData.notes });
  }

  return task;
}
```

### Time Reporting
```typescript
async function getWeeklyTimeReport(workspaceId: string, userId: number) {
  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

  const entries = await getTimeEntries(workspaceId, {
    start_date: weekAgo,
    end_date: now,
    assignee: userId,
  });

  const totalMs = entries.reduce((sum, e) => sum + e.duration, 0);
  const totalHours = totalMs / (1000 * 60 * 60);

  const byTask = entries.reduce((acc, e) => {
    acc[e.task.id] = (acc[e.task.id] || 0) + e.duration;
    return acc;
  }, {});

  return { totalHours, byTask, entries };
}
```

## Rate Limits
- 100 requests per minute per token
- 10 requests per second per token

## Error Handling
```typescript
try {
  const task = await clickup.createTask(listId, taskData);
  return task;
} catch (error) {
  if (error.status === 429) {
    // Rate limited
    const retryAfter = error.headers.get("Retry-After") || 60;
    await delay(retryAfter * 1000);
    return retry();
  }
  if (error.status === 401) {
    throw new Error("Invalid or expired ClickUp token");
  }
  throw error;
}
```

## Webhooks
Configure webhooks in ClickUp to receive:
- taskCreated
- taskUpdated
- taskDeleted
- taskStatusUpdated
- taskAssigneeUpdated
- taskDueDateUpdated
- taskCommentPosted
- goalCreated
- goalUpdated
