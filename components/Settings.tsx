import React, { useState } from 'react';
import { CompanyInfo } from './EstimatePDF';
import Logo from './Logo';

interface SettingsProps {
    onSave: (info: CompanyInfo) => void;
    currentInfo?: CompanyInfo | null;
    isInitialSetup?: boolean;
}

const Settings: React.FC<SettingsProps> = ({ onSave, currentInfo, isInitialSetup = false }) => {
    const [info, setInfo] = useState<CompanyInfo>(currentInfo || {
        name: '',
        address: '',
        phone: '',
        email: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(info);
    };

    const card = "rounded-xl border border-slate-200 bg-white shadow-md p-6";
    const h2 = "text-lg font-semibold tracking-tight";
    const label = "text-sm font-medium text-slate-600";
    const input = "mt-1 w-full rounded-lg border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

    const Wrapper: React.FC<{children: React.ReactNode}> = ({ children }) => {
        if (isInitialSetup) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md">{children}</div>
                </div>
            );
        }
        return <div className="p-4 mx-auto max-w-3xl">{children}</div>;
    }

    return (
        <Wrapper>
            {isInitialSetup && (
                <>
                    <Logo />
                    <div className="mb-6 text-center -mt-8">
                        <h1 className="text-2xl font-bold">Welcome!</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Enter your company info to get started. This will be saved for all future estimates.
                        </p>
                    </div>
                </>
            )}
            <form onSubmit={handleSubmit} className={`${card} space-y-4`}>
                {!isInitialSetup && <h2 className={h2}>Your Company Details</h2>}
                <label className="block">
                    <span className={label}>Company Name</span>
                    <input type="text" name="name" value={info.name} onChange={handleChange} className={input} required />
                </label>
                <label className="block">
                    <span className={label}>Address</span>
                    <input type="text" name="address" value={info.address} onChange={handleChange} className={input} required />
                </label>
                 <label className="block">
                    <span className={label}>Phone</span>
                    <input type="tel" name="phone" value={info.phone} onChange={handleChange} className={input} required />
                </label>
                 <label className="block">
                    <span className={label}>Email</span>
                    <input type="email" name="email" value={info.email} onChange={handleChange} className={input} required />
                </label>
                <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold shadow hover:bg-blue-700">
                    {isInitialSetup ? 'Save & Enter Application' : 'Save Changes'}
                </button>
            </form>
        </Wrapper>
    );
};

export default Settings;