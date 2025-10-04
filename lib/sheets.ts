import { CustomerInfo } from '../components/EstimatePDF';
import { InventoryItem, EstimateRecord } from './db';
import { Employee, Task } from '../components/types';

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportCustomersToCSV = (customers: CustomerInfo[]) => {
  const data = customers.map(c => ({
    ID: c.id,
    Name: c.name,
    Address: c.address,
    Email: c.email || '',
    Phone: c.phone || '',
    Notes: c.notes || ''
  }));
  exportToCSV(data, 'InsulaPro_Customers');
};

export const exportInventoryToCSV = (items: InventoryItem[]) => {
  const data = items.map(i => ({
    ID: i.id,
    Name: i.name,
    Category: i.category,
    Quantity: i.quantity,
    'Unit Cost': i.unitCost || '',
    Notes: i.notes || ''
  }));
  exportToCSV(data, 'InsulaPro_Inventory');
};

export const exportJobsToCSV = (jobs: EstimateRecord[], customers: CustomerInfo[]) => {
  const data = jobs.map(j => {
    const customer = customers.find(c => c.id === j.customerId);
    return {
      'Job Number': j.estimateNumber,
      'Customer Name': customer?.name || '',
      'Customer Address': customer?.address || '',
      Status: j.status,
      'Total Price': j.costsData?.finalQuote || 0,
      'Open Cell Sets': j.calcData?.ocSets || 0,
      'Closed Cell Sets': j.calcData?.ccSets || 0,
      'Created Date': new Date(j.createdAt).toLocaleDateString()
    };
  });
  exportToCSV(data, 'InsulaPro_Jobs');
};

export const exportEmployeesToCSV = (employees: Employee[]) => {
  const data = employees.map(e => ({
    ID: e.id,
    Name: e.name,
    Role: e.role
  }));
  exportToCSV(data, 'InsulaPro_Employees');
};

export const exportTasksToCSV = (tasks: Task[]) => {
  const data = tasks.map(t => ({
    ID: t.id,
    Title: t.title,
    Description: t.description || '',
    'Due Date': t.dueDate || '',
    Completed: t.completed ? 'Yes' : 'No',
    'Created At': new Date(t.createdAt).toLocaleDateString()
  }));
  exportToCSV(data, 'InsulaPro_Tasks');
};

export const parseCSV = (csvText: string): any[] => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      if (char === '"') {
        if (insideQuotes && lines[i][j + 1] === '"') {
          current += '"';
          j++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index].replace(/^"|"$/g, '');
      });
      rows.push(row);
    }
  }

  return rows;
};

export const importCustomersFromCSV = async (
  file: File,
  onImport: (customers: Omit<CustomerInfo, 'id'>[]) => Promise<void>
) => {
  const text = await file.text();
  const rows = parseCSV(text);

  const customers: Omit<CustomerInfo, 'id'>[] = rows.map(row => ({
    name: row.Name || row.name || '',
    address: row.Address || row.address || '',
    email: row.Email || row.email || '',
    phone: row.Phone || row.phone || '',
    notes: row.Notes || row.notes || ''
  })).filter(c => c.name && c.address);

  if (customers.length === 0) {
    throw new Error('No valid customers found in CSV. Required columns: Name, Address');
  }

  await onImport(customers);
  return customers.length;
};

export const importInventoryFromCSV = async (
  file: File,
  onImport: (items: Omit<InventoryItem, 'id'>[]) => Promise<void>
) => {
  const text = await file.text();
  const rows = parseCSV(text);

  const items: Omit<InventoryItem, 'id'>[] = rows.map(row => ({
    name: row.Name || row.name || '',
    category: row.Category || row.category || 'General',
    quantity: parseFloat(row.Quantity || row.quantity || '0') || 0,
    unitCost: parseFloat(row['Unit Cost'] || row.unitCost || '0') || undefined,
    notes: row.Notes || row.notes || ''
  })).filter(i => i.name);

  if (items.length === 0) {
    throw new Error('No valid inventory items found in CSV. Required column: Name');
  }

  await onImport(items);
  return items.length;
};

export const importEmployeesFromCSV = async (
  file: File,
  onImport: (employees: Omit<Employee, 'id'>[]) => Promise<void>
) => {
  const text = await file.text();
  const rows = parseCSV(text);

  const employees: Omit<Employee, 'id'>[] = rows.map(row => ({
    name: row.Name || row.name || '',
    role: row.Role || row.role || 'Employee',
    pin: row.PIN || row.pin || Math.floor(1000 + Math.random() * 9000).toString()
  })).filter(e => e.name);

  if (employees.length === 0) {
    throw new Error('No valid employees found in CSV. Required column: Name');
  }

  await onImport(employees);
  return employees.length;
};

export const generateCustomerTemplate = () => {
  const template = `Name,Address,Email,Phone,Notes
"Example Customer","123 Main St, City, State 12345","customer@example.com","(555) 123-4567","Important customer"
"Another Customer","456 Oak Ave, Town, State 67890","info@example.com","(555) 987-6543","Regular client"`;

  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'InsulaPro_Customer_Template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateInventoryTemplate = () => {
  const template = `Name,Category,Quantity,Unit Cost,Notes
"Open-Cell Foam Set","Foam",50,850,"500 board feet per set"
"Closed-Cell Foam Set","Foam",30,1200,"500 board feet per set"
"Safety Goggles","Safety Equipment",25,15,"ANSI Z87.1 certified"
"Spray Gun Parts Kit","Equipment",10,350,"Replacement parts"`;

  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'InsulaPro_Inventory_Template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateEmployeeTemplate = () => {
  const template = `Name,Role,PIN
"John Smith","Installer",1234
"Jane Doe","Supervisor",5678
"Mike Johnson","Installer",9012`;

  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'InsulaPro_Employee_Template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
