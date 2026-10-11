import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { Category } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly categories = signal<Category[]>([]);
  readonly isLoading = signal(false);

  async loadCategories(): Promise<Category[]> {
    this.isLoading.set(true);
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const list: Category[] = (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        image_url: c.image_url,
        is_active: c.is_active,
        sort_order: c.sort_order,
        created_at: c.created_at,
      }));

      this.categories.set(list);
      return list;
    } catch (err: unknown) {
      console.warn('Error al cargar categorías de Supabase:', err);
      return this.categories();
    } finally {
      this.isLoading.set(false);
    }
  }

  async createCategory(cat: Partial<Category>): Promise<Category | null> {
    try {
      const { data, error } = await this.supabase
        .from('categories')
        .insert([{
          name: cat.name,
          description: cat.description || null,
          image_url: cat.image_url || null,
          sort_order: cat.sort_order || 0,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      this.toast.success(`Categoría "${cat.name}" creada.`);
      await this.loadCategories();
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creando categoría';
      this.toast.error(msg);
      return null;
    }
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('categories')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      this.toast.success('Categoría actualizada.');
      await this.loadCategories();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error actualizando categoría';
      this.toast.error(msg);
      return false;
    }
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      // Soft-delete desactivando
      const { error } = await this.supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      this.toast.info('Categoría desactivada.');
      await this.loadCategories();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error eliminando categoría';
      this.toast.error(msg);
      return false;
    }
  }
}
