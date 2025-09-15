export interface Job {
  id: string;
  name: string;
  start: string; // "YYYY-MM-DD"
  end: string;   // "YYYY-MM-DD"
  color: string;
  links: string[]; // array of predecessor job IDs
}

export type EditingJob = Job;
