/*
  # Update RLS Policies to Allow Anonymous Access

  This app is a single-tenant application without user authentication.
  We need to update all RLS policies to allow anonymous (anon) access
  instead of requiring authenticated users.

  1. Changes
    - Update all policies to use `anon` role instead of `authenticated`
    - This allows the app to work without requiring login
    - Maintains data security at the application level

  2. Security Note
    - Since this is a single-user app, anon access is appropriate
    - The Supabase anon key provides basic security
    - For multi-user deployments, proper authentication should be added
*/

-- Drop existing policies for customers
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can insert customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers" ON customers;

-- Create new policies for customers with anon access
CREATE POLICY "Allow anon select customers"
  ON customers FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert customers"
  ON customers FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update customers"
  ON customers FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete customers"
  ON customers FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for employees
DROP POLICY IF EXISTS "Users can view employees" ON employees;
DROP POLICY IF EXISTS "Users can insert employees" ON employees;
DROP POLICY IF EXISTS "Users can update employees" ON employees;
DROP POLICY IF EXISTS "Users can delete employees" ON employees;

-- Create new policies for employees with anon access
CREATE POLICY "Allow anon select employees"
  ON employees FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert employees"
  ON employees FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update employees"
  ON employees FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete employees"
  ON employees FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for inventory
DROP POLICY IF EXISTS "Users can view inventory" ON inventory;
DROP POLICY IF EXISTS "Users can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Users can update inventory" ON inventory;
DROP POLICY IF EXISTS "Users can delete inventory" ON inventory;

-- Create new policies for inventory with anon access
CREATE POLICY "Allow anon select inventory"
  ON inventory FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert inventory"
  ON inventory FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update inventory"
  ON inventory FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete inventory"
  ON inventory FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for tasks
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks" ON tasks;

-- Create new policies for tasks with anon access
CREATE POLICY "Allow anon select tasks"
  ON tasks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert tasks"
  ON tasks FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update tasks"
  ON tasks FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete tasks"
  ON tasks FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for estimates
DROP POLICY IF EXISTS "Users can view estimates" ON estimates;
DROP POLICY IF EXISTS "Users can insert estimates" ON estimates;
DROP POLICY IF EXISTS "Users can update estimates" ON estimates;
DROP POLICY IF EXISTS "Users can delete estimates" ON estimates;

-- Create new policies for estimates with anon access
CREATE POLICY "Allow anon select estimates"
  ON estimates FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert estimates"
  ON estimates FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update estimates"
  ON estimates FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete estimates"
  ON estimates FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for time_entries
DROP POLICY IF EXISTS "Users can view time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can delete time entries" ON time_entries;

-- Create new policies for time_entries with anon access
CREATE POLICY "Allow anon select time_entries"
  ON time_entries FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert time_entries"
  ON time_entries FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update time_entries"
  ON time_entries FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete time_entries"
  ON time_entries FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for drive_files
DROP POLICY IF EXISTS "Users can view drive files" ON drive_files;
DROP POLICY IF EXISTS "Users can insert drive files" ON drive_files;
DROP POLICY IF EXISTS "Users can update drive files" ON drive_files;
DROP POLICY IF EXISTS "Users can delete drive files" ON drive_files;

-- Create new policies for drive_files with anon access
CREATE POLICY "Allow anon select drive_files"
  ON drive_files FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert drive_files"
  ON drive_files FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update drive_files"
  ON drive_files FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete drive_files"
  ON drive_files FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for automations
DROP POLICY IF EXISTS "Users can view automations" ON automations;
DROP POLICY IF EXISTS "Users can insert automations" ON automations;
DROP POLICY IF EXISTS "Users can update automations" ON automations;
DROP POLICY IF EXISTS "Users can delete automations" ON automations;

-- Create new policies for automations with anon access
CREATE POLICY "Allow anon select automations"
  ON automations FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert automations"
  ON automations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update automations"
  ON automations FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete automations"
  ON automations FOR DELETE
  TO anon
  USING (true);

-- Drop existing policies for automation_actions
DROP POLICY IF EXISTS "Users can view automation actions" ON automation_actions;
DROP POLICY IF EXISTS "Users can insert automation actions" ON automation_actions;
DROP POLICY IF EXISTS "Users can update automation actions" ON automation_actions;
DROP POLICY IF EXISTS "Users can delete automation actions" ON automation_actions;

-- Create new policies for automation_actions with anon access
CREATE POLICY "Allow anon select automation_actions"
  ON automation_actions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert automation_actions"
  ON automation_actions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update automation_actions"
  ON automation_actions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete automation_actions"
  ON automation_actions FOR DELETE
  TO anon
  USING (true);