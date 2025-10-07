/*
  # Add Performance Indexes

  1. Additional Indexes
    - Text search indexes for customers
    - Status-based indexes for estimates
    - Date-based indexes for time tracking
    - Composite indexes for common query patterns
    
  2. Performance Benefits
    - Faster customer search
    - Improved job filtering by status
    - Optimized time entry queries
    - Better task sorting and filtering
    
  3. Important Notes
    - These indexes improve read performance
    - Minimal impact on write operations
    - Critical for app scalability
*/

CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers (lower(name));

CREATE INDEX IF NOT EXISTS idx_estimates_status_created ON estimates (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimates_customer_status ON estimates (customer_id, status);

CREATE INDEX IF NOT EXISTS idx_time_entries_employee_start ON time_entries (employee_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_start ON time_entries (job_id, start_time DESC) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries (employee_id, start_time DESC) WHERE end_time IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_completed_due ON tasks (completed, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks USING gin (assigned_to);

CREATE INDEX IF NOT EXISTS idx_inventory_category_name ON inventory (category, name);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory (quantity) WHERE quantity < 10;

CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations (is_enabled) WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_employees_pin ON employees (pin);