import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { CurrencyCopPipe } from './shared/pipes/currency-cop.pipe';
import { CartService } from './core/services/cart.service';
import { Product, Topping, DiningTable } from './core/models/pos.types';

describe('Candy El Progreso POS Tests', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the App root component', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  describe('CurrencyCopPipe', () => {
    const pipe = new CurrencyCopPipe();

    it('should format numbers in Colombian Pesos', () => {
      const result = pipe.transform(10000);
      expect(result).toContain('10.000');
    });

    it('should format with COP suffix when requested', () => {
      const result = pipe.transform(18500, true);
      expect(result).toContain('18.500');
      expect(result).toContain('COP');
    });

    it('should handle zero, null and undefined gracefully', () => {
      expect(pipe.transform(0)).toContain('0');
      expect(pipe.transform(null)).toBe('$0');
      expect(pipe.transform(undefined)).toBe('$0');
    });
  });

  describe('CartService', () => {
    let cartService: CartService;

    beforeEach(() => {
      cartService = TestBed.inject(CartService);
      cartService.clearCart();
    });

    it('should add products and calculate toppings correctly', () => {
      const mockProduct: Product = {
        id: 'p1',
        category_id: 'c1',
        name: 'Yogur Helado 8 oz',
        base_price: 10000,
        is_active: true,
        flavors: [],
        has_sizes: false,
        sizes: [],
        has_toppings: true,
        max_free_toppings: 1,
        extra_topping_price: 750,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockToppings: Topping[] = [
        { id: 't1', name: 'Oreo picada', price: 2000, is_active: true, created_at: '' },
        { id: 't2', name: 'Chispas de chocolate', price: 2000, is_active: true, created_at: '' },
      ];

      cartService.addItem(mockProduct, {
        size: '8 oz',
        flavor: 'Maracuyá',
        toppings: mockToppings,
        quantity: 1,
      });

      expect(cartService.itemCount()).toBe(1);
      // One topping is included; only the second has the configured surcharge.
      expect(cartService.total()).toBe(10750);

      // Increment quantity
      const addedItem = cartService.cartItems()[0];
      cartService.updateQuantity(addedItem.id, 1);
      expect(cartService.itemCount()).toBe(2);
      expect(cartService.total()).toBe(21500);

      // Decrement quantity
      cartService.updateQuantity(addedItem.id, -1);
      expect(cartService.itemCount()).toBe(1);
      expect(cartService.total()).toBe(10750);

      // Decrement to zero removes item
      cartService.updateQuantity(addedItem.id, -1);
      expect(cartService.itemCount()).toBe(0);
      expect(cartService.total()).toBe(0);
    });

    it('should use the configured size price when adding and changing quantity', () => {
      const mockProduct: Product = {
        id: 'p2',
        category_id: 'c1',
        name: 'Yogur porción',
        base_price: 10000,
        is_active: true,
        flavors: [],
        has_sizes: true,
        sizes: [
          { name: 'Pequeño', price: 8000 },
          { name: 'Grande', price: 15000 },
        ],
        has_toppings: false,
        max_free_toppings: 0,
        extra_topping_price: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      cartService.addItem(mockProduct, { size: 'Grande', quantity: 2 });
      expect(cartService.total()).toBe(30000);

      cartService.updateQuantity(cartService.cartItems()[0].id, 1);
      expect(cartService.total()).toBe(45000);
    });

    it('should manage table selection, drawer state and clearing cart', () => {
      const mockTable: DiningTable = {
        id: 'table-uuid-1',
        table_number: 4,
        status: 'available',
        created_at: new Date().toISOString(),
      };

      cartService.setTable(mockTable);
      expect(cartService.selectedTable()?.id).toBe('table-uuid-1');
      expect(cartService.selectedTable()?.table_number).toBe(4);

      cartService.orderNotes.set('Sin servilletas, cliente alérgico al maní');
      expect(cartService.orderNotes()).toBe('Sin servilletas, cliente alérgico al maní');

      cartService.openDrawer();
      expect(cartService.isDrawerOpen()).toBe(true);

      cartService.closeDrawer();
      expect(cartService.isDrawerOpen()).toBe(false);

      cartService.clearCart();
      expect(cartService.orderNotes()).toBe('');
      expect(cartService.cartItems().length).toBe(0);
      expect(cartService.isDrawerOpen()).toBe(false);
    });
  });
});
