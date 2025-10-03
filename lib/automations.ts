
import { Automation, AutomationAction, Task, Job } from '../components/types.ts';
import { EstimateRecord } from './db.ts';
import { CustomerInfo } from '../components/PDF.tsx';
import { fmtInput } from '../components/utils.ts';

interface ActionHandlers {
    createTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'>) => Promise<Task>;
    addToSchedule: (job: Omit<Job, 'id'>) => Job;
    sendEmail: (to: string, subject: string, body: string) => Promise<void>;
    deductInventoryForJob: (job: EstimateRecord) => Promise<void>;
}

const replacePlaceholders = (text: string, data: any): string => {
    if (!text) return '';
    let result = text;
    result = result.replace(/\[customer_name\]/g, data.calcData?.customer?.name || data.name || '');
    result = result.replace(/\[customer_address\]/g, data.calcData?.customer?.address || data.address || '');
    result = result.replace(/\[job_number\]/g, data.estimateNumber || '');
    result = result.replace(/\[job_value\]/g, data.costsData?.finalQuote?.toFixed(2) || '');
    return result;
};


export const processAutomations = (
    triggerType: 'new_customer' | 'job_status_updated',
    data: CustomerInfo | EstimateRecord,
    allAutomations: Automation[],
    handlers: ActionHandlers
) => {
    const automationsToRun = allAutomations.filter(a => a.is_enabled && a.trigger_type === triggerType);

    for (const automation of automationsToRun) {
        let shouldRun = false;

        if (triggerType === 'new_customer') {
            shouldRun = true;
        } else if (triggerType === 'job_status_updated') {
            const job = data as EstimateRecord;
            if (job.status === automation.trigger_config.to_status) {
                shouldRun = true;
            }
        }

        if (shouldRun) {
            console.log(`Running automation: ${automation.name}`);
            executeAutomation(automation, data, handlers);
        }
    }
};

const executeAutomation = async (automation: Automation, data: CustomerInfo | EstimateRecord, handlers: ActionHandlers) => {
    const actions = automation.actions && automation.actions.length > 0
        ? automation.actions.sort((a, b) => a.order - b.order)
        : automation.action_type
            ? [{ action_type: automation.action_type, action_config: automation.action_config || {}, order: 0 }]
            : [];

    for (const action of actions) {
        try {
            await executeAction(action, data, handlers);
        } catch (error) {
            console.error(`Action "${action.action_type}" in automation "${automation.name}" failed:`, error);
        }
    }
};

const executeAction = async (action: AutomationAction | { action_type: string; action_config: any; order: number }, data: CustomerInfo | EstimateRecord, handlers: ActionHandlers) => {
    switch (action.action_type) {
        case 'webhook':
            if (action.action_config.url) {
                try {
                    await fetch(action.action_config.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    });
                } catch (error) {
                    console.error(`Webhook action failed:`, error);
                }
            }
            break;

        case 'create_task':
            if (action.action_config.task_title) {
                const title = replacePlaceholders(action.action_config.task_title, data);
                const description = replacePlaceholders(action.action_config.task_description || '', data);
                await handlers.createTask({
                    title,
                    description,
                    assignedTo: [],
                });
            }
            break;

        case 'add_to_schedule':
            const jobData = data as EstimateRecord;
            if (jobData && jobData.calcData?.customer) {
                const jobName = replacePlaceholders("[customer_name] ([job_number])", jobData);
                handlers.addToSchedule({
                    name: jobName,
                    start: fmtInput(new Date()),
                    end: fmtInput(new Date()),
                    color: '#3498DB',
                    links: [],
                });
            }
            break;

        case 'send_email':
            const customerEmail = (data as any).calcData?.customer?.email || (data as CustomerInfo).email;
            if (customerEmail && action.action_config.email_subject) {
                const subject = replacePlaceholders(action.action_config.email_subject, data);
                const body = replacePlaceholders(action.action_config.email_body || '', data);
                await handlers.sendEmail(customerEmail, subject, body);
            } else {
                console.warn(`Send email action skipped: No customer email found.`);
            }
            break;

        case 'update_inventory':
            if ('estimateNumber' in data) {
                await handlers.deductInventoryForJob(data as EstimateRecord);
            } else {
                console.warn(`Update inventory action skipped: Can only be triggered by job-related events.`);
            }
            break;
    }
};
