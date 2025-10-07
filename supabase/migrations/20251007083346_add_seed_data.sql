/*
  # Add Seed Data for Testing

  1. Sample Data
    - Demo customers
    - Sample employees
    - Inventory items
    - Tasks
    
  2. Purpose
    - Provides test data for development
    - Demonstrates app functionality
    - Allows immediate testing
    
  3. Important Notes
    - Safe to run multiple times (uses INSERT OR IGNORE pattern)
    - Can be cleared by deleting records
*/

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM customers WHERE name = 'ABC Construction Co') THEN
        INSERT INTO customers (name, address, email, phone, notes, lat, lng) VALUES
        ('ABC Construction Co', '123 Main Street, Springfield, IL 62701', 'contact@abcconstruction.com', '555-0100', 'Large commercial contractor', 39.7817, -89.6501),
        ('Smith Residence', '456 Oak Avenue, Springfield, IL 62702', 'john.smith@email.com', '555-0101', 'Residential new construction', 39.7990, -89.6440),
        ('Johnson Family Home', '789 Pine Road, Springfield, IL 62703', 'mjohnson@email.com', '555-0102', 'Garage insulation project', 39.8156, -89.6298),
        ('Green Valley Apartments', '321 Elm Street, Springfield, IL 62704', 'maintenance@greenvalley.com', '555-0103', 'Multi-unit apartment complex', 39.8284, -89.6145),
        ('Downtown Office Building', '555 Business Plaza, Springfield, IL 62701', 'facilities@downtownoffice.com', '555-0104', 'Commercial office space', 39.8011, -89.6437);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Mike Rodriguez') THEN
        INSERT INTO employees (name, role, pin) VALUES
        ('Mike Rodriguez', 'Lead Installer', '1234'),
        ('Sarah Chen', 'Installer', '2345'),
        ('Tom Wilson', 'Installer', '3456'),
        ('Lisa Martinez', 'Project Manager', '4567');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM inventory WHERE name = 'Open Cell Spray Foam - 55 Gallon Drum') THEN
        INSERT INTO inventory (name, category, quantity, unit_cost, notes) VALUES
        ('Open Cell Spray Foam - 55 Gallon Drum', 'Spray Foam', 45, 850.00, 'Half-pound density'),
        ('Closed Cell Spray Foam - 55 Gallon Drum', 'Spray Foam', 32, 1250.00, 'Two-pound density'),
        ('Spray Foam Gun', 'Equipment', 8, 450.00, 'Professional grade'),
        ('Safety Suits - Disposable', 'Safety Equipment', 200, 12.50, 'Tyvek suits'),
        ('Respirator Masks', 'Safety Equipment', 25, 85.00, 'Full-face respirators'),
        ('Plastic Sheeting Roll', 'Materials', 15, 35.00, '10ft x 100ft rolls'),
        ('Masking Tape - 2 inch', 'Materials', 48, 8.50, 'Professional grade'),
        ('Generator - 5500W', 'Equipment', 4, 1200.00, 'Portable power'),
        ('Air Compressor', 'Equipment', 3, 850.00, 'For spray equipment'),
        ('Moisture Meter', 'Tools', 6, 125.00, 'Digital readings');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Order spray foam supplies for next week') THEN
        INSERT INTO tasks (title, description, due_date, completed, assigned_to) VALUES
        ('Order spray foam supplies for next week', 'Check inventory levels and place order with supplier', CURRENT_DATE + INTERVAL '3 days', false, ARRAY[]::integer[]),
        ('Schedule equipment maintenance', 'All spray equipment needs quarterly maintenance check', CURRENT_DATE + INTERVAL '7 days', false, ARRAY[]::integer[]),
        ('Follow up with ABC Construction on payment', 'Invoice 30 days overdue', CURRENT_DATE + INTERVAL '1 day', false, ARRAY[]::integer[]),
        ('Update safety training certifications', 'Annual safety training due this month', CURRENT_DATE + INTERVAL '14 days', false, ARRAY[]::integer[]),
        ('Review and approve time sheets', 'Weekly time sheet approval', CURRENT_DATE, false, ARRAY[]::integer[]);
    END IF;
END $$;