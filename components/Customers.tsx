import React, { useState, useEffect } from 'react';
import { CustomerInfo } from './EstimatePDF';
import { getEstimatesForCustomer } from '../lib/db';

interface CustomersProps {
  customers: CustomerInfo[];
  onAddCustomer: (customer: Omit<CustomerInfo, 'id'>) => void;
  onViewCustomer: (customerId: number) => void;
}

const EMPTY_CUSTOMER: Omit<CustomerInfo, 'id'> = {
  name: '', address: '', email: '', phone: ''
};

const Customers: React.FC<CustomersProps> = ({ customers, onAddCustomer, onViewCustomer }) => {
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerActivity, setCustomerActivity] = useState<Record<number, number>>({});
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      setIsLoadingActivity(true);
      const activityMap: Record<number, number> = {};
      
      await Promise.all(customers.map(async (customer) => {
        try {
          const estimates = await getEstimatesForCustomer(customer.id);
          activityMap[customer.id] = estimates.length;
        } catch (e) {
          console.error(`Failed to get estimates for customer ${customer.id}`, e);
          activityMap[customer.id] = 0;
        }
      }));

      setCustomerActivity(activityMap);
      setIsLoadingActivity(false);
    };

    if (customers.length > 0) {
      fetchActivity();
    } else {
      setIsLoadingActivity(false);
    }
  }, [customers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewCustomer(prev => ({...prev, [name]: value}));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCustomer.name && newCustomer.address) {
      onAddCustomer(newCustomer);
      setNewCustomer(EMPTY_CUSTOMER);
      setIsModalOpen(false);
    }
  };

  const card = "rounded-2xl border border-gray-200 bg-white shadow-sm";
  const h2 = "text-xl font-semibold tracking-tight";
  const label = "text-sm font-medium text-gray-700";
  const input = "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base shadow-inner focus:outline-none focus:ring-2 focus:ring-black/10";

  return (
    <>
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Customer Management</h1>
          <p className="mt-1 text-sm text-gray-600">
            View your existing client list or add a new customer.
          </p>
        </div>

        <div className={`${card} p-4`}>
          <div className="flex justify-between items-center mb-4">
              <h2 className={h2}>Customer List</h2>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700"
              >
                + Add New Customer
              </button>
          </div>
          
          <div className="space-y-3">
            {customers.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No customers added yet.</p>
            ) : (
              [...customers].sort((a, b) => a.name.localeCompare(b.name)).map(customer => {
                const activityCount = customerActivity[customer.id];
                return (
                  <div key={customer.id} className="border rounded-lg bg-gray-50/50 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                      <button onClick={() => onViewCustomer(customer.id)} className="w-full text-left p-3 group">
                        <div className="flex justify-between items-start">
                          <div className="flex-grow">
                            <h3 className="font-semibold group-hover:text-blue-600">{customer.name}</h3>
                            <p className="text-sm text-gray-600">{customer.address}</p>
                            <p className="text-sm text-gray-600">{customer.phone}{customer.phone && customer.email && ' | '}{customer.email}</p>
                          </div>
                          {!isLoadingActivity && activityCount > 0 && (
                             <span className="flex-shrink-0 ml-4 mt-1 text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                               {activityCount} saved file{activityCount > 1 ? 's' : ''}
                             </span>
                          )}
                        </div>
                      </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" aria-modal="true" role="dialog">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-bold">Add New Customer</h2>
              <div className="mt-4 space-y-3">
                <label className="block"><span className={label}>Full Name</span><input type="text" name="name" value={newCustomer.name} onChange={handleChange} className={input} required /></label>
                <label className="block"><span className={label}>Address</span><input type="text" name="address" value={newCustomer.address} onChange={handleChange} className={input} required /></label>
                <label className="block"><span className={label}>Phone</span><input type="tel" name="phone" value={newCustomer.phone} onChange={handleChange} className={input} /></label>
                <label className="block"><span className={label}>Email</span><input type="email" name="email" value={newCustomer.email} onChange={handleChange} className={input} /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Cancel</button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white shadow hover:bg-blue-700">Save Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Customers;
