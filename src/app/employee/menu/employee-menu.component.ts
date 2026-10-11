import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ToppingService } from '../../core/services/topping.service';
import { CartService } from '../../core/services/cart.service';
import { Product, Category, Topping } from '../../core/models/pos.types';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { CustomizationModalComponent } from '../customization/customization-modal.component';

@Component({
  selector: 'app-employee-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe, CustomizationModalComponent],
  template: `
    <div class="space-y-3 pb-28">
      
      <!-- Sub-header: Search Input -->
      <div class="relative w-full">
        <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg">
          search
        </span>
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="¿Qué producto buscas?"
          class="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline text-xs pl-10 pr-10 py-2.5 rounded-xl border border-outline-variant/60 focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none shadow-xs"
        />
        @if (searchQuery) {
          <button
            type="button"
            (click)="searchQuery = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        }
      </div>

      <!-- Horizontal Scrollable Category Tabs -->
      <nav class="sticky top-14 z-20 -mx-4 px-4 py-2 bg-surface-container-lowest/95 backdrop-blur-xs border-b border-surface-container-high">
        <div class="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            (click)="selectedCategory.set('all')"
            class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
            [ngClass]="selectedCategory() === 'all'
              ? 'bg-primary-container text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
          >
            TODOS
          </button>
          @for (cat of menuCategories(); track cat.id) {
            <button
              type="button"
              (click)="selectedCategory.set(cat.id)"
              class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95"
              [ngClass]="selectedCategory() === cat.id
                ? 'bg-primary-container text-white shadow-xs font-bold'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
            >
              <span>{{ cat.image_url || '🍧' }}</span>
              <span>{{ cat.name }}</span>
            </button>
          }
        </div>
      </nav>

      <!-- Section Title & Item count -->
      <div class="flex items-center justify-between px-1 pt-1">
        <h3 class="text-sm font-bold text-primary">
          Catálogo Candy El Progreso
        </h3>
        <span class="text-xs text-outline">{{ filteredProducts().length }} opciones</span>
      </div>

      <!-- Product Grid (2 Columns Touch Friendly) -->
      <div class="grid grid-cols-2 gap-3">
        @for (product of filteredProducts(); track product.id) {
          <article class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-xs border border-surface-container-high flex flex-col justify-between active:scale-[0.98] transition-all hover:shadow-md">
            
            <!-- Image with Badge -->
            <div class="relative w-full aspect-square bg-surface-container overflow-hidden">
              <img
                [src]="product.image_url || 'logo.png'"
                [alt]="product.name"
                class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                loading="lazy"
              />
              <div class="absolute top-2 left-2 bg-secondary-container/90 backdrop-blur-xs text-on-secondary-container text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs uppercase">
                Artesanal
              </div>
            </div>

            <!-- Content & Actions -->
            <div class="p-2.5 flex flex-col flex-1 justify-between">
              <div>
                <h4 class="text-xs font-bold text-primary line-clamp-1">{{ product.name }}</h4>
                <p class="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5 leading-snug">
                  {{ product.description }}
                </p>
              </div>

              <div class="mt-2.5 pt-2 border-t border-surface-container-high/60">
                <span class="text-sm font-bold text-primary block mb-2">
                  {{ product.base_price | currencyCop: true }}
                </span>
                <button
                  type="button"
                  (click)="openCustomization(product)"
                  class="w-full bg-primary-container text-white hover:bg-primary py-2 px-1 rounded-lg text-xs font-bold tracking-wider flex items-center justify-center gap-1 shadow-xs transition-transform active:translate-y-px"
                >
                  <span class="material-symbols-outlined text-sm">add</span>
                  <span>AGREGAR</span>
                </button>
              </div>
            </div>
          </article>
        }
      </div>

      <!-- Empty State -->
      @if (filteredProducts().length === 0 && !productService.isLoading()) {
        <div class="text-center py-12 px-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
          <span class="material-symbols-outlined text-4xl text-outline mb-2">search_off</span>
          <h4 class="text-sm font-bold text-on-surface">No se encontraron productos</h4>
          <p class="text-xs text-outline mt-1">Prueba seleccionando otra categoría o limpiando la búsqueda.</p>
        </div>
      }

      <!-- Customization Modal -->
      <app-customization-modal
        [isOpen]="isModalOpen()"
        [product]="selectedProductForModal()"
        [allToppings]="toppingService.toppings()"
        (confirm)="handleModalConfirm($event)"
        (cancel)="closeModal()"
      ></app-customization-modal>

    </div>
  `,
})
export class EmployeeMenuComponent implements OnInit {
  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  readonly toppingService = inject(ToppingService);
  readonly cartService = inject(CartService);

  readonly selectedCategory = signal<string>('all');
  readonly menuCategories = computed(() =>
    this.categoryService.categories().filter(
      (category) => category.name.trim().toLowerCase() !== 'toppings'
    )
  );
  searchQuery = '';

  readonly isModalOpen = signal(false);
  readonly selectedProductForModal = signal<Product | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.categoryService.loadCategories(),
      this.productService.loadProducts(),
      this.toppingService.loadToppings(),
    ]);
  }

  readonly filteredProducts = computed(() => {
    let list = this.productService.products();
    const hiddenCategoryIds = new Set(
      this.categoryService.categories()
        .filter((category) => category.name.trim().toLowerCase() === 'toppings')
        .map((category) => category.id)
    );
    list = list.filter((product) => !hiddenCategoryIds.has(product.category_id));
    const cat = this.selectedCategory();
    if (cat !== 'all') {
      list = list.filter((p) => p.category_id === cat);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  });

  openCustomization(product: Product): void {
    this.selectedProductForModal.set(product);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.selectedProductForModal.set(null);
  }

  handleModalConfirm(event: {
    product: Product;
    size: string;
    flavor: string;
    notes: string;
    toppings: Topping[];
    quantity: number;
  }): void {
    this.cartService.addItem(event.product, {
      size: event.size,
      flavor: event.flavor,
      notes: event.notes,
      toppings: event.toppings,
      quantity: event.quantity,
    });
    this.closeModal();
  }
}
