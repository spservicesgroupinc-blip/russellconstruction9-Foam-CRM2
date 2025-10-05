/*
  # Create InsulaPro Database Schema

  1. New Tables
    - `customers`
      - `id` (serial, primary key)
      - `name` (text, required) - Customer name
      - `address` (text, required) - Customer address
      - `email` (text) - Customer email
      - `phone` (text) - Customer phone number
      - `notes` (text) - Additional notes
      - `lat` (numeric) - Latitude for mapping
      - `lng` (numeric) - Longitude for mapping
      - `created_at` (timestamptz) - Creation timestamp
    
    - `employees`
      - `id` (serial, primary key)
      - `name` (text, required) - Employee name
      - `role` (text, required) - Employee role/title
      - `pin` (text, required) - 4-digit PIN for time clock
      - `created_at` (timestamptz) - Creation timestamp
    
    - `inventory`
      - `id` (serial, primary key)
      - `name` (text, required) - Item name
      - `category` (text, required) - Item category
      - `quantity` (numeric, required) - Current quantity
      - `unit_cost` (numeric) - Cost per unit
      - `notes` (text) - Additional notes
      - `created_at` (timestamptz) - Creation timestamp
    
    - `tasks`
      - `id` (serial, primary key)
      - `title` (text, required) - Task title
      - `description` (text) - Task description
      - `due_date` (date) - Due date
      - `completed` (boolean) - Completion status
      - `assigned_to` (integer[]) - Array of employee IDs
      - `completed_at` (timestamptz) - Completion timestamp
      - `created_at` (timestamptz) - Creation timestamp
    
    - `estimates`
      - `id` (serial, primary key)
      - `customer_id` (integer, foreign key) - References customers
      - `estimate_number` (text, unique, required) - Unique estimate number
      - `status` (text, required) - estimate, sold, invoiced, or paid
      - `calc_data` (jsonb, required) - Calculation results
      - `costs_data` (jsonb, required) - Cost breakdown
      - `scope_of_work` (text) - Scope of work description
      - `estimate_pdf_url` (text) - URL to stored PDF
      - `material_order_pdf_url` (text) - URL to stored PDF
      - `invoice_pdf_url` (text) - URL to stored PDF
      - `created_at` (timestamptz) - Creation timestamp
    
    - `time_entries`
      - `id` (serial, primary key)
      - `employee_id` (integer, foreign key) - References employees
      - `job_id` (integer) - Job identifier
      - `start_time` (timestamptz, required) - Clock in time
      - `end_time` (timestamptz) - Clock out time
      - `start_lat` (numeric) - Start location latitude
      - `start_lng` (numeric) - Start location longitude
      - `end_lat` (numeric) - End location latitude
      - `end_lng` (numeric) - End location longitude
      - `duration_hours` (numeric) - Calculated duration
      - `created_at` (timestamptz) - Creation timestamp
    
    - `drive_files`
      - `id` (serial, primary key)
      - `customer_id` (integer, foreign key) - References customers
      - `file_id` (text, required) - Google Drive file ID
      - `file_name` (text, required) - File name
      - `web_link` (text, required) - Link to file
      - `icon_link` (text, required) - Icon URL
      - `created_at` (timestamptz) - Creation timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage all data
    - Public access disabled by default

  3. Indexes
    - Created on foreign keys and commonly queried fields
    - Optimized for fast lookups and filtering

  4. Important Notes
    - All tables use serial IDs for compatibility
    - JSONB fields for flexible data storage
    - Timestamps track creation times
    - RLS policies allow full access for authenticated users (single-tenant app)
*/

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  address text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  notes text DEFAULT '',
  lat numeric,
  lng numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id serial PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL,
  pin text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id serial PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  due_date date,
  completed boolean DEFAULT false,
  assigned_to integer[] DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  estimate_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'estimate',
  calc_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  costs_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  scope_of_work text DEFAULT '',
  estimate_pdf_url text,
  material_order_pdf_url text,
  invoice_pdf_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_number ON estimates(estimate_number);

-- Time entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id serial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  job_id integer,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  duration_hours numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time DESC);

-- Drive files table
CREATE TABLE IF NOT EXISTS drive_files (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_id text NOT NULL,
  file_name text NOT NULL,
  web_link text NOT NULL,
  icon_link text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_files_customer_id ON drive_files(customer_id);

-- Enable Row Level Security on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "Users can view customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert customers"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update customers"
  ON customers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete customers"
  ON customers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for employees
CREATE POLICY "Users can view employees"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for inventory
CREATE POLICY "Users can view inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert inventory"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update inventory"
  ON inventory FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete inventory"
  ON inventory FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for estimates
CREATE POLICY "Users can view estimates"
  ON estimates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert estimates"
  ON estimates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update estimates"
  ON estimates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete estimates"
  ON estimates FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for time_entries
CREATE POLICY "Users can view time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete time entries"
  ON time_entries FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for drive_files
CREATE POLICY "Users can view drive files"
  ON drive_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert drive files"
  ON drive_files FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update drive files"
  ON drive_files FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete drive files"
  ON drive_files FOR DELETE
  TO authenticated
  USING (true);