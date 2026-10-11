import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Product, Topping, CartItem, DiningTable } from '../models/pos.types';
import { AuthService } from '../auth/auth.service';

const EMPLOYEE_DRAFT_PREFIX = 'candy_employee_draft_';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly auth = inject(AuthService);
  private hydratedEmployeeId: string | null = null;

  readonly selectedTable = signal<DiningTable | null>(null);
  readonly cartItems = signal<CartItem[]>([]);
  readonly orderNotes = signal<string>('');
  readonly isDrawerOpen = signal<boolean>(false);

  readonly itemCount = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly total = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.subtotal, 0)
  );

  constructor() {
    effect(() => {
      const employeeId = this.auth.employee()?.id ?? null;
      const table = this.selectedTable();
      const items = this.cartItems();
      const notes = this.orderNotes();

      if (employeeId !== this.hydratedEmployeeId) {
        this.hydratedEmployeeId = employeeId;
        if (employeeId) {
          untracked(() => this.restoreDraft(employeeId));
        } else {
          untracked(() => {
            this.selectedTable.set(null);
            this.cartItems.set([]);
            this.orderNotes.set('');
            this.isDrawerOpen.set(false);
          });
        }
        return;
      }

      if (employeeId) {
        this.saveDraft(employeeId, table, items, notes);
      }
    });
  }

  setTable(table: DiningTable | null): void {
    this.selectedTable.set(table);
  }

  openDrawer(): void {
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.isDrawerOpen.update((open) => !open);
  }

  addItem(
    product: Product,
    options: {
      size?: string;
      flavor?: string;
      notes?: string;
      toppings?: Topping[];
      quantity?: number;
    }
  ): void {
    const qty = options.quantity && options.quantity > 0 ? options.quantity : 1;
    const toppings = options.toppings || [];
    const sizePrice = this.sizePrice(product, options.size);
    const freeToppings = product.has_toppings ? product.max_free_toppings : 0;
    const extraToppings = Math.max(0, toppings.length - freeToppings);
    const toppingsPrice = product.has_toppings
      ? extraToppings * product.extra_topping_price
      : 0;
    const unitPrice = Math.max(0, sizePrice + toppingsPrice);
    const lineSubtotal = unitPrice * qty;

    const newItem: CartItem = {
      id: `${product.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product,
      quantity: qty,
      size: options.size || 'Estándar',
      flavor: options.flavor || 'Original',
      notes: options.notes || '',
      toppings,
      subtotal: lineSubtotal,
    };

    this.cartItems.update((items) => [...items, newItem]);
  }

  updateQuantity(itemId: string, delta: number): void {
    this.cartItems.update((items) =>
      items
        .map((item) => {
          if (item.id !== itemId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const sizePrice = this.sizePrice(item.product, item.size);
          const freeToppings = item.product.has_toppings
            ? item.product.max_free_toppings
            : 0;
          const extraToppings = Math.max(0, item.toppings.length - freeToppings);
          const toppingsPrice = item.product.has_toppings
            ? extraToppings * item.product.extra_topping_price
            : 0;
          const unitPrice = Math.max(0, sizePrice + toppingsPrice);
          return {
            ...item,
            quantity: newQty,
            subtotal: unitPrice * newQty,
          };
        })
        .filter((item): item is CartItem => item !== null)
    );
  }

  removeItem(itemId: string): void {
    this.cartItems.update((items) => items.filter((item) => item.id !== itemId));
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.orderNotes.set('');
    this.isDrawerOpen.set(false);
  }

  private sizePrice(product: Product, size?: string): number {
    const configuredSize = product.has_sizes
      ? product.sizes.find((option) => option.name === size)
      : undefined;
    if (configuredSize) return configuredSize.price;

    if (!product.has_sizes && size === '6 oz') return Math.max(0, product.base_price - 2000);
    if (!product.has_sizes && size === '12 oz') return product.base_price + 3000;
    return product.base_price;
  }

  private restoreDraft(employeeId: string): void {
    try {
      const raw = localStorage.getItem(`${EMPLOYEE_DRAFT_PREFIX}${employeeId}`);
      if (!raw) return;

      const draft = JSON.parse(raw) as Record<string, unknown>;
      const table = draft['table'];
      const items = draft['items'];
      this.selectedTable.set(
        this.isDiningTable(table) ? table : null
      );
      this.cartItems.set(
        Array.isArray(items) ? items.filter((item) => this.isCartItem(item)) : []
      );
      this.orderNotes.set(typeof draft['notes'] === 'string' ? draft['notes'] : '');
    } catch (error) {
      console.error('No se pudo restaurar el borrador del pedido:', error);
      this.selectedTable.set(null);
      this.cartItems.set([]);
      this.orderNotes.set('');
    }
  }

  private saveDraft(
    employeeId: string,
    table: DiningTable | null,
    items: CartItem[],
    notes: string
  ): void {
    try {
      localStorage.setItem(
        `${EMPLOYEE_DRAFT_PREFIX}${employeeId}`,
        JSON.stringify({ table, items, notes })
      );
    } catch (error) {
      console.error('No se pudo guardar el borrador del pedido:', error);
    }
  }

  private isDiningTable(value: unknown): value is DiningTable {
    if (typeof value !== 'object' || value === null) return false;
    const table = value as Partial<DiningTable>;
    return typeof table.id === 'string' && typeof table.table_number === 'number';
  }

  private isCartItem(value: unknown): value is CartItem {
    if (typeof value !== 'object' || value === null) return false;
    const item = value as Partial<CartItem>;
    return (
      typeof item.id === 'string' &&
      typeof item.quantity === 'number' &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      typeof item.subtotal === 'number' &&
      Number.isFinite(item.subtotal) &&
      typeof item.product === 'object' &&
      item.product !== null &&
      typeof item.product.id === 'string' &&
      Array.isArray(item.toppings)
    );
  }
}
