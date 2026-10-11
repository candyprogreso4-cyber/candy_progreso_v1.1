import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { ToppingService } from '../../core/services/topping.service';
import { Product, Category, ProductSize, Topping } from '../../core/models/pos.types';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe],
  template: `
    <div class="space-y-6">
      
      <!-- Top Title -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-primary">Catálogo de Productos &amp; Menú</h1>
          <p class="text-xs text-on-surface-variant mt-0.5">
            Administración de precios, sabores artesanales, categorías y adiciones
          </p>
        </div>

        <button
          type="button"
          (click)="openToppingModal()"
          class="px-4 py-2 bg-white hover:bg-surface-container text-primary text-xs font-bold rounded-xl border border-outline-variant/40 shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <span class="material-symbols-outlined text-sm">add</span>
          <span>AGREGAR TOPPING</span>
        </button>
        <button
          type="button"
          (click)="openCreateModal()"
          class="px-4 py-2 bg-primary-container hover:bg-primary text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <span class="material-symbols-outlined text-sm">add_circle</span>
          <span>NUEVO PRODUCTO</span>
        </button>
      </div>

      <!-- Filters & Category tabs -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-outline-variant/30 shadow-xs">
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            (click)="selectedCategoryFilter.set('all')"
            class="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all"
            [ngClass]="selectedCategoryFilter() === 'all'
              ? 'bg-primary-container text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
          >
            Todos ({{ productService.products().length }})
          </button>
          @for (cat of categoryService.categories(); track cat.id) {
            <button
              type="button"
              (click)="selectedCategoryFilter.set(cat.id)"
              class="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all"
              [ngClass]="selectedCategoryFilter() === cat.id
                ? 'bg-primary-container text-white font-bold shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
            >
              {{ cat.name }}
            </button>
          }
        </div>

        <div class="relative min-w-[220px]">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Buscar por nombre..."
            class="w-full pl-8 pr-3 py-1.5 rounded-xl border border-outline-variant text-xs outline-none focus:border-primary-container"
          />
        </div>
      </div>

      <!-- Products Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        @for (product of filteredProducts(); track product.id) {
          <div class="bg-white rounded-2xl border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
            <div class="relative w-full aspect-video bg-surface-container overflow-hidden">
              <img
                [src]="product.image_url || 'logo.png'"
                [alt]="product.name"
                class="w-full h-full object-cover"
              />
              <span class="absolute top-2 left-2 px-2 py-0.5 rounded bg-primary-container/80 text-white text-[9px] font-bold uppercase backdrop-blur-xs">
                {{ product.category?.name || 'General' }}
              </span>
            </div>

            <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2">
              <div>
                <h4 class="text-xs font-bold text-primary">{{ product.name }}</h4>
                <p class="text-[11px] text-on-surface-variant line-clamp-2 mt-0.5">{{ product.description }}</p>
              </div>

              <div class="pt-2 border-t border-surface-container-high flex items-center justify-between">
                <div>
                  <span class="text-[10px] text-outline block">Precio Base</span>
                  <span class="text-sm font-bold text-primary">{{ product.base_price | currencyCop: true }}</span>
                </div>

                <div class="flex gap-1">
                  <button
                    type="button"
                    (click)="openEditModal(product)"
                    class="p-1.5 rounded-lg text-primary hover:bg-surface-container transition-colors"
                    title="Editar producto"
                  >
                    <span class="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    type="button"
                    (click)="handleDelete(product)"
                    class="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Eliminar producto"
                  >
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Create / Edit Product Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-outline-variant/40 space-y-4 max-h-[90vh] overflow-y-auto custom-scroll">
            <h3 class="text-base font-bold text-primary">
              {{ editingProductId() ? 'Editar Producto' : 'Crear Nuevo Producto' }}
            </h3>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block font-bold text-on-surface mb-1">Nombre del Producto:</label>
                <input
                  type="text"
                  [(ngModel)]="formName"
                  placeholder="Ej. Yogur Helado 8 oz"
                  class="w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-on-surface mb-1">Categoría:</label>
                  <select
                    [(ngModel)]="formCategoryId"
                    class="w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container bg-white"
                  >
                    @for (cat of categoryService.categories(); track cat.id) {
                      <option [value]="cat.id">{{ cat.name }}</option>
                    }
                  </select>
                </div>

                @if (!formHasSizes) {
                <div>
                  <label class="block font-bold text-on-surface mb-1">Precio Base (COP):</label>
                  <input
                    type="number"
                    [(ngModel)]="formPrice"
                    placeholder="10000"
                    class="w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container font-bold text-primary"
                  />
                </div>
                } @else {
                  <div class="self-center">
                    <span class="block font-bold text-on-surface mb-1">Precio desde:</span>
                    <span class="font-bold text-primary">{{ lowestSizePrice() | currencyCop: true }}</span>
                  </div>
                }
              </div>

              <div>
                <label class="block font-bold text-on-surface mb-1">Descripción:</label>
                <textarea
                  [(ngModel)]="formDescription"
                  rows="2"
                  placeholder="Descripción de la receta o ingredientes..."
                  class="w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container resize-none"
                ></textarea>
              </div>

              <div>
                <label class="block font-bold text-on-surface mb-1">Sabores disponibles:</label>
                <input
                  type="text"
                  [(ngModel)]="formFlavors"
                  placeholder="Fresa, Vainilla, Chocolate"
                  class="w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container"
                />
                <p class="mt-1 text-[10px] text-outline">Separa cada sabor con una coma. Déjalo vacío si el producto no tiene sabores.</p>
              </div>

              <label class="flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 font-bold">
                <input
                  type="checkbox"
                  [(ngModel)]="formHasSizes"
                  name="hasSizes"
                  (ngModelChange)="onHasSizesChange($event)"
                  class="rounded text-primary-container"
                />
                Este producto tiene varios tamaños de porción
              </label>

              @if (formHasSizes) {
                <div class="space-y-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <p class="font-bold text-on-surface">Tamaños y precios</p>
                      <p class="text-[10px] text-outline">Ingresa el precio final de cada porción.</p>
                    </div>
                    <button
                      type="button"
                      (click)="addSize()"
                      class="shrink-0 px-2.5 py-1.5 rounded-lg bg-white text-primary text-[10px] font-bold border border-outline-variant/50"
                    >
                      Agregar tamaño
                    </button>
                  </div>
                  @for (size of formSizes; track $index; let index = $index) {
                    <div class="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                      <label class="block font-semibold text-on-surface">
                        Nombre
                        <input
                          type="text"
                          [(ngModel)]="size.name"
                          [name]="'sizeName' + index"
                          placeholder="Ej. 12 oz"
                          class="mt-1 w-full p-2 rounded-lg border border-outline-variant outline-none focus:border-primary-container"
                        />
                      </label>
                      <label class="block font-semibold text-on-surface">
                        Precio (COP)
                        <input
                          type="number"
                          [(ngModel)]="size.price"
                          [name]="'sizePrice' + index"
                          min="0"
                          step="100"
                          class="mt-1 w-full p-2 rounded-lg border border-outline-variant outline-none focus:border-primary-container"
                        />
                      </label>
                      <button
                        type="button"
                        (click)="removeSize(index)"
                        [disabled]="formSizes.length <= 2"
                        class="mb-0.5 p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        [attr.aria-label]="'Eliminar tamaño ' + (index + 1)"
                      >
                        <span class="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  }
                </div>
              }

              <div>
                <label class="block font-bold text-on-surface mb-1">URL de Imagen del Producto:</label>
                <input
                  type="text"
                  [(ngModel)]="formImageUrl"
                  placeholder="https://images.unsplash.com/..."
                  class="w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container"
                />
              </div>

              <label class="flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 font-bold">
                <input
                  type="checkbox"
                  [(ngModel)]="formHasToppings"
                  name="hasToppings"
                  (ngModelChange)="onHasToppingsChange($event)"
                  class="rounded text-primary-container"
                />
                Este producto permite toppings
              </label>

              @if (formHasToppings) {
              <div class="grid grid-cols-2 gap-3">
                <label class="block font-bold text-on-surface">
                  Toppings incluidos
                  <input
                    type="number"
                    [(ngModel)]="formMaxFreeToppings"
                    name="maxFreeToppings"
                    min="0"
                    step="1"
                    required
                    class="mt-1 w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container"
                  />
                </label>
                <label class="block font-bold text-on-surface">
                  Recargo por topping adicional (COP)
                  <input
                    type="number"
                    [(ngModel)]="formExtraToppingPrice"
                    name="extraToppingPrice"
                    min="0"
                    step="100"
                    required
                    class="mt-1 w-full p-2.5 rounded-xl border border-outline-variant outline-none focus:border-primary-container"
                  />
                </label>
              </div>

              <div>
                <label class="block font-bold text-on-surface mb-1.5">Toppings disponibles para este producto:</label>
                @if (toppingService.toppings().length === 0) {
                  <div class="rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 text-center">
                    <p class="text-[11px] text-outline">Todavía no hay toppings para asignar.</p>
                    <button
                      type="button"
                      (click)="openToppingModal()"
                      class="mt-2 px-3 py-1.5 rounded-lg bg-white text-primary text-[11px] font-bold border border-outline-variant/50"
                    >
                      Agregar primer topping
                    </button>
                  </div>
                } @else {
                  <div class="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1 border border-outline-variant/40 p-2 rounded-xl bg-surface-container-low">
                    @for (top of toppingService.toppings(); track top.id) {
                      <label class="flex items-center gap-2 p-1 rounded hover:bg-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          [checked]="isToppingChecked(top.id)"
                          (change)="toggleToppingSelection(top.id)"
                          class="rounded text-primary-container"
                        />
                        <span class="truncate">{{ top.name }}</span>
                      </label>
                    }
                  </div>
                }
                <p class="mt-1 text-[10px] text-outline">Los toppings no tienen precio individual. El recargo se aplica por cada topping que exceda el límite incluido.</p>
              </div>
              }
            </div>

            <div class="flex justify-end gap-2.5 pt-3 border-t border-surface-container-high">
              <button
                type="button"
                (click)="showModal.set(false)"
                class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-outline hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="submitProduct()"
                class="px-5 py-2 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold shadow-xs"
              >
                {{ editingProductId() ? 'Guardar Cambios' : 'Crear Producto' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (showToppingModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <form
            (ngSubmit)="submitTopping()"
            class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/40 space-y-4"
          >
            <div>
              <h3 class="text-base font-bold text-primary">Agregar topping</h3>
              <p class="mt-1 text-xs text-outline">Quedará disponible para asignarlo a los productos.</p>
            </div>
            <label class="block text-xs font-bold text-on-surface">
              Nombre
              <input
                type="text"
                [(ngModel)]="toppingName"
                name="toppingName"
                required
                minlength="2"
                class="mt-1 w-full p-2.5 rounded-xl border border-outline-variant text-sm outline-none focus:border-primary-container"
              />
            </label>
            <label class="block text-xs font-bold text-on-surface">
              Los toppings no tienen precio individual; el recargo se configura en cada producto.
            </label>
            <label class="block text-xs font-bold text-on-surface">
              Descripción (opcional)
              <input
                type="text"
                [(ngModel)]="toppingDescription"
                name="toppingDescription"
                class="mt-1 w-full p-2.5 rounded-xl border border-outline-variant text-sm outline-none focus:border-primary-container"
              />
            </label>
            <div class="max-h-36 overflow-y-auto rounded-xl border border-outline-variant/40 divide-y divide-outline-variant/20">
              @for (topping of toppingService.toppings(); track topping.id) {
                <div class="flex items-center justify-between px-3 py-2 text-xs">
                  <span class="font-semibold">{{ topping.name }}</span>
                </div>
              }
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" (click)="showToppingModal.set(false)" class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-outline">
                Cerrar
              </button>
              <button type="submit" [disabled]="toppingService.isLoading()" class="px-4 py-2 rounded-xl bg-primary-container hover:bg-primary text-white text-xs font-bold disabled:opacity-50">
                {{ toppingService.isLoading() ? 'Guardando...' : 'Guardar topping' }}
              </button>
            </div>
          </form>
        </div>
      }

    </div>
  `,
})
export class AdminProductsComponent implements OnInit {
  readonly productService = inject(ProductService);
  readonly categoryService = inject(CategoryService);
  readonly toppingService = inject(ToppingService);
  private readonly toast = inject(ToastService);

  readonly selectedCategoryFilter = signal<string>('all');
  searchQuery = '';

  readonly showModal = signal(false);
  readonly editingProductId = signal<string | null>(null);
  readonly showToppingModal = signal(false);

  formName = '';
  formCategoryId = '';
  formPrice = 10000;
  formDescription = '';
  formImageUrl = '';
  formFlavors = '';
  formHasSizes = false;
  formSizes: ProductSize[] = [];
  formHasToppings = false;
  formMaxFreeToppings = 0;
  formExtraToppingPrice = 0;
  selectedToppingIds: string[] = [];
  toppingName = '';
  toppingDescription = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.categoryService.loadCategories(),
      this.productService.loadProducts(),
      this.toppingService.loadToppings(),
    ]);
  }

  readonly filteredProducts = computed(() => {
    let list = this.productService.products();
    const cat = this.selectedCategoryFilter();
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

  openCreateModal(): void {
    this.editingProductId.set(null);
    this.formName = '';
    this.formCategoryId = this.categoryService.categories()[0]?.id || '';
    this.formPrice = 10000;
    this.formDescription = '';
    this.formImageUrl = '';
    this.formFlavors = '';
    this.formHasSizes = false;
    this.formSizes = [];
    this.formHasToppings = false;
    this.formMaxFreeToppings = 0;
    this.formExtraToppingPrice = 0;
    this.selectedToppingIds = [];
    this.showModal.set(true);
  }

  openEditModal(p: Product): void {
    this.editingProductId.set(p.id);
    this.formName = p.name;
    this.formCategoryId = p.category_id;
    this.formPrice = p.base_price;
    this.formDescription = p.description || '';
    this.formImageUrl = p.image_url || '';
    this.formFlavors = (p.flavors || []).join(', ');
    this.formHasSizes = p.has_sizes;
    this.formSizes = p.has_sizes ? p.sizes.map((size) => ({ ...size })) : [];
    this.formHasToppings = p.has_toppings;
    this.formMaxFreeToppings = p.max_free_toppings;
    this.formExtraToppingPrice = p.extra_topping_price;
    this.selectedToppingIds = p.has_toppings ? (p.toppings || []).map((t) => t.id) : [];
    this.showModal.set(true);
  }

  isToppingChecked(id: string): boolean {
    return this.selectedToppingIds.includes(id);
  }

  toggleToppingSelection(id: string): void {
    if (this.selectedToppingIds.includes(id)) {
      this.selectedToppingIds = this.selectedToppingIds.filter((t) => t !== id);
    } else {
      this.selectedToppingIds.push(id);
    }
  }

  onHasToppingsChange(enabled: boolean): void {
    if (!enabled) {
      this.selectedToppingIds = [];
    }
  }

  onHasSizesChange(enabled: boolean): void {
    if (enabled && this.formSizes.length === 0) {
      this.formSizes = [
        { name: 'Pequeño', price: this.formPrice },
        { name: 'Grande', price: this.formPrice },
      ];
    } else if (!enabled) {
      this.formSizes = [];
    }
  }

  addSize(): void {
    this.formSizes = [...this.formSizes, { name: '', price: this.formPrice }];
  }

  removeSize(index: number): void {
    if (this.formSizes.length > 2) {
      this.formSizes = this.formSizes.filter((_, sizeIndex) => sizeIndex !== index);
    }
  }

  lowestSizePrice(): number {
    return this.formSizes.length
      ? Math.min(...this.formSizes.map((size) => Number(size.price)))
      : this.formPrice;
  }

  async submitProduct(): Promise<void> {
    if (!this.formName.trim() || !this.formCategoryId) return;
    if (this.formHasSizes) {
      const names = this.formSizes.map((size) => size.name.trim().toLowerCase());
      if (
        this.formSizes.length < 2 ||
        this.formSizes.some((size) =>
          !size.name.trim() || !Number.isFinite(size.price) || size.price < 0
        ) ||
        new Set(names).size !== names.length
      ) {
        this.toast.warning('Configura al menos dos tamaños con nombres únicos y precios válidos.');
        return;
      }
    }
    if (
      this.formHasToppings &&
      (!Number.isInteger(this.formMaxFreeToppings) ||
        this.formMaxFreeToppings < 0 ||
        !Number.isFinite(this.formExtraToppingPrice) ||
        this.formExtraToppingPrice < 0)
    ) {
      this.toast.warning('Ingresa un límite incluido y un precio adicional válidos.');
      return;
    }
    if (this.formHasToppings && this.selectedToppingIds.length === 0) {
      this.toast.warning('Selecciona al menos un topping disponible para este producto.');
      return;
    }

    const flavors = [...new Set(this.formFlavors.split(',').map((flavor) => flavor.trim()).filter(Boolean))];
    const hasToppings = this.formHasToppings && this.selectedToppingIds.length > 0;
    const sizes = this.formHasSizes
      ? this.formSizes.map((size) => ({ name: size.name.trim(), price: Number(size.price) }))
      : [];
    const basePrice = this.formHasSizes ? this.lowestSizePrice() : this.formPrice;
    let saved: boolean;
    if (this.editingProductId()) {
      saved = await this.productService.updateProduct(
        this.editingProductId()!,
        {
          name: this.formName.trim(),
          category_id: this.formCategoryId,
          base_price: basePrice,
          description: this.formDescription.trim(),
          image_url: this.formImageUrl.trim(),
          flavors,
          has_sizes: this.formHasSizes,
          sizes,
          has_toppings: hasToppings,
          max_free_toppings: hasToppings ? this.formMaxFreeToppings : 0,
          extra_topping_price: hasToppings ? this.formExtraToppingPrice : 0,
        },
        hasToppings ? this.selectedToppingIds : []
      );
    } else {
      saved = !!await this.productService.createProduct(
        {
          name: this.formName.trim(),
          category_id: this.formCategoryId,
          base_price: basePrice,
          description: this.formDescription.trim(),
          image_url: this.formImageUrl.trim(),
          flavors,
          has_sizes: this.formHasSizes,
          sizes,
          has_toppings: hasToppings,
          max_free_toppings: hasToppings ? this.formMaxFreeToppings : 0,
          extra_topping_price: hasToppings ? this.formExtraToppingPrice : 0,
        },
        hasToppings ? this.selectedToppingIds : []
      );
    }

    if (saved) this.showModal.set(false);
  }

  openToppingModal(): void {
    this.toppingName = '';
    this.toppingDescription = '';
    this.showToppingModal.set(true);
  }

  async submitTopping(): Promise<void> {
    if (!this.toppingName.trim()) return;
    const topping = await this.toppingService.createTopping({
      name: this.toppingName.trim(),
      description: this.toppingDescription.trim(),
      price: 0,
    });
    if (topping) {
      this.toppingName = '';
      this.toppingDescription = '';
    }
  }

  async handleDelete(p: Product): Promise<void> {
    if (confirm(`¿Desactivar el producto "${p.name}" del catálogo?`)) {
      await this.productService.deleteProduct(p.id);
    }
  }
}
