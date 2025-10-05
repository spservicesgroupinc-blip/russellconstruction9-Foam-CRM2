import { supabase } from './supabase';
import { EstimateRecord, InventoryItem, JobStatus } from './db';
import { CustomerInfo } from '../components/EstimatePDF';
import { Employee, Task, Automation, TimeEntry, DriveFile } from '../components/types';

export const getCustomers = async (): Promise<CustomerInfo[]> => {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

export const addCustomer = async (customer: Omit<CustomerInfo, 'id'>): Promise<CustomerInfo> => {
    const { data, error } = await supabase
        .from('customers')
        .insert([{
            name: customer.name,
            address: customer.address,
            email: customer.email || '',
            phone: customer.phone || '',
            notes: customer.notes || '',
            lat: customer.lat || null,
            lng: customer.lng || null
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateCustomer = async (customer: CustomerInfo): Promise<void> => {
    const { error } = await supabase
        .from('customers')
        .update({
            name: customer.name,
            address: customer.address,
            email: customer.email || '',
            phone: customer.phone || '',
            notes: customer.notes || '',
            lat: customer.lat || null,
            lng: customer.lng || null
        })
        .eq('id', customer.id);

    if (error) throw error;
};

export const getJobs = async (): Promise<EstimateRecord[]> => {
    const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        customerId: row.customer_id,
        estimateNumber: row.estimate_number,
        status: row.status as JobStatus,
        calcData: row.calc_data,
        costsData: row.costs_data,
        scopeOfWork: row.scope_of_work,
        createdAt: row.created_at,
        estimatePdf: new Blob(),
        materialOrderPdf: new Blob(),
        invoicePdf: row.invoice_pdf_url ? new Blob() : undefined
    }));
};

export const addJob = async (jobData: Omit<EstimateRecord, 'id' | 'createdAt'>): Promise<EstimateRecord> => {
    const { data, error } = await supabase
        .from('estimates')
        .insert([{
            customer_id: jobData.customerId,
            estimate_number: jobData.estimateNumber,
            status: jobData.status,
            calc_data: jobData.calcData,
            costs_data: jobData.costsData,
            scope_of_work: jobData.scopeOfWork
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        customerId: data.customer_id,
        estimateNumber: data.estimate_number,
        status: data.status as JobStatus,
        calcData: data.calc_data,
        costsData: data.costs_data,
        scopeOfWork: data.scope_of_work,
        createdAt: data.created_at,
        estimatePdf: jobData.estimatePdf,
        materialOrderPdf: jobData.materialOrderPdf,
        invoicePdf: jobData.invoicePdf
    };
};

export const updateJob = async (jobId: number, updates: Partial<Omit<EstimateRecord, 'id'>>): Promise<EstimateRecord> => {
    const updateData: any = {};

    if (updates.customerId !== undefined) updateData.customer_id = updates.customerId;
    if (updates.estimateNumber !== undefined) updateData.estimate_number = updates.estimateNumber;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.calcData !== undefined) updateData.calc_data = updates.calcData;
    if (updates.costsData !== undefined) updateData.costs_data = updates.costsData;
    if (updates.scopeOfWork !== undefined) updateData.scope_of_work = updates.scopeOfWork;

    const { data, error } = await supabase
        .from('estimates')
        .update(updateData)
        .eq('id', jobId)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        customerId: data.customer_id,
        estimateNumber: data.estimate_number,
        status: data.status as JobStatus,
        calcData: data.calc_data,
        costsData: data.costs_data,
        scopeOfWork: data.scope_of_work,
        createdAt: data.created_at,
        estimatePdf: updates.estimatePdf || new Blob(),
        materialOrderPdf: updates.materialOrderPdf || new Blob(),
        invoicePdf: updates.invoicePdf
    };
};

export const deleteJob = async (jobId: number): Promise<void> => {
    const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', jobId);

    if (error) throw error;
};

export const getEmployees = async (): Promise<Employee[]> => {
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

    if (error) throw error;
    return data || [];
};

export const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<Employee> => {
    const { data, error } = await supabase
        .from('employees')
        .insert([{
            name: employee.name,
            role: employee.role,
            pin: employee.pin
        }])
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const getInventoryItems = async (): Promise<InventoryItem[]> => {
    const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name');

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        unitCost: row.unit_cost || undefined,
        notes: row.notes || ''
    }));
};

export const addInventoryItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const { data, error } = await supabase
        .from('inventory')
        .insert([{
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit_cost: item.unitCost || null,
            notes: item.notes || ''
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        name: data.name,
        category: data.category,
        quantity: data.quantity,
        unitCost: data.unit_cost || undefined,
        notes: data.notes || ''
    };
};

export const updateInventoryItem = async (item: InventoryItem): Promise<void> => {
    const { error } = await supabase
        .from('inventory')
        .update({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit_cost: item.unitCost || null,
            notes: item.notes || ''
        })
        .eq('id', item.id);

    if (error) throw error;
};

export const deleteInventoryItem = async (itemId: number): Promise<void> => {
    const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId);

    if (error) throw error;
};

export const getTasks = async (): Promise<Task[]> => {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        title: row.title,
        description: row.description || '',
        dueDate: row.due_date || undefined,
        completed: row.completed,
        assignedTo: row.assigned_to || [],
        createdAt: row.created_at,
        completedAt: row.completed_at || undefined
    }));
};

export const addTask = async (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'completedAt'>): Promise<Task> => {
    const { data, error } = await supabase
        .from('tasks')
        .insert([{
            title: task.title,
            description: task.description || '',
            due_date: task.dueDate || null,
            completed: false,
            assigned_to: task.assignedTo || []
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        title: data.title,
        description: data.description || '',
        dueDate: data.due_date || undefined,
        completed: data.completed,
        assignedTo: data.assigned_to || [],
        createdAt: data.created_at,
        completedAt: data.completed_at || undefined
    };
};

export const updateTask = async (task: Task): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .update({
            title: task.title,
            description: task.description || '',
            due_date: task.dueDate || null,
            completed: task.completed,
            assigned_to: task.assignedTo || [],
            completed_at: task.completedAt || null
        })
        .eq('id', task.id);

    if (error) throw error;
};

export const deleteTask = async (taskId: number): Promise<void> => {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) throw error;
};

export const getAutomations = async (): Promise<Automation[]> => {
    const { data: automations, error: autoError } = await supabase
        .from('automations')
        .select('*')
        .order('name');

    if (autoError) throw autoError;

    const { data: actions, error: actionsError } = await supabase
        .from('automation_actions')
        .select('*')
        .order('order');

    if (actionsError) throw actionsError;

    return (automations || []).map(auto => ({
        id: auto.id,
        name: auto.name,
        trigger_type: auto.trigger_type,
        trigger_config: auto.trigger_config || {},
        is_enabled: auto.is_enabled,
        actions: (actions || [])
            .filter(action => action.automation_id === auto.id)
            .map(action => ({
                id: action.id,
                automation_id: action.automation_id,
                action_type: action.action_type,
                action_config: action.action_config || {},
                order: action.order
            }))
    }));
};

export const addAutomation = async (automation: Omit<Automation, 'id'>): Promise<Automation> => {
    const { data: autoData, error: autoError } = await supabase
        .from('automations')
        .insert([{
            name: automation.name,
            trigger_type: automation.trigger_type,
            trigger_config: automation.trigger_config || {},
            is_enabled: automation.is_enabled
        }])
        .select()
        .single();

    if (autoError) throw autoError;

    const savedActions = [];
    if (automation.actions && automation.actions.length > 0) {
        const { data: actionsData, error: actionsError } = await supabase
            .from('automation_actions')
            .insert(
                automation.actions.map(action => ({
                    automation_id: autoData.id,
                    action_type: action.action_type,
                    action_config: action.action_config || {},
                    order: action.order
                }))
            )
            .select();

        if (actionsError) throw actionsError;
        savedActions.push(...(actionsData || []));
    }

    return {
        id: autoData.id,
        name: autoData.name,
        trigger_type: autoData.trigger_type,
        trigger_config: autoData.trigger_config || {},
        is_enabled: autoData.is_enabled,
        actions: savedActions.map(action => ({
            id: action.id,
            automation_id: action.automation_id,
            action_type: action.action_type,
            action_config: action.action_config || {},
            order: action.order
        }))
    };
};

export const updateAutomation = async (automation: Automation): Promise<void> => {
    const { error: autoError } = await supabase
        .from('automations')
        .update({
            name: automation.name,
            trigger_type: automation.trigger_type,
            trigger_config: automation.trigger_config || {},
            is_enabled: automation.is_enabled
        })
        .eq('id', automation.id);

    if (autoError) throw autoError;

    const { error: deleteError } = await supabase
        .from('automation_actions')
        .delete()
        .eq('automation_id', automation.id);

    if (deleteError) throw deleteError;

    if (automation.actions && automation.actions.length > 0) {
        const { error: actionsError } = await supabase
            .from('automation_actions')
            .insert(
                automation.actions.map(action => ({
                    automation_id: automation.id!,
                    action_type: action.action_type,
                    action_config: action.action_config || {},
                    order: action.order
                }))
            );

        if (actionsError) throw actionsError;
    }
};

export const deleteAutomation = async (automationId: number): Promise<void> => {
    const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', automationId);

    if (error) throw error;
};

export const getTimeEntries = async (): Promise<TimeEntry[]> => {
    const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .order('start_time', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        employeeId: row.employee_id,
        jobId: row.job_id || 0,
        startTime: row.start_time,
        endTime: row.end_time || undefined,
        startLat: row.start_lat || undefined,
        startLng: row.start_lng || undefined,
        endLat: row.end_lat || undefined,
        endLng: row.end_lng || undefined,
        durationHours: row.duration_hours || undefined
    }));
};

export const addTimeEntry = async (entry: Omit<TimeEntry, 'id'>): Promise<TimeEntry> => {
    const { data, error } = await supabase
        .from('time_entries')
        .insert([{
            employee_id: entry.employeeId,
            job_id: entry.jobId || null,
            start_time: entry.startTime,
            end_time: entry.endTime || null,
            start_lat: entry.startLat || null,
            start_lng: entry.startLng || null,
            end_lat: entry.endLat || null,
            end_lng: entry.endLng || null,
            duration_hours: entry.durationHours || null
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        employeeId: data.employee_id,
        jobId: data.job_id || 0,
        startTime: data.start_time,
        endTime: data.end_time || undefined,
        startLat: data.start_lat || undefined,
        startLng: data.start_lng || undefined,
        endLat: data.end_lat || undefined,
        endLng: data.end_lng || undefined,
        durationHours: data.duration_hours || undefined
    };
};

export const updateTimeEntry = async (entry: TimeEntry): Promise<void> => {
    const { error } = await supabase
        .from('time_entries')
        .update({
            employee_id: entry.employeeId,
            job_id: entry.jobId || null,
            start_time: entry.startTime,
            end_time: entry.endTime || null,
            start_lat: entry.startLat || null,
            start_lng: entry.startLng || null,
            end_lat: entry.endLat || null,
            end_lng: entry.endLng || null,
            duration_hours: entry.durationHours || null
        })
        .eq('id', entry.id);

    if (error) throw error;
};

export const getDriveFiles = async (customerId: number): Promise<DriveFile[]> => {
    const { data, error } = await supabase
        .from('drive_files')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
        id: row.id,
        customerId: row.customer_id,
        fileId: row.file_id,
        fileName: row.file_name,
        webLink: row.web_link,
        iconLink: row.icon_link
    }));
};

export const addDriveFile = async (file: Omit<DriveFile, 'id'>): Promise<DriveFile> => {
    const { data, error } = await supabase
        .from('drive_files')
        .insert([{
            customer_id: file.customerId,
            file_id: file.fileId,
            file_name: file.fileName,
            web_link: file.webLink,
            icon_link: file.iconLink
        }])
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        customerId: data.customer_id,
        fileId: data.file_id,
        fileName: data.file_name,
        webLink: data.web_link,
        iconLink: data.icon_link
    };
};

export const deleteDriveFile = async (fileId: number): Promise<void> => {
    const { error } = await supabase
        .from('drive_files')
        .delete()
        .eq('id', fileId);

    if (error) throw error;
};
