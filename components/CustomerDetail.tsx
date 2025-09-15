import React, { useState, useEffect } from 'react';
import { CustomerInfo } from './EstimatePDF';
import { getEstimatesForCustomer, EstimateRecord } from '../lib/db';
import { getGCSDownloadUrl } from '../lib/gcs';

interface CustomerDetailProps {
    customerId: number;
    customers: CustomerInfo[];
    onBack: () => void;
    onJobSold: (estimate: EstimateRecord) => void;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, customers, onBack, onJobSold }) => {
    const [customer, setCustomer] = useState<CustomerInfo | null>(null);
    const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const currentCustomer = customers.find(c => c.id === customerId);
        if (currentCustomer) {
            setCustomer(currentCustomer);
            setIsLoading(true);
            getEstimatesForCustomer(customerId)
                .then(setEstimates)
                .catch(console.error)
                .finally(() => setIsLoading(false));
        } else {
            // If customer not found (e.g., bad id), handle gracefully
            setCustomer(null);
            setIsLoading(false);
        }
    }, [customerId, customers]);

    const handleViewPdf = async (filePath: string) => {
        if (!filePath) {
            alert("File path is missing.");
            return;
        }
        try {
            const url = await getGCSDownloadUrl(filePath);
            window.open(url, '_blank');
        } catch (error) {
            console.error("Error getting GCS download URL", error);
            alert("Could not open PDF. Please check the console for details.");
        }
    };

    const card = "rounded-2xl border border-gray-200 bg-white shadow-sm";

    if (isLoading) {
        return (
            <div className="mx-auto max-w-4xl p-4 sm:p-6">
                <p>Loading customer data...</p>
            </div>
        );
    }
    
    if (!customer) {
        return (
            <div className="mx-auto max-w-4xl p-4 sm:p-6">
                <h1 className="text-xl font-bold text-red-600">Customer Not Found</h1>
                <p className="mt-2 text-gray-600">The requested customer could not be found. They may have been removed.</p>
                <button onClick={onBack} className="mt-4 text-sm font-medium text-blue-600 hover:underline">
                    &larr; Back to Customer List
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-4 sm:p-6">
            <button onClick={onBack} className="mb-4 text-sm font-medium text-blue-600 hover:underline">
                &larr; Back to Customer List
            </button>
            
            <div className={`${card} p-6 mb-6`}>
                <h1 className="text-2xl font-bold">{customer.name}</h1>
                <p className="text-md text-gray-600">{customer.address}</p>
                <p className="text-md text-gray-600">{customer.phone}{customer.phone && customer.email && ' | '}{customer.email}</p>
            </div>
            
            <div className={`${card} p-4`}>
                <h2 className="text-xl font-semibold tracking-tight">Saved Files</h2>
                <div className="mt-4">
                    {estimates.length === 0 ? (
                        <p className="text-sm text-gray-500 p-3">No saved files for this customer.</p>
                    ) : (
                        <ul className="space-y-3">
                            {estimates.map(est => (
                                <li key={est.id} className="text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-3 rounded-lg shadow-sm border">
                                    <div className="mb-2 sm:mb-0">
                                        <span className="font-medium text-gray-800">{est.estimateNumber}</span>
                                        <span className="text-gray-500 ml-3 text-xs">{new Date(est.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {est.estimateNumber.startsWith('SUMM-') ? (
                                            <button onClick={() => handleViewPdf(est.estimatePdfPath)} className="rounded-md bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-200">View Summary</button>
                                        ) : (
                                            <>
                                                <button onClick={() => handleViewPdf(est.estimatePdfPath)} className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200">Estimate PDF</button>
                                                <button onClick={() => handleViewPdf(est.materialOrderPdfPath)} className="rounded-md bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200">Materials PDF</button>
                                            </>
                                        )}
                                        {est.estimateNumber.startsWith('EST-') && est.calcData && (
                                            <button onClick={() => onJobSold(est)} className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-green-700">
                                                Mark Job as Sold
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomerDetail;
