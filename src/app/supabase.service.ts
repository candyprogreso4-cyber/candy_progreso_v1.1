import { Injectable, signal } from '@angular/core';
import {
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { environment } from '../environments/environment';
import type { Database, Json } from './database.types';

export interface StaffProfile {
  id: string;
  displayName: string;
  role: 'admin' | 'employee';
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  category: 'Conos' | 'Tarrinas' | 'Malteadas';
  price: number;
  image: string;
  color: string;
}

export interface CatalogTopping {
  id: string;
  name: string;
  price: number;
}

export interface OrderTopping {
  id: string;
  name: string;
  price: number;
}

export interface OrderItemRecord {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  toppings: OrderTopping[];
}

export interface OrderRecord {
  id: string;
  orderNumber: number;
  items: OrderItemRecord[];
  total: number;
  status: 'preparing' | 'waiting-payment' | 'paid';
  createdAt: string;
}

export interface CashClosure {
  businessDate: string;
  total: number;
}

function isJsonObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly isConfigured = Boolean(environment.supabaseUrl && environment.supabaseAnonKey);
  readonly configurationMessage = this.isConfigured
    ? ''
    : 'Configura la URL y la clave pública anon de Supabase en src/environments/environment.ts.';
  readonly authReady = signal(false);
  readonly session = signal<Session | null>(null);
  readonly profile = signal<StaffProfile | null>(null);
  readonly profileError = signal('');
  readonly initializationError = signal('');

  private client: SupabaseClient<Database> | null = null;
  private initialization: Promise<void> = Promise.resolve();

  constructor() {
    if (!this.isConfigured) {
      this.authReady.set(true);
      return;
    }
    this.initialization = this.initializeClient();
  }

  async signIn(email: string, password: string): Promise<void> {
    const client = await this.requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const client = await this.requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    this.profile.set(null);
  }

  async loadCatalog(): Promise<{ products: CatalogProduct[]; toppings: CatalogTopping[] }> {
    const client = await this.requireClient();
    const [productsResult, toppingsResult] = await Promise.all([
      client.from('products').select('*').eq('active', true).order('display_order'),
      client.from('toppings').select('*').eq('active', true).order('display_order'),
    ]);
    if (productsResult.error) throw productsResult.error;
    if (toppingsResult.error) throw toppingsResult.error;

    return {
      products: productsResult.data.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category,
        price: row.price,
        image: row.image_url,
        color: row.color,
      })),
      toppings: toppingsResult.data.map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price,
      })),
    };
  }

  async loadToday(): Promise<{ orders: OrderRecord[]; closure: CashClosure | null }> {
    const client = await this.requireClient();
    const businessDate = this.businessDate();
    const [ordersResult, closureResult] = await Promise.all([
      client
        .from('orders')
        .select('id, order_number, status, total, created_at, order_items(id, product_id, product_name, image_url, unit_price, toppings)')
        .gte('created_at', `${businessDate}T00:00:00-06:00`)
        .lt('created_at', `${this.nextBusinessDate(businessDate)}T00:00:00-06:00`)
        .order('created_at', { ascending: false }),
      client.rpc('cash_status_today'),
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (closureResult.error) throw closureResult.error;
    const cashStatus = closureResult.data[0];

    return {
      orders: ordersResult.data.map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        status: row.status,
        total: row.total,
        createdAt: row.created_at,
        items: row.order_items.map((item) => ({
          id: item.id,
          productId: item.product_id,
          name: item.product_name,
          image: item.image_url,
          price: item.unit_price,
          toppings: this.parseToppings(item.toppings),
        })),
      })),
      closure: cashStatus?.is_closed
        ? { businessDate, total: cashStatus.total ?? 0 }
        : null,
    };
  }

  async placeOrder(items: { productId: string; toppingIds: string[] }[]): Promise<OrderRecord> {
    const client = await this.requireClient();
    const { data, error } = await client.rpc('place_order', {
      p_items: items.map((item) => ({
        product_id: item.productId,
        topping_ids: item.toppingIds,
      })) as Json,
    });
    if (error) throw error;
    if (!this.isOrderReceipt(data)) {
      throw new Error('Supabase devolvió una confirmación de pedido con formato inesperado.');
    }

    return {
      id: data.id,
      orderNumber: data.order_number,
      total: data.total,
      status: 'preparing',
      createdAt: data.created_at,
      items: [],
    };
  }

  async markOrderReady(orderId: string): Promise<void> {
    const client = await this.requireClient();
    const { error } = await client.rpc('mark_order_ready', { p_order_id: orderId });
    if (error) throw error;
  }

  async registerPayment(orderId: string): Promise<void> {
    const client = await this.requireClient();
    const { error } = await client.rpc('register_order_payment', { p_order_id: orderId });
    if (error) throw error;
  }

  async closeCash(): Promise<CashClosure> {
    const client = await this.requireClient();
    const { data, error } = await client.rpc('close_cash_day');
    if (error) throw error;
    const closure = data[0];
    if (!closure) throw new Error('Supabase no devolvió el balance del cierre de caja.');
    return { businessDate: closure.business_date, total: closure.total };
  }

  subscribeToChanges(onChange: () => void, onError: (error: Error) => void): () => void {
    if (!this.client) throw new Error('La conexión con Supabase aún no está lista.');
    const client = this.client;
    const channel = client
      .channel('shop-orders-and-cash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_closures' }, onChange)
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onError(error ?? new Error(`Supabase Realtime reportó: ${status}.`));
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }

  private async initializeClient(): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      this.client = createClient<Database>(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      });
      this.client.auth.onAuthStateChange((event, session) => {
      const previousUserId = this.session()?.user.id;
      this.session.set(session);
      if (!session) {
        this.profile.set(null);
        this.profileError.set('');
        this.authReady.set(true);
      } else if (session.user.id !== previousUserId || !this.profile()) {
        this.profile.set(null);
        this.profileError.set('');
        this.authReady.set(false);
        window.setTimeout(() => void this.loadProfile(session), 0);
      }
      });
    } catch (error) {
      console.error('No se pudo inicializar la conexión con Supabase.', error);
      this.initializationError.set('No se pudo inicializar el cliente de Supabase.');
      this.authReady.set(true);
    }
  }

  private async loadProfile(session: Session): Promise<void> {
    try {
      const client = await this.requireClient();
      const { data, error } = await client
        .from('profiles')
        .select('id, display_name, role')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error('La cuenta no tiene un perfil de personal. Pide al administrador que revise la configuración.');
      }
      if (this.session()?.user.id !== session.user.id) return;
      this.profile.set({ id: data.id, displayName: data.display_name, role: data.role });
      this.profileError.set('');
    } catch (error) {
      console.error('No se pudo cargar el perfil del personal.', error);
      this.profileError.set(
        error instanceof Error ? error.message : 'No se pudo cargar el perfil del personal.',
      );
    } finally {
      if (this.session()?.user.id === session.user.id) this.authReady.set(true);
    }
  }

  private async requireClient(): Promise<SupabaseClient<Database>> {
    await this.initialization;
    if (!this.client) {
      throw new Error(this.initializationError() || this.configurationMessage);
    }
    return this.client;
  }

  private parseToppings(value: Json): OrderTopping[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (
        isJsonObject(item) &&
        typeof item['id'] === 'string' &&
        typeof item['name'] === 'string' &&
        typeof item['price'] === 'number'
      ) {
        return [{ id: item['id'], name: item['name'], price: item['price'] }];
      }
      return [];
    });
  }

  private isOrderReceipt(value: Json): value is {
    id: string;
    order_number: number;
    total: number;
    created_at: string;
  } {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof value['id'] === 'string' &&
      typeof value['order_number'] === 'number' &&
      typeof value['total'] === 'number' &&
      typeof value['created_at'] === 'string'
    );
  }

  private businessDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private nextBusinessDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + 1));
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      String(date.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }
}
