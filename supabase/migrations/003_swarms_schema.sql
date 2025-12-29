-- Swarms Schema Migration
-- Creates tables for Manus-style agent swarm management

-- Swarms table (main container for agent teams)
CREATE TABLE IF NOT EXISTS swarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  client_context JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  tasks_completed INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0
);

-- Swarm agents (individual AI agents within a swarm)
CREATE TABLE IF NOT EXISTS swarm_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_prompt TEXT,
  capabilities TEXT[] DEFAULT '{}',
  integration_expertise TEXT[] DEFAULT '{}',
  knowledge_sources JSONB DEFAULT '[]',
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'completed', 'failed', 'paused')),
  current_task TEXT,
  tasks_completed INTEGER DEFAULT 0,
  has_browser BOOLEAN DEFAULT false,
  browser_session_id TEXT,
  memory JSONB DEFAULT '{}',
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Swarm tasks (work items assigned to agents)
CREATE TABLE IF NOT EXISTS swarm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES swarm_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to UUID[] DEFAULT '{}',
  capabilities TEXT[] DEFAULT '{}',
  input_data JSONB,
  result JSONB,
  error TEXT,
  todo_md TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Swarm messages (communication between user and agents, and agent-to-agent)
CREATE TABLE IF NOT EXISTS swarm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
  target_agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES swarm_tasks(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system', 'delegation')),
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'task', 'result', 'error', 'thinking', 'tool_call', 'delegation')),
  metadata JSONB DEFAULT '{}',
  tool_calls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge documents (uploaded files for agent context)
CREATE TABLE IF NOT EXISTS swarm_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES swarm_agents(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  storage_path TEXT,
  content TEXT,
  chunks JSONB DEFAULT '[]',
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent tool executions (track tool usage for observability)
CREATE TABLE IF NOT EXISTS swarm_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID REFERENCES swarms(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES swarm_agents(id) ON DELETE CASCADE,
  task_id UUID REFERENCES swarm_tasks(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB,
  tool_output JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error TEXT,
  duration_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_swarms_user_id ON swarms(user_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_swarm_id ON swarm_agents(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_agents_status ON swarm_agents(status);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_swarm_id ON swarm_tasks(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_messages_swarm_id ON swarm_messages(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_messages_created_at ON swarm_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_swarm_knowledge_swarm_id ON swarm_knowledge(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tool_executions_agent_id ON swarm_tool_executions(agent_id);

-- Enable Row Level Security
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE swarm_tool_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for swarms
CREATE POLICY "Users can view own swarms" ON swarms
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own swarms" ON swarms
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own swarms" ON swarms
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own swarms" ON swarms
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for swarm_agents
CREATE POLICY "Users can view swarm agents" ON swarm_agents
  FOR SELECT USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can create swarm agents" ON swarm_agents
  FOR INSERT WITH CHECK (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can update swarm agents" ON swarm_agents
  FOR UPDATE USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete swarm agents" ON swarm_agents
  FOR DELETE USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

-- RLS Policies for swarm_tasks
CREATE POLICY "Users can view swarm tasks" ON swarm_tasks
  FOR SELECT USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can create swarm tasks" ON swarm_tasks
  FOR INSERT WITH CHECK (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can update swarm tasks" ON swarm_tasks
  FOR UPDATE USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete swarm tasks" ON swarm_tasks
  FOR DELETE USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

-- RLS Policies for swarm_messages
CREATE POLICY "Users can view swarm messages" ON swarm_messages
  FOR SELECT USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can create swarm messages" ON swarm_messages
  FOR INSERT WITH CHECK (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

-- RLS Policies for swarm_knowledge
CREATE POLICY "Users can view swarm knowledge" ON swarm_knowledge
  FOR SELECT USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can create swarm knowledge" ON swarm_knowledge
  FOR INSERT WITH CHECK (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete swarm knowledge" ON swarm_knowledge
  FOR DELETE USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

-- RLS Policies for swarm_tool_executions
CREATE POLICY "Users can view tool executions" ON swarm_tool_executions
  FOR SELECT USING (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

CREATE POLICY "Users can create tool executions" ON swarm_tool_executions
  FOR INSERT WITH CHECK (swarm_id IN (SELECT id FROM swarms WHERE user_id = auth.uid()));

-- Create updated_at trigger for swarms
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_swarms_updated_at
  BEFORE UPDATE ON swarms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
