import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: number;
          name: string;
          address: string;
          email: string;
          phone: string;
          notes: string;
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      employees: {
        Row: {
          id: number;
          name: string;
          role: string;
          pin: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
      };
      inventory: {
        Row: {
          id: number;
          name: string;
          category: string;
          quantity: number;
          unit_cost: number | null;
          notes: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };
      tasks: {
        Row: {
          id: number;
          title: string;
          description: string;
          due_date: string | null;
          completed: boolean;
          assigned_to: number[];
          completed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      estimates: {
        Row: {
          id: number;
          customer_id: number;
          estimate_number: string;
          status: string;
          calc_data: any;
          costs_data: any;
          scope_of_work: string;
          estimate_pdf_url: string | null;
          material_order_pdf_url: string | null;
          invoice_pdf_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['estimates']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['estimates']['Insert']>;
      };
      time_entries: {
        Row: {
          id: number;
          employee_id: number;
          job_id: number | null;
          start_time: string;
          end_time: string | null;
          start_lat: number | null;
          start_lng: number | null;
          end_lat: number | null;
          end_lng: number | null;
          duration_hours: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['time_entries']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['time_entries']['Insert']>;
      };
      drive_files: {
        Row: {
          id: number;
          customer_id: number;
          file_id: string;
          file_name: string;
          web_link: string;
          icon_link: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['drive_files']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['drive_files']['Insert']>;
      };
      automations: {
        Row: {
          id: number;
          name: string;
          trigger_type: string;
          trigger_config: any;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['automations']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['automations']['Insert']>;
      };
      automation_actions: {
        Row: {
          id: number;
          automation_id: number;
          action_type: string;
          action_config: any;
          order: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['automation_actions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['automation_actions']['Insert']>;
      };
    };
  };
}
