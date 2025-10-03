/*
  # Create Automations Tables

  1. New Tables
    - `automations`
      - `id` (serial, primary key)
      - `name` (text) - Name of the automation
      - `trigger_type` (text) - Type of trigger (new_customer, job_status_updated)
      - `trigger_config` (jsonb) - Configuration for the trigger
      - `is_enabled` (boolean) - Whether automation is active
      - `created_at` (timestamptz) - Creation timestamp
    
    - `automation_actions`
      - `id` (serial, primary key)
      - `automation_id` (integer, foreign key) - References automations table
      - `action_type` (text) - Type of action (webhook, create_task, etc.)
      - `action_config` (jsonb) - Configuration for the action
      - `order` (integer) - Order in which actions should execute
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their automations
    
  3. Important Notes
    - Multiple actions can be added to a single automation
    - Actions execute in order based on the `order` field
    - JSONB fields allow flexible configuration storage
*/

CREATE TABLE IF NOT EXISTS automations (
  id serial PRIMARY KEY,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_actions (
  id serial PRIMARY KEY,
  automation_id integer NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_config jsonb DEFAULT '{}'::jsonb,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_actions_automation_id ON automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_order ON automation_actions(automation_id, "order");

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations"
  ON automations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automations"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update automations"
  ON automations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete automations"
  ON automations FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Users can view automation actions"
  ON automation_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert automation actions"
  ON automation_actions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update automation actions"
  ON automation_actions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete automation actions"
  ON automation_actions FOR DELETE
  TO authenticated
  USING (true);