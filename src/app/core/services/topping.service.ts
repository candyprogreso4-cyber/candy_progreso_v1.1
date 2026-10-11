import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { Topping } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class ToppingService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly toppings = signal<Topping[]>([]);
  readonly isLoading = signal(false);

  async loadToppings(): Promise<Topping[]> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('toppings')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;

      const list: Topping[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        image_url: t.image_url,
        price: Number(t.price),
        is_active: t.is_active,
        created_at: t.created_at,
      }));

      this.toppings.set(list);
      return list;
    } catch (err: unknown) {
      console.warn('Error al cargar toppings:', err);
      return this.toppings();
    } finally {
      this.isLoading.set(false);
    }
  }

  async createTopping(t: Partial<Topping>): Promise<Topping | null> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('toppings')
        .insert([{
          name: t.name,
          description: t.description || null,
          image_url: t.image_url || null,
          price: 0,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      this.toast.success(`Topping "${t.name}" agregado.`);
      await this.loadToppings();
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creando topping';
      this.toast.error(msg);
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateTopping(id: string, updates: Partial<Topping>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('toppings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      this.toast.success('Topping actualizado.');
      await this.loadToppings();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error actualizando topping';
      this.toast.error(msg);
      return false;
    }
  }

  async deleteTopping(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('toppings')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      this.toast.info('Topping desactivado.');
      await this.loadToppings();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al desactivar topping';
      this.toast.error(msg);
      return false;
    }
  }
}
