export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; role: 'admin' | 'employee' };
        Insert: { id: string; display_name?: string; role?: 'admin' | 'employee' };
        Update: { display_name?: string };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: 'Conos' | 'Tarrinas' | 'Malteadas';
          price: number;
          image_url: string;
          color: string;
          active: boolean;
          display_order: number;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
        Relationships: [];
      };
      toppings: {
        Row: {
          id: string;
          name: string;
          price: number;
          active: boolean;
          display_order: number;
        };
        Insert: Omit<Database['public']['Tables']['toppings']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Database['public']['Tables']['toppings']['Insert']>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: number;
          status: 'preparing' | 'waiting-payment' | 'paid';
          total: number;
          created_at: string;
          created_by: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'orders_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          image_url: string;
          unit_price: number;
          toppings: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_closures: {
        Row: {
          business_date: string;
          total: number;
          closed_at: string;
          closed_by: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      place_order: {
        Args: { p_items: Json };
        Returns: Json;
      };
      mark_order_ready: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      register_order_payment: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      close_cash_day: {
        Args: Record<string, never>;
        Returns: { business_date: string; total: number; closed_at: string }[];
      };
      cash_status_today: {
        Args: Record<string, never>;
        Returns: { is_closed: boolean; total: number | null }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
