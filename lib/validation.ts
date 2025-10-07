import { CustomerInfo } from '../components/EstimatePDF';
import { Employee, Task } from '../components/types';
import { InventoryItem } from './db';

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

export const validateCustomer = (customer: Partial<CustomerInfo>): void => {
    if (!customer.name || customer.name.trim().length === 0) {
        throw new ValidationError('Customer name is required');
    }

    if (!customer.address || customer.address.trim().length === 0) {
        throw new ValidationError('Customer address is required');
    }

    if (customer.email && !isValidEmail(customer.email)) {
        throw new ValidationError('Invalid email format');
    }

    if (customer.phone && !isValidPhone(customer.phone)) {
        throw new ValidationError('Invalid phone number format');
    }
};

export const validateEmployee = (employee: Partial<Employee>): void => {
    if (!employee.name || employee.name.trim().length === 0) {
        throw new ValidationError('Employee name is required');
    }

    if (!employee.role || employee.role.trim().length === 0) {
        throw new ValidationError('Employee role is required');
    }

    if (!employee.pin || employee.pin.trim().length !== 4) {
        throw new ValidationError('PIN must be exactly 4 digits');
    }

    if (!/^\d{4}$/.test(employee.pin)) {
        throw new ValidationError('PIN must contain only numbers');
    }
};

export const validateInventoryItem = (item: Partial<InventoryItem>): void => {
    if (!item.name || item.name.trim().length === 0) {
        throw new ValidationError('Item name is required');
    }

    if (!item.category || item.category.trim().length === 0) {
        throw new ValidationError('Item category is required');
    }

    if (item.quantity === undefined || item.quantity < 0) {
        throw new ValidationError('Quantity must be 0 or greater');
    }

    if (item.unitCost !== undefined && item.unitCost < 0) {
        throw new ValidationError('Unit cost must be 0 or greater');
    }
};

export const validateTask = (task: Partial<Task>): void => {
    if (!task.title || task.title.trim().length === 0) {
        throw new ValidationError('Task title is required');
    }

    if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (isNaN(dueDate.getTime())) {
            throw new ValidationError('Invalid due date');
        }
    }
};

export const validateEstimateNumber = (estimateNumber: string): void => {
    if (!estimateNumber || estimateNumber.trim().length === 0) {
        throw new ValidationError('Estimate number is required');
    }
};

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const isValidPhone = (phone: string): boolean => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    return cleanPhone.length >= 10 && /^\d+$/.test(cleanPhone);
};

export const sanitizeString = (str: string): string => {
    return str.trim().replace(/\s+/g, ' ');
};

export const sanitizeCustomer = (customer: Partial<CustomerInfo>): Partial<CustomerInfo> => {
    return {
        ...customer,
        name: customer.name ? sanitizeString(customer.name) : '',
        address: customer.address ? sanitizeString(customer.address) : '',
        email: customer.email ? sanitizeString(customer.email) : '',
        phone: customer.phone ? sanitizeString(customer.phone) : '',
        notes: customer.notes ? sanitizeString(customer.notes) : ''
    };
};

export const sanitizeEmployee = (employee: Partial<Employee>): Partial<Employee> => {
    return {
        ...employee,
        name: employee.name ? sanitizeString(employee.name) : '',
        role: employee.role ? sanitizeString(employee.role) : '',
        pin: employee.pin ? employee.pin.trim() : ''
    };
};
