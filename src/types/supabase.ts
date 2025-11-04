export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string;
          phone_e164: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          zone_id: string | null;
          notes: string | null;
          tags: string[] | null;
          source: string | null;
          preferred_contact: 'phone' | 'email' | 'sms' | null;
          sms_notifications: boolean;
          email_notifications: boolean;
          last_service_date: string | null;
          next_service_date: string | null;
          service_frequency: string | null;
          lifetime_value: number | null;
          total_jobs: number | null;
          completed_jobs: number | null;
          cancelled_jobs: number | null;
          average_rating: number | null;
          last_rating: number | null;
          last_rating_date: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      jobs: {
        Row: {
          id: string;
          customer_id: string;
          scheduled_date: string;
          scheduled_time: string | null;
          scheduled_end_time: string | null;
          duration: number;
          status: 'scheduled' | 'confirmed' | 'in_transit' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
          assigned_to: string | null;
          technician_id: string | null;
          truck_id: string | null;
          notes: string | null;
          internal_notes: string | null;
          completion_notes: string | null;
          photos_before: string[] | null;
          photos_after: string[] | null;
          signature_url: string | null;
          customer_rating: number | null;
          rating_received_at: string | null;
          reminder_sent_at: string | null;
          tech_on_way_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          cancelled_reason: string | null;
          reschedule_request: string | null;
          reschedule_requested_at: string | null;
          completion_notification_sent_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
      };
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          price: number;
          duration_minutes: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
      };
      job_services: {
        Row: {
          id: string;
          job_id: string;
          service_id: string;
          quantity: number;
          price: number;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['job_services']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['job_services']['Insert']>;
      };
      technicians: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          color: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['technicians']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['technicians']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          role: 'admin' | 'dispatcher' | 'technician' | 'viewer';
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      trucks: {
        Row: {
          id: string;
          number: string;
          name: string;
          vin: string | null;
          license_plate: string | null;
          make: string | null;
          model: string | null;
          year: number | null;
          color: string | null;
          is_active: boolean;
          next_maintenance_date: string | null;
          last_maintenance_date: string | null;
          mileage: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['trucks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['trucks']['Insert']>;
      };
      invoices: {
        Row: {
          id: string;
          number: string;
          customer_id: string;
          job_id: string | null;
          subtotal: number;
          tax_amount: number;
          discount_amount: number;
          total: number;
          status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          issued_date: string;
          due_date: string | null;
          paid_at: string | null;
          payment_method: string | null;
          notes: string | null;
          terms: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          total: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoice_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>;
      };
      zones: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          polygon: any | null; // GeoJSON
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['zones']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['zones']['Insert']>;
      };
      sms_messages: {
        Row: {
          id: string;
          sid: string | null;
          to_number: string;
          from_number: string;
          body: string;
          direction: 'inbound' | 'outbound';
          status: string | null;
          error_message: string | null;
          customer_id: string | null;
          job_id: string | null;
          technician_id: string | null;
          metadata: Record<string, any> | null;
          price: number | null;
          price_unit: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sms_messages']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sms_messages']['Insert']>;
      };
      sms_templates: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          body: string;
          variables: string[] | null;
          is_active: boolean;
          usage_count: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sms_templates']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sms_templates']['Insert']>;
      };
      sms_opt_outs: {
        Row: {
          id: string;
          phone_number: string;
          customer_id: string | null;
          opted_out_at: string;
          opted_in_at: string | null;
          reason: string | null;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['sms_opt_outs']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['sms_opt_outs']['Insert']>;
      };
      sms_campaigns: {
        Row: {
          id: string;
          name: string;
          message: string;
          target_criteria: Record<string, any> | null;
          scheduled_at: string | null;
          sent_at: string | null;
          status: string;
          total_recipients: number;
          messages_sent: number;
          messages_delivered: number;
          messages_failed: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sms_campaigns']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sms_campaigns']['Insert']>;
      };
      sms_campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          customer_id: string | null;
          phone_number: string;
          message_sid: string | null;
          status: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          error_message: string | null;
        };
        Insert: Omit<Database['public']['Tables']['sms_campaign_recipients']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['sms_campaign_recipients']['Insert']>;
      };
      truck_threads: {
        Row: {
          id: string;
          truck_id: string;
          title: string;
          status: 'open' | 'in_progress' | 'resolved' | 'closed';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          created_by: string | null;
          assigned_to: string | null;
          resolved_by: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['truck_threads']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['truck_threads']['Insert']>;
      };
      truck_posts: {
        Row: {
          id: string;
          thread_id: string;
          post_type: 'message' | 'status_change' | 'assignment' | 'photo' | 'expense';
          content: string | null;
          user_id: string | null;
          is_urgent: boolean;
          metadata: Record<string, any> | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['truck_posts']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['truck_posts']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string;
          amount: number;
          payment_method: string;
          transaction_id: string | null;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      email_logs: {
        Row: {
          id: string;
          recipient_email: string;
          subject: string;
          template: string | null;
          status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
          customer_id: string | null;
          job_id: string | null;
          invoice_id: string | null;
          metadata: Record<string, any> | null;
          error_message: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          opened_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['email_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['email_logs']['Insert']>;
      };
    };
    Views: {
      sms_conversations: {
        Row: {
          customer_id: string | null;
          message_count: number;
          inbound_count: number;
          outbound_count: number;
          failed_count: number;
          last_message_at: string;
          first_message_at: string;
          last_message_body: string | null;
        };
      };
      sms_activity_daily: {
        Row: {
          date: string;
          total_messages: number;
          messages_sent: number;
          messages_received: number;
          delivered: number;
          failed: number;
          unique_customers: number;
          total_cost: number | null;
        };
      };
      customer_sms_summary: {
        Row: {
          customer_id: string;
          customer_name: string;
          phone_e164: string | null;
          sms_notifications: boolean;
          total_messages: number;
          messages_sent_to: number;
          messages_received_from: number;
          last_message_at: string | null;
          is_opted_out: boolean;
        };
      };
      job_summary_view: {
        Row: {
          id: string;
          customer_id: string;
          customer_name: string;
          scheduled_date: string;
          status: string;
          technician_name: string | null;
          truck_name: string | null;
          total_price: number | null;
          service_count: number | null;
        };
      };
      revenue_summary: {
        Row: {
          date: string;
          total_revenue: number;
          total_jobs: number;
          average_job_value: number;
          total_customers: number;
        };
      };
    };
    Functions: {
      get_sms_conversation: {
        Args: {
          p_customer_id: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          body: string;
          direction: string;
          status: string;
          created_at: string;
          from_name: string;
        }[];
      };
      is_phone_opted_out: {
        Args: {
          p_phone: string;
        };
        Returns: boolean;
      };
      get_customer_stats: {
        Args: {
          p_customer_id: string;
        };
        Returns: {
          total_jobs: number;
          completed_jobs: number;
          total_spent: number;
          average_rating: number;
        };
      };
    };
    Enums: {
      job_status: 'scheduled' | 'confirmed' | 'in_transit' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';
      invoice_status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled';
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
      sms_direction: 'inbound' | 'outbound';
      thread_status: 'open' | 'in_progress' | 'resolved' | 'closed';
      thread_priority: 'low' | 'medium' | 'high' | 'urgent';
      user_role: 'admin' | 'dispatcher' | 'technician' | 'viewer';
      preferred_contact: 'phone' | 'email' | 'sms';
      post_type: 'message' | 'status_change' | 'assignment' | 'photo' | 'expense';
      email_status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
    };
  };
};

// Helper types for easier use
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Specific type exports for common use
export type Customer = Tables<'customers'>;
export type Job = Tables<'jobs'>;
export type Service = Tables<'services'>;
export type Invoice = Tables<'invoices'>;
export type Technician = Tables<'technicians'>;
export type User = Tables<'users'>;
export type Truck = Tables<'trucks'>;
export type Zone = Tables<'zones'>;
export type SmsMessage = Tables<'sms_messages'>;
export type TruckThread = Tables<'truck_threads'>;
export type TruckPost = Tables<'truck_posts'>;
export type Payment = Tables<'payments'>;
export type EmailLog = Tables<'email_logs'>;

// Enum type exports
export type JobStatus = Enums<'job_status'>;
export type InvoiceStatus = Enums<'invoice_status'>;
export type PaymentStatus = Enums<'payment_status'>;
export type SmsDirection = Enums<'sms_direction'>;
export type ThreadStatus = Enums<'thread_status'>;
export type ThreadPriority = Enums<'thread_priority'>;
export type UserRole = Enums<'user_role'>;
export type PreferredContact = Enums<'preferred_contact'>;
export type PostType = Enums<'post_type'>;
export type EmailStatus = Enums<'email_status'>;

// Response types for API calls
export interface CustomerListResponse {
  rows: Customer[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface JobListResponse {
  rows: Job[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface InvoiceListResponse {
  rows: Invoice[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Extended types with relationships
export interface JobWithRelations extends Job {
  customer?: Customer;
  technician?: Technician;
  truck?: Truck;
  services?: Array<{
    service: Service;
    quantity: number;
    price: number;
  }>;
  invoice?: Invoice;
}

export interface CustomerWithStats extends Customer {
  stats?: {
    total_jobs: number;
    completed_jobs: number;
    total_spent: number;
    average_rating: number;
  };
}

export interface InvoiceWithItems extends Invoice {
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  customer?: Customer;
  job?: Job;
}

export interface TruckThreadWithPosts extends TruckThread {
  posts: TruckPost[];
  truck?: Truck;
  created_by_user?: User;
  assigned_to_user?: User;
}
