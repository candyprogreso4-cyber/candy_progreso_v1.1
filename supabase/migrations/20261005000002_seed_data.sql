-- ====================================================================
-- CANDY EL PROGRESO - POS Heladería & Cafetería
-- Migration 02: Seed Data (Categorías, Productos, Toppings, Mesas, Empleados)
-- ====================================================================

-- 1. MESAS FÍSICAS (Mesas 1 a 8)
INSERT INTO public.tables (table_number, status)
VALUES 
  (1, 'available'),
  (2, 'available'),
  (3, 'available'),
  (4, 'available'),
  (5, 'available'),
  (6, 'available'),
  (7, 'available'),
  (8, 'available')
ON CONFLICT (table_number) DO NOTHING;

-- 2. CATEGORÍAS DE LA CARTA
INSERT INTO public.categories (id, name, description, image_url, sort_order)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Helados', 'Helados cremosos artesanales, conos y copas clásicas', '🍦', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Yogur', 'Yogur helado artesanal bajo en grasa con fermentos vivos', '🥛', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Fresas con Crema', 'Fresas frescas de temporada con crema chantilly especial', '🍓', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Postres', 'Obleas cuchareables, gelatinas candy y delicias dulces', '🍰', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Granizados', 'Granizados de pura fruta natural y café helado', '🥤', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Frutas Candy', 'Piña candy, sandía candy y ensaladas de frutas especiales', '🍉', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Toppings', 'Adiciones, salsas artesanales y coberturas crocantes', '🍫', 7)
ON CONFLICT (name) DO NOTHING;

-- 3. PRODUCTOS DE CANDY EL PROGRESO (Precios en COP)
INSERT INTO public.products (id, category_id, name, description, image_url, base_price, is_active, stock_controlled)
VALUES
  (
    'd1000000-0000-0000-0000-000000000001',
    (SELECT id FROM public.categories WHERE name = 'Yogur'),
    'Yogur Helado 8 oz',
    'Base ligera de yogur griego artesanal bajo en grasa con textura suave y cremosa',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAoKKQe291PoY-7j1sHG5gop5iczMKYRpwGJEakVmyXiho-dyftX-QDO7dTu2zmHqlNrpHMUwj5zXlwD9_a1Wx8hzXAoISfFtBionslkYygUdQSZ3cHUc7DyQTP2JkRqjOb3nAVB7rLBDhaAzySapc6Y1f4VyJAylBQqa8c2i20oHQffHg_Ca8AtLNZEtDihaaL9MBN-EHSSHOLk_1DNlNTX_VFOpdpwnuFiFQ8-0e2yVjP9Qovk7gp',
    10000.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    (SELECT id FROM public.categories WHERE name = 'Yogur'),
    'Yogur Helado 12 oz',
    'Porción grande de yogur helado para compartir o disfrutar con extra adiciones',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDn0Mu4LlL2zUG-yZazczWho3QBjE29O305vE3NIw76DhKFbkxtHgSN4qGvHady4XHvug-L4UXoX8fFgQ3OC9dYEFROpoL4H7KZGvkiPezPdVGJcAstzxbpOjmxUKgHIPLvtdbc220UXu-LdBWdX_RNPDpXq3Km7nWoPMXwSQ3Svw4o27V1HX3YvLrHcpWNyxNoQkQAljnsx7_LOAUjYCdXIYZ1vGFe4GX6-b9Hm4n4DjCH9RNhyvJ-',
    13000.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    (SELECT id FROM public.categories WHERE name = 'Yogur'),
    'Yogur Helado 6 oz',
    'Porción personal ideal de yogur helado con salsa al gusto',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAoKKQe291PoY-7j1sHG5gop5iczMKYRpwGJEakVmyXiho-dyftX-QDO7dTu2zmHqlNrpHMUwj5zXlwD9_a1Wx8hzXAoISfFtBionslkYygUdQSZ3cHUc7DyQTP2JkRqjOb3nAVB7rLBDhaAzySapc6Y1f4VyJAylBQqa8c2i20oHQffHg_Ca8AtLNZEtDihaaL9MBN-EHSSHOLk_1DNlNTX_VFOpdpwnuFiFQ8-0e2yVjP9Qovk7gp',
    8000.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000004',
    (SELECT id FROM public.categories WHERE name = 'Fresas con Crema'),
    'Fresas con Crema Especial',
    'Fresas seleccionadas de primera calidad, crema chantilly de la casa y leche condensada',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDjk0L4UDR9AwRz1y6tiyUEyDDNWuRuu64yxL1iJIlmxw-Eba6iErBERVdqjs_mUfFhO0njSur8V7mVefEpfYnIH1gQKw8QzbzF02CV5lHXIEjWvQhJJVFod_ieFqQq1ZMuHH42xhsBYnYG__BTtBeYJCNrtWadIstRlrlSKlOAfyqevN5MGPD-uS8zZe24j4TkfeoYkksKm3n3hAwqIL9H54kHfXZXTCI9H_d_7dnpB2kagdO-TlMn',
    12000.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000005',
    (SELECT id FROM public.categories WHERE name = 'Helados'),
    'Copa Sundae Candy',
    'Dos bolas de helado artesanal, barquillo crujiente, salsa de chocolate caliente y cereza marrasquino',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDtlpe472DLP_7hUB_YFtyGq5IwGg_6To00OBg5-JxOG3MqVU8m9qZWR0vTY_j7zTZgna-YMOm-vbb5xd-mnHVYF2VT9S56GgybMfBBnZGAly2r9YqZOidknpUlDtdL_rjDlPY5QPQyybBB8Mb4Ap3oFLqX34VS9BZIdJNWonesxdZbWyTjZDSlWaBrOFsDUu2xyr6V4fldZL7hLDbzK0nWcF0FJPZq7uSdhreFud_hF7XrKU8fTd9D',
    14500.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000006',
    (SELECT id FROM public.categories WHERE name = 'Frutas Candy'),
    'Piña Candy',
    'Media piña rellena con helado artesanal, trozos de fruta natural fresca y salsas frutales',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop',
    15000.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000007',
    (SELECT id FROM public.categories WHERE name = 'Frutas Candy'),
    'Sandía Candy',
    'Sandía tallada con helado refrescante, chispas de chocolate y reducción de frutos rojos',
    'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop',
    15000.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000008',
    (SELECT id FROM public.categories WHERE name = 'Postres'),
    'Oblea Cuchareable',
    'Oblea en copa con generoso arequipe, queso campesino rallado, chantilly y salsa de mora',
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&auto=format&fit=crop',
    9500.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000009',
    (SELECT id FROM public.categories WHERE name = 'Postres'),
    'Gelatina Candy Especial',
    'Gelatina multicolor en capas con crema especial de leche condensada y duraznos',
    'https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=500&auto=format&fit=crop',
    7500.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000010',
    (SELECT id FROM public.categories WHERE name = 'Granizados'),
    'Granizado de Maracuyá',
    'Granizado con pulpa 100% natural de maracuyá ácido con leche condensada',
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop',
    8500.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000011',
    (SELECT id FROM public.categories WHERE name = 'Granizados'),
    'Granizado de Frutos Rojos',
    'Fresa, mora y arándanos granizados con toque refrescante',
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500&auto=format&fit=crop',
    8500.00,
    true,
    false
  ),
  (
    'd1000000-0000-0000-0000-000000000012',
    (SELECT id FROM public.categories WHERE name = 'Helados'),
    'Cono Doble Artesanal',
    'Dos bolas de helado artesanal servidas en barquillo crocante azucarado',
    'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500&auto=format&fit=crop',
    7000.00,
    true,
    false
  )
ON CONFLICT (name) DO UPDATE
SET category_id = EXCLUDED.category_id,
    base_price = EXCLUDED.base_price,
    image_url = EXCLUDED.image_url,
    description = EXCLUDED.description;

-- 4. TOPPINGS Y ADICIONES
INSERT INTO public.toppings (id, name, description, image_url, price)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Oreo picada', 'Galleta Oreo triturada crocante', '🍪', 2000.00),
  ('a1000000-0000-0000-0000-000000000002', 'Chispas de chocolate', 'Gotas de chocolate semiamargo 54%', '🍫', 2000.00),
  ('a1000000-0000-0000-0000-000000000003', 'Salsa de maracuyá', 'Reducción de maracuyá natural con semillas', '🥭', 2000.00),
  ('a1000000-0000-0000-0000-000000000004', 'Salsa de fresas', 'Fruta natural sin conservantes en almíbar ligero', '🍓', 2000.00),
  ('a1000000-0000-0000-0000-000000000005', 'Maní crocante', 'Maní tostado troceado ligeramente dulce', '🥜', 2000.00),
  ('a1000000-0000-0000-0000-000000000006', 'Gomitas dulces', 'Surtido frutal azucarado de gomitas', '🍬', 2000.00),
  ('a1000000-0000-0000-0000-000000000007', 'Crema Chantilly', 'Chantilly suave batida artesanal', '🥛', 2000.00),
  ('a1000000-0000-0000-0000-000000000008', 'Salsa de chocolate fudge', 'Chocolate espeso tibio', '🍫', 2000.00),
  ('a1000000-0000-0000-0000-000000000009', 'Leche condensada', 'Toque dulce tradicional', '🍶', 2000.00),
  ('a1000000-0000-0000-0000-000000000010', 'Barquillo artesanal', 'Barquillo de vainilla crocante', '🥢', 1500.00)
ON CONFLICT (name) DO UPDATE
SET price = EXCLUDED.price;

-- 5. ASOCIACIÓN PRODUCTOS - TOPPINGS (product_toppings)
INSERT INTO public.product_toppings (product_id, topping_id)
SELECT p.id, t.id
FROM public.products p, public.toppings t
WHERE p.category_id IN (
  SELECT id FROM public.categories
  WHERE name IN ('Helados', 'Yogur', 'Fresas con Crema', 'Postres')
)
ON CONFLICT (product_id, topping_id) DO NOTHING;

-- 6. EMPLEADOS REGISTRADOS PARA ACCESO POR QR
INSERT INTO public.employees (id, identification, full_name, is_active)
VALUES
  ('e1000000-0000-0000-0000-000000000001', '1098765432', 'Carlos Mendoza', true),
  ('e1000000-0000-0000-0000-000000000002', '1098765433', 'Laura Gómez', true),
  ('e1000000-0000-0000-0000-000000000003', '1098765434', 'Valentina Ríos', true),
  ('e1000000-0000-0000-0000-000000000004', '1098765435', 'Andrés Castro', true)
ON CONFLICT (identification) DO NOTHING;

-- 7. TOKEN DIARIO ACTIVO DE PRUEBA
INSERT INTO public.daily_access (token, qr_code, expires_at, is_active)
VALUES (
  'candy-demo-token-today',
  'CANDY-ACCESS:candy-demo-token-today',
  now() + interval '24 hours',
  true
)
ON CONFLICT (token) DO UPDATE
SET expires_at = now() + interval '24 hours',
    is_active = true;

-- 8. CAJA DIARIA INICIAL ABIERTA (Base $150.000 COP)
INSERT INTO public.cash_registers (id, opening_amount, status)
VALUES ('b1000000-0000-0000-0000-000000000001', 150000.00, 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.cash_movements (cash_register_id, amount, type, description)
VALUES ('b1000000-0000-0000-0000-000000000001', 150000.00, 'income', 'Base inicial de caja física verificada a 08:00 AM')
ON CONFLICT DO NOTHING;
