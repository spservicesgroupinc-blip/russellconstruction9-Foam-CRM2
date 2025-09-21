export interface Job {
    id: string;
    name: string;
    start: string; // "YYYY-MM-DD"
    end: string; // "YYYY-MM-DD"
    color: string;
    links: string[];
    assignedTeam?: number[];
}

export interface EditingJob extends Partial<Job> {
    id: string; // id is not partial
}

export interface Employee {
    id?: number;
    name: string;
    role: string;
    pin: string; // 4-digit PIN for time clock
}

export interface TimeEntry {
    id?: number;
    employeeId: number;
    jobId: number;
    startTime: string; // ISO string
    endTime?: string; // ISO string
    startLat?: number;
    startLng?: number;
    endLat?: number;
    endLng?: number;
    durationHours?: number;
}