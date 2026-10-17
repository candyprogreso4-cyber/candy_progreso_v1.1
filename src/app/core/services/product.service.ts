import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { Product, Topping } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly products = signal<Product[]>([]);
  readonly isLoading = signal(false);

  async loadProducts(categoryId?: string): Promise<Product[]> {
    this.isLoading.set(true);
    try {
      let query = this.supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          product_toppings(
            topping:toppings(*)
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (categoryId && categoryId !== 'all') {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const list: Product[] = (data || []).map((row: any) => {
        // Extraer toppings relacionados a través de product_toppings
        const assignedToppings: Topping[] = (row.product_toppings || [])
          .map((pt: any) => pt.topping)
          .filter((t: any) => t && t.is_active)
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            image_url: t.image_url,
            price: Number(t.price),
            is_active: t.is_active,
            created_at: t.created_at,
          }));

        return {
          id: row.id,
          category_id: row.category_id,
          name: row.name,
          description: row.description,
          image_url: row.image_url,
          base_price: Number(row.base_price),
          is_active: row.is_active,
          flavors: row.flavors || [],
          has_sizes: row.has_sizes ?? false,
          sizes: Array.isArray(row.sizes)
            ? row.sizes.map((size: any) => ({
                name: String(size.name),
                price: Number(size.price),
              }))
            : [],
          has_toppings: row.has_toppings ?? false,
          max_free_toppings: row.max_free_toppings ?? 0,
          extra_topping_price: Number(row.extra_topping_price ?? 0),
          created_at: row.created_at,
          updated_at: row.updated_at,
          category: row.category,
          toppings: assignedToppings,
        };
      });

      this.products.set(list);
      return list;
    } catch (err: unknown) {
      console.warn('Error al cargar productos de Supabase:', err);
      return this.products();
    } finally {
      this.isLoading.set(false);
    }
  }

  async createProduct(product: Partial<Product>, toppingIds: string[] = []): Promise<Product | null> {
    try {
      const { data, error } = await this.supabase
        .from('products')
        .insert([{
          category_id: product.category_id,
          name: product.name,
          description: product.description || null,
          image_url: product.image_url || null,
          base_price: product.base_price,
          flavors: product.flavors || [],
          has_sizes: product.has_sizes ?? false,
          sizes: product.has_sizes ? product.sizes || [] : [],
          has_toppings: product.has_toppings ?? false,
          max_free_toppings: product.max_free_toppings ?? 0,
          extra_topping_price: product.extra_topping_price ?? 0,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;

      // Vincular toppings en product_toppings
      if (data && toppingIds.length > 0) {
        const relations = toppingIds.map((tid) => ({
          product_id: data.id,
          topping_id: tid,
        }));
        const { error: toppingsError } = await this.supabase
          .from('product_toppings')
          .insert(relations);
        if (toppingsError) {
          const { error: cleanupError } = await this.supabase
            .from('products')
            .delete()
            .eq('id', data.id);
          if (cleanupError) {
            console.error('No se pudo revertir el producto después del fallo al asignar toppings:', cleanupError);
          }
          throw toppingsError;
        }
      }

      this.toast.success(`Producto "${product.name}" creado con éxito.`);
      await this.loadProducts();
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creando producto.';
      this.toast.error(msg);
      return null;
    }
  }

  async updateProduct(id: string, updates: Partial<Product>, toppingIds?: string[]): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('products')
        .update({
          category_id: updates.category_id,
          name: updates.name,
          description: updates.description,
          image_url: updates.image_url,
          base_price: updates.base_price,
          flavors: updates.flavors || [],
          has_sizes: updates.has_sizes ?? false,
          sizes: updates.has_sizes ? updates.sizes || [] : [],
          has_toppings: updates.has_toppings ?? false,
          max_free_toppings: updates.max_free_toppings ?? 0,
          extra_topping_price: updates.extra_topping_price ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      if (toppingIds !== undefined) {
        // Reemplazar asociaciones de toppings
        const { error: deleteError } = await this.supabase
          .from('product_toppings')
          .delete()
          .eq('product_id', id);
        if (deleteError) throw deleteError;
        if (toppingIds.length > 0) {
          const relations = toppingIds.map((tid) => ({
            product_id: id,
            topping_id: tid,
          }));
          const { error: insertError } = await this.supabase
            .from('product_toppings')
            .insert(relations);
          if (insertError) throw insertError;
        }
      }

      this.toast.success('Producto actualizado.');
      await this.loadProducts();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar producto.';
      this.toast.error(msg);
      return false;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      this.toast.info('Producto desactivado del menú.');
      await this.loadProducts();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar producto.';
      this.toast.error(msg);
      return false;
    }
  }

  async uploadProductImage(file: File): Promise<string> {
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensionByType[file.type];
    if (!extension) {
      throw new Error('El archivo debe ser una imagen JPG, PNG o WebP.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('La imagen no puede superar los 5 MB.');
    }

    const path = `products/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.supabase.storage
      .from('product-images')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
    if (error) throw error;

    const { data: { publicUrl } } = this.supabase.storage
      .from('product-images')
      .getPublicUrl(path);
    return publicUrl;
  }
}
