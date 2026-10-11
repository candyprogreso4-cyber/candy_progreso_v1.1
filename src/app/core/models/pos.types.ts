export type UserRole = 'admin' | 'employee';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'cancelled';
export type PaymentMethod = 'cash' | 'nequi' | 'daviplata' | 'transfer' | 'other';
export type TableStatus = 'available' | 'occupied';
export type CashRegisterStatus = 'open' | 'closed';
export type CashMovementType = 'income' | 'expense' | 'adjustment';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  profile_id?: string | null;
  identification: string;
  full_name: string;
  is_active: boolean;
  allow_persistent_session?: boolean;
  created_at: string;
}

export interface DiningTable {
  id: string;
  table_number: number;
  status: TableStatus;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProductSize {
  name: string;
  price: number;
}

export interface Product {
  id: string;
  category_id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  base_price: number;
  is_active: boolean;
  flavors: string[];
  has_sizes: boolean;
  sizes: ProductSize[];
  has_toppings: boolean;
  max_free_toppings: number;
  extra_topping_price: number;
  created_at: string;
  updated_at: string;
  category?: Category;
  toppings?: Topping[];
}

export interface Topping {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductTopping {
  product_id: string;
  topping_id: string;
}

export interface OrderItemTopping {
  id: string;
  order_item_id: string;
  topping_id?: string | null;
  topping_name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  size?: string | null;
  flavor?: string | null;
  notes?: string | null;
  created_at: string;
  toppings?: OrderItemTopping[];
}

export interface Order {
  id: string;
  order_number: number;
  table_id?: string | null;
  employee_id?: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  table?: DiningTable;
  employee?: Employee;
  items?: OrderItem[];
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  received_amount?: number;
  change_amount?: number;
  registered_by?: string | null;
  created_at: string;
}

export interface CashRegister {
  id: string;
  opened_by?: string | null;
  opened_at: string;
  opening_amount: number;
  closed_by?: string | null;
  closed_at?: string | null;
  closing_amount?: number | null;
  expected_amount?: number | null;
  difference?: number | null;
  status: CashRegisterStatus;
}

export interface CashMovement {
  id: string;
  cash_register_id?: string | null;
  amount: number;
  type: CashMovementType;
  description: string;
  created_by?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CartCustomization {
  size: string;
  flavor: string;
  notes: string;
  toppings: Topping[];
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  size: string;
  flavor: string;
  notes: string;
  toppings: Topping[];
  subtotal: number;
}
