import React, { useState } from 'react';
import { CustomerInfo } from './EstimatePDF';
import { InventoryItem } from '../lib/db';
import { Employee } from './types';
import {
  exportCustomersToCSV,
  exportInventoryToCSV,
  exportJobsToCSV,
  exportEmployeesToCSV,
  exportTasksToCSV,
  generateCustomerTemplate,
  generateInventoryTemplate,
  generateEmployeeTemplate,
  importCustomersFromCSV,
  importInventoryFromCSV,
  importEmployeesFromCSV
} from '../lib/sheets';

interface DataImportExportProps {
  customers: CustomerInfo[];
  inventory: InventoryItem[];
  jobs: any[];
  employees: Employee[];
  tasks: any[];
  onImportCustomers: (customers: Omit<CustomerInfo, 'id'>[]) => Promise<void>;
  onImportInventory: (items: Omit<InventoryItem, 'id'>[]) => Promise<void>;
  onImportEmployees: (employees: Omit<Employee, 'id'>[]) => Promise<void>;
}

export default function DataImportExport({
  customers,
  inventory,
  jobs,
  employees,
  tasks,
  onImportCustomers,
  onImportInventory,
  onImportEmployees
}: DataImportExportProps) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleImport = async (
    file: File,
    importFn: (file: File, onImport: any) => Promise<number>,
    onImport: any,
    dataType: string
  ) => {
    setImporting(true);
    setMessage(null);
    try {
      const count = await importFn(file, onImport);
      setMessage({ type: 'success', text: `Successfully imported ${count} ${dataType}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || `Failed to import ${dataType}` });
    } finally {
      setImporting(false);
    }
  };

  const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm";
  const button = "px-4 py-2 rounded-lg font-medium text-sm transition-colors";
  const primaryBtn = `${button} bg-blue-600 text-white hover:bg-blue-700`;
  const secondaryBtn = `${button} bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-500`;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Data Import/Export</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Export data to CSV files or import data from spreadsheets
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className={card}>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Customers
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {customers.length} customers in database
            </p>
            <div className="space-y-2">
              <button
                onClick={() => exportCustomersToCSV(customers)}
                className={primaryBtn + ' w-full'}
                disabled={customers.length === 0}
              >
                Export Customers
              </button>
              <button
                onClick={generateCustomerTemplate}
                className={secondaryBtn + ' w-full'}
              >
                Download Template
              </button>
              <label className={secondaryBtn + ' w-full block text-center cursor-pointer'}>
                Import Customers
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImport(file, importCustomersFromCSV, onImportCustomers, 'customers');
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Inventory
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {inventory.length} items in inventory
            </p>
            <div className="space-y-2">
              <button
                onClick={() => exportInventoryToCSV(inventory)}
                className={primaryBtn + ' w-full'}
                disabled={inventory.length === 0}
              >
                Export Inventory
              </button>
              <button
                onClick={generateInventoryTemplate}
                className={secondaryBtn + ' w-full'}
              >
                Download Template
              </button>
              <label className={secondaryBtn + ' w-full block text-center cursor-pointer'}>
                Import Inventory
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImport(file, importInventoryFromCSV, onImportInventory, 'inventory items');
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Jobs
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {jobs.length} jobs in database
            </p>
            <div className="space-y-2">
              <button
                onClick={() => exportJobsToCSV(jobs, customers)}
                className={primaryBtn + ' w-full'}
                disabled={jobs.length === 0}
              >
                Export Jobs
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Jobs can only be exported, not imported
              </p>
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Employees
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {employees.length} employees in database
            </p>
            <div className="space-y-2">
              <button
                onClick={() => exportEmployeesToCSV(employees)}
                className={primaryBtn + ' w-full'}
                disabled={employees.length === 0}
              >
                Export Employees
              </button>
              <button
                onClick={generateEmployeeTemplate}
                className={secondaryBtn + ' w-full'}
              >
                Download Template
              </button>
              <label className={secondaryBtn + ' w-full block text-center cursor-pointer'}>
                Import Employees
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImport(file, importEmployeesFromCSV, onImportEmployees, 'employees');
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Tasks
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {tasks.length} tasks in database
            </p>
            <div className="space-y-2">
              <button
                onClick={() => exportTasksToCSV(tasks)}
                className={primaryBtn + ' w-full'}
                disabled={tasks.length === 0}
              >
                Export Tasks
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                Tasks can only be exported, not imported
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className={card + ' mt-6'}>
        <div className="p-6">
          <h3 className="font-bold mb-2 dark:text-white">How to Use</h3>
          <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
            <li>Click <strong>Export</strong> to download your data as a CSV file that opens in Excel/Google Sheets</li>
            <li>Click <strong>Download Template</strong> to get a sample CSV file with the correct format</li>
            <li>Edit the CSV file in Excel or Google Sheets with your data</li>
            <li>Click <strong>Import</strong> to upload your CSV file and add the data to InsulaPro</li>
            <li>CSV files are compatible with Microsoft Excel, Google Sheets, and Apple Numbers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
