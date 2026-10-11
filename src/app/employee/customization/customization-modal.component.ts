import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product, ProductSize, Topping } from '../../core/models/pos.types';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';

@Component({
  selector: 'app-customization-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe],
  template: `
    @if (isOpen && product) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
        <div class="w-full max-w-[420px] max-h-[90vh] bg-surface-container-lowest rounded-t-[28px] sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl border border-outline-variant/30">
          
          <!-- Modal Header -->
          <div class="sticky top-0 z-10 px-4 py-3 bg-primary-container text-surface-container-lowest flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary-fixed">icecream</span>
              <h3 class="text-base font-bold text-white truncate">Personalizar Producto</h3>
            </div>
            <button
              type="button"
              (click)="cancel.emit()"
              class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <span class="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <!-- Scrollable Customization Content -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
            
            <!-- Product Summary Card -->
            <div class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <div class="w-16 h-16 rounded-lg overflow-hidden bg-surface-container shrink-0 border border-outline-variant/20">
                <img
                  [src]="product.image_url || 'logo.png'"
                  [alt]="product.name"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="flex-1 min-w-0">
                <span class="text-[10px] font-bold text-secondary uppercase bg-secondary-fixed px-1.5 py-0.5 rounded">
                  {{ product.category?.name || 'Heladería' }}
                </span>
                <h4 class="text-sm font-bold text-primary truncate mt-0.5">{{ product.name }}</h4>
                <p class="text-xs text-on-surface-variant line-clamp-1">{{ product.description }}</p>
                <span class="text-xs font-bold text-primary mt-1 block">
                  Base: {{ product.base_price | currencyCop }}
                </span>
              </div>
            </div>

            <!-- Size Selector -->
            <div>
              <div class="flex justify-between items-center mb-1.5">
                <label class="text-xs font-bold text-on-surface uppercase tracking-wider">Tamaño de Porción</label>
                <span class="text-[11px] text-outline">Obligatorio</span>
              </div>
              <select
                [value]="selectedSize()"
                (change)="onSizeChange($event)"
                class="w-full p-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-primary outline-none focus:border-primary-container"
              >
                @for (size of availableSizes(); track size.name) {
                  <option [value]="size.name">{{ size.name }} · {{ size.price | currencyCop }}</option>
                }
              </select>
            </div>

            <!-- Flavor Selector -->
            @if (availableFlavors().length > 0) {
            <div>
              <div class="flex justify-between items-center mb-1.5">
                <label class="text-xs font-bold text-on-surface uppercase tracking-wider">Sabor de Base</label>
                <span class="text-[11px] text-primary font-bold">1 Selección</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                @for (flavor of availableFlavors(); track flavor) {
                  <button
                    type="button"
                    (click)="selectedFlavor.set(flavor)"
                    class="p-2.5 rounded-xl border flex items-center justify-between text-left transition-all active:scale-98"
                    [ngClass]="selectedFlavor() === flavor
                      ? 'border-2 border-primary-container bg-[#FFF0F5] text-primary font-bold shadow-xs'
                      : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'"
                  >
                    <span class="text-xs">{{ flavorIcon(flavor) }} {{ flavor }}</span>
                    <span class="w-4 h-4 rounded-full flex items-center justify-center"
                          [ngClass]="selectedFlavor() === flavor ? 'bg-primary-container text-white' : 'border border-outline'">
                      @if (selectedFlavor() === flavor) {
                        <span class="material-symbols-outlined text-[10px]">check</span>
                      }
                    </span>
                  </button>
                }
              </div>
            </div>
            }

            <!-- Product-specific toppings and over-limit surcharge -->
            @if (product.has_toppings) {
            <div>
              <div class="flex justify-between items-center mb-1.5">
                <label class="text-xs font-bold text-on-surface uppercase tracking-wider">Agrega toppings</label>
                <span class="text-[11px] text-secondary font-bold text-right">
                  {{ product.max_free_toppings }} incluidos · {{ selectedToppings().length }} elegidos
                </span>
              </div>
              <p class="mb-2 text-[10px] text-outline">Toca un topping para agregarlo o quitarlo del producto.</p>
              <p class="mb-2 text-[10px] text-outline">
                @if (product.extra_topping_price > 0) {
                  Cada topping que supere el límite cuesta {{ product.extra_topping_price | currencyCop }}.
                } @else {
                  No hay recargo por exceder el límite.
                }
              </p>
              <button
                type="button"
                (click)="isToppingsOpen.update((open) => !open)"
                [attr.aria-expanded]="isToppingsOpen()"
                class="w-full p-3 rounded-xl border border-outline-variant bg-surface-container-lowest flex items-center justify-between text-left"
              >
                <span class="min-w-0">
                  <span class="block text-xs font-bold text-primary">
                    {{ selectedToppings().length ? selectedToppings().length + ' toppings seleccionados' : 'Elegir toppings' }}
                  </span>
                  @if (selectedToppings().length > 0) {
                    <span class="block text-[10px] text-on-surface-variant truncate mt-0.5">{{ selectedToppingNames() }}</span>
                  }
                </span>
                <span class="material-symbols-outlined text-primary transition-transform" [class.rotate-180]="isToppingsOpen()">
                  expand_more
                </span>
              </button>

              @if (isToppingsOpen()) {
                <div class="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scroll">
                  @if (availableToppings().length === 0) {
                    <p class="rounded-lg bg-surface-container-low p-3 text-center text-[11px] text-outline">
                      No hay toppings configurados para este producto.
                    </p>
                  }
                  @for (topping of availableToppings(); track topping.id) {
                    <button
                      type="button"
                      (click)="toggleTopping(topping)"
                      [attr.aria-pressed]="isToppingSelected(topping)"
                      [attr.aria-label]="toppingActionLabel(topping)"
                      class="w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all active:scale-[0.99]"
                      [ngClass]="isToppingSelected(topping)
                        ? 'border-2 border-secondary-container bg-surface-container-low'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'"
                    >
                      <span class="flex min-w-0 items-center gap-2.5">
                        <span class="text-base">{{ topping.image_url || '✨' }}</span>
                        <span class="min-w-0">
                          <span class="block text-xs font-bold text-on-surface">{{ topping.name }}</span>
                          <span class="block text-[10px] text-secondary line-clamp-1">{{ topping.description || 'Topping artesanal' }}</span>
                        </span>
                      </span>
                      <span class="flex shrink-0 items-center gap-2">
                        <span class="text-[10px] font-bold" [ngClass]="isToppingChargeable(topping) ? 'text-amber-700' : 'text-emerald-700'">
                          @if (!isToppingSelected(topping)) {
                            Seleccionar
                          } @else if (isToppingChargeable(topping)) {
                            +{{ product.extra_topping_price | currencyCop }}
                          } @else {
                            Incluido
                          }
                        </span>
                        <span
                          class="w-5 h-5 rounded-lg flex items-center justify-center transition-colors"
                          [ngClass]="isToppingSelected(topping)
                            ? 'bg-primary-container text-white'
                            : 'border border-outline text-transparent'"
                        >
                          <span class="material-symbols-outlined text-xs">check</span>
                        </span>
                      </span>
                    </button>
                  }
                </div>
              }
              @if (extraToppingCount() > 0) {
                <p class="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">
                  {{ extraToppingCount() }} topping(s) extra × {{ quantity() }} unidad(es):
                  {{ extraToppingTotal() | currencyCop }}
                </p>
              }
            </div>
            }

            <!-- Quantity & Observations -->
            <div class="space-y-3 pt-2 border-t border-surface-container-high">
              <!-- Quantity selector -->
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-on-surface uppercase tracking-wider">Cantidad:</label>
                <div class="flex items-center gap-3 bg-surface-container p-1 rounded-xl border border-outline-variant">
                  <button
                    type="button"
                    (click)="decrementQty()"
                    class="w-8 h-8 rounded-lg bg-surface-container-lowest hover:bg-white text-primary flex items-center justify-center font-bold shadow-xs active:scale-90 transition-transform"
                  >
                    -
                  </button>
                  <span class="w-6 text-center font-bold text-sm text-primary">{{ quantity() }}</span>
                  <button
                    type="button"
                    (click)="incrementQty()"
                    class="w-8 h-8 rounded-lg bg-primary-container hover:bg-primary text-white flex items-center justify-center font-bold shadow-xs active:scale-90 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>

              <!-- Observations notes -->
              <div>
                <label class="block text-xs font-bold text-on-surface uppercase tracking-wider mb-1">
                  Observaciones para cocina:
                </label>
                <textarea
                  [(ngModel)]="notes"
                  rows="2"
                  placeholder="Ej. Bastante salsa, servir con cuchara larga..."
                  class="w-full text-xs p-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none resize-none"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- Modal Footer CTA -->
          <div class="p-4 bg-surface-container-lowest border-t border-surface-container-high space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-on-surface-variant font-medium">Subtotal Línea:</span>
              <span class="text-lg font-bold text-primary">{{ lineTotal() | currencyCop: true }}</span>
            </div>
            <button
              type="button"
              (click)="confirmAdd()"
              class="w-full py-3.5 bg-primary-container hover:bg-primary text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <span class="material-symbols-outlined text-lg">add_shopping_cart</span>
              <span>AGREGAR A LA COMANDA ({{ lineTotal() | currencyCop }})</span>
            </button>
          </div>

        </div>
      </div>
    }
  `,
})
export class CustomizationModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() product: Product | null = null;
  @Input() allToppings: Topping[] = [];
  @Output() confirm = new EventEmitter<{
    product: Product;
    size: string;
    flavor: string;
    notes: string;
    toppings: Topping[];
    quantity: number;
  }>();
  @Output() cancel = new EventEmitter<void>();

  readonly selectedSize = signal<string>('8 oz');
  readonly isToppingsOpen = signal(false);
  readonly selectedFlavor = signal<string>('');
  readonly selectedToppings = signal<Topping[]>([]);
  readonly selectedToppingNames = computed(() =>
    this.selectedToppings().map((topping) => topping.name).join(', ')
  );
  readonly quantity = signal<number>(1);
  notes = '';

  availableSizes(): ProductSize[] {
    return this.product?.has_sizes
      ? this.product.sizes
      : [{ name: 'Estándar', price: this.product?.base_price ?? 0 }];
  }

  // Toppings disponibles para este producto
  readonly availableToppings = computed(() => {
    return this.product?.toppings ?? this.allToppings;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] || changes['isOpen']) {
      this.selectedFlavor.set(this.availableFlavors()[0] || '');
      this.selectedSize.set(this.availableSizes()[0]?.name || 'Estándar');
    }
  }

  onSizeChange(event: Event): void {
    this.selectedSize.set((event.target as HTMLSelectElement).value);
  }

  availableFlavors(): string[] {
    return this.product?.flavors || [];
  }

  flavorIcon(flavor: string): string {
    const icons: Record<string, string> = {
      Fresa: '🍓',
      Vainilla: '🍦',
      Chocolate: '🍫',
      Maracuyá: '🥭',
      Mango: '🥭',
    };
    return icons[flavor] || '🍨';
  }

  readonly lineTotal = computed(() => {
    if (!this.product) return 0;
    const sizePrice = this.availableSizes().find((size) => size.name === this.selectedSize())?.price
      ?? this.product.base_price;
    const toppingsExtra = this.extraToppingUnitTotal();
    const unitPrice = Math.max(0, sizePrice + toppingsExtra);
    return unitPrice * this.quantity();
  });

  extraToppingCount(): number {
    return this.product?.has_toppings
      ? Math.max(0, this.selectedToppings().length - this.product.max_free_toppings)
      : 0;
  }

  extraToppingTotal(): number {
    return this.extraToppingUnitTotal() * this.quantity();
  }

  private extraToppingUnitTotal(): number {
    return (this.product?.extra_topping_price ?? 0) * this.extraToppingCount();
  }

  isToppingChargeable(topping: Topping): boolean {
    const selectedIndex = this.selectedToppings().findIndex((item) => item.id === topping.id);
    return selectedIndex >= (this.product?.max_free_toppings ?? 0) &&
      selectedIndex >= 0 &&
      (this.product?.extra_topping_price ?? 0) > 0;
  }

  toppingActionLabel(topping: Topping): string {
    const action = this.isToppingSelected(topping) ? 'Quitar' : 'Agregar';
    const charge = this.isToppingSelected(topping) && this.isToppingChargeable(topping)
      ? `, recargo ${this.product?.extra_topping_price ?? 0} pesos`
      : '';
    return `${action} ${topping.name}${charge}`;
  }

  toggleTopping(t: Topping): void {
    const list = this.selectedToppings();
    if (list.some((item) => item.id === t.id)) {
      this.selectedToppings.set(list.filter((item) => item.id !== t.id));
    } else if (this.product?.has_toppings) {
      this.selectedToppings.set([...list, t]);
    }
  }

  isToppingSelected(t: Topping): boolean {
    return this.selectedToppings().some((item) => item.id === t.id);
  }

  incrementQty(): void {
    this.quantity.update((q) => q + 1);
  }

  decrementQty(): void {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  confirmAdd(): void {
    if (!this.product) return;
    this.confirm.emit({
      product: this.product,
      size: this.selectedSize(),
      flavor: this.selectedFlavor(),
      notes: this.notes.trim(),
      toppings: this.selectedToppings(),
      quantity: this.quantity(),
    });
    this.reset();
  }

  private reset(): void {
    this.selectedSize.set(this.availableSizes()[0]?.name || 'Estándar');
    this.selectedFlavor.set('');
    this.selectedToppings.set([]);
    this.isToppingsOpen.set(false);
    this.quantity.set(1);
    this.notes = '';
  }
}
