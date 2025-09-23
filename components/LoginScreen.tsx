import React, { useState } from 'react';
import { Employee } from './types.ts';
import { CurrentUser } from '../App.tsx';
import Logo from './Logo.tsx';
import { CustomerInfo } from './EstimatePDF.tsx';

interface LoginScreenProps {
    employees: Employee[];
    onLogin: (user: CurrentUser) => void;
    onAddCustomer: (customer: Omit<CustomerInfo, 'id'>) => Promise<CustomerInfo>;
}

const EMPTY_INQUIRY = { name: '', email: '', phone: '', role: '', message: '' };

const LoginScreen: React.FC<LoginScreenProps> = ({ employees, onLogin, onAddCustomer }) => {
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    
    // State for the new form
    const [inquiry, setInquiry] = useState(EMPTY_INQUIRY);
    const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');


    const handleEmployeeSelect = (employee: Employee) => {
        setSelectedEmployee(employee);
        setError('');
        setPin('');
    };

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedEmployee && selectedEmployee.pin === pin) {
            onLogin({ role: 'employee', data: selectedEmployee });
        } else {
            setError('Invalid PIN. Please try again.');
        }
    };

    const handleAdminLogin = () => {
        onLogin({ role: 'admin' });
    };

    const handleInquiryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setInquiry(prev => ({ ...prev, [name]: value }));
    };

    const handleInquirySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setInquiryStatus('submitting');
        try {
            await onAddCustomer({
                name: inquiry.name,
                email: inquiry.email,
                phone: inquiry.phone,
                address: 'N/A - Lead Capture',
                notes: `Inquiry Type: ${inquiry.role}\n\nMessage:\n${inquiry.message}`
            });
            setInquiryStatus('success');
            setInquiry(EMPTY_INQUIRY);
            setTimeout(() => setInquiryStatus('idle'), 4000);
        } catch (err) {
            console.error(err);
            setInquiryStatus('error');
        }
    };

    const card = "rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-sm p-6";
    const input = "mt-1 w-full rounded-lg border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600/50 px-4 py-2.5 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white";
    const label = "text-sm font-medium text-slate-600 dark:text-slate-300";

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-4">
            <Logo />
            <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Admin Login */}
                <div className={`${card} flex flex-col items-center justify-center`}>
                    <h2 className="text-xl font-bold dark:text-white">Manager / Admin</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Full access to all features.</p>
                    <button 
                        onClick={handleAdminLogin} 
                        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold shadow hover:bg-blue-700 transition-colors"
                    >
                        Enter Admin Dashboard
                    </button>
                </div>

                {/* Employee Login */}
                <div className={card}>
                    <h2 className="text-xl font-bold dark:text-white text-center">Employee Clock-In</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">Select your name to begin.</p>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-1">
                        {employees.map(employee => (
                            <button 
                                key={employee.id} 
                                onClick={() => handleEmployeeSelect(employee)}
                                className="p-3 text-center rounded-lg bg-slate-100 dark:bg-slate-600/50 border border-transparent hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            >
                                <span className="font-semibold text-sm">{employee.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

            </div>

             {/* NEW SECTION for Customer Inquiry */}
            <div className="w-full max-w-4xl mx-auto mt-6">
                <div className={card}>
                    <div className="text-center">
                        <h2 className="text-xl font-bold dark:text-white">New Customer Inquiry</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Interested in our services? Fill out the form below.</p>
                    </div>
                    {inquiryStatus === 'success' ? (
                        <div className="mt-4 p-4 text-center rounded-lg bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200">
                            <h3 className="font-semibold">Thank you!</h3>
                            <p className="text-sm">Your inquiry has been submitted. We will be in touch shortly.</p>
                        </div>
                    ) : (
                        <form name="contact" onSubmit={handleInquirySubmit} className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className={label}>Your Name</span>
                                    <input type="text" name="name" value={inquiry.name} onChange={handleInquiryChange} className={input} required />
                                </label>
                                <label className="block">
                                    <span className={label}>Your Email</span>
                                    <input type="email" name="email" value={inquiry.email} onChange={handleInquiryChange} className={input} required />
                                </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block">
                                    <span className={label}>Phone Number</span>
                                    <input type="tel" name="phone" value={inquiry.phone} onChange={handleInquiryChange} className={input} />
                                </label>
                                <label className="block">
                                    <span className={label}>Inquiry Type</span>
                                    <select name="role" value={inquiry.role} onChange={handleInquiryChange} className={`${input} appearance-none`}>
                                        <option value="">-- Please choose an option --</option>
                                        <option value="Residential Quote">Residential Quote</option>
                                        <option value="Commercial Quote">Commercial Quote</option>
                                        <option value="General Question">General Question</option>
                                    </select>
                                </label>
                            </div>
                            <label className="block">
                                <span className={label}>Message</span>
                                <textarea name="message" value={inquiry.message} onChange={handleInquiryChange} rows={4} className={input}></textarea>
                            </label>
                            <div>
                                <button type="submit" disabled={inquiryStatus === 'submitting'} className="w-full rounded-lg bg-green-600 px-4 py-3 text-white font-semibold shadow hover:bg-green-700 transition-colors disabled:bg-slate-400">
                                    {inquiryStatus === 'submitting' ? 'Submitting...' : 'Send Inquiry'}
                                </button>
                                {inquiryStatus === 'error' && <p className="mt-2 text-center text-sm text-red-500">Failed to submit inquiry. Please try again later.</p>}
                            </div>
                        </form>
                    )}
                </div>
            </div>


            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelectedEmployee(null)}>
                    <div className="relative w-full max-w-sm rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedEmployee(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close modal">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <form onSubmit={handlePinSubmit}>
                            <h2 className="text-xl font-bold text-center">Enter PIN for {selectedEmployee.name}</h2>
                            {error && <p className="mt-2 text-center text-sm text-red-500">{error}</p>}
                            <input 
                                type="password" 
                                value={pin} 
                                onChange={e => setPin(e.target.value)} 
                                maxLength={4} 
                                className={`${input} text-center text-3xl tracking-[1em] mt-4`} 
                                autoFocus 
                            />
                            <button type="submit" className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold shadow-sm hover:bg-blue-700">Submit</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginScreen;
