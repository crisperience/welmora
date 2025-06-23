-- Welmora Database Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');

CREATE TYPE product_status AS ENUM ('draft', 'pending', 'private', 'publish');

CREATE TYPE inventory_transaction_type AS ENUM ('sale', 'restock', 'adjustment', 'return', 'damaged');

CREATE TYPE scanner_action AS ENUM ('inventory_check', 'stock_update', 'sale', 'price_check');

-- Products table (synced with WooCommerce)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    wc_product_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    slug TEXT,
    sku TEXT UNIQUE,
    description TEXT,
    short_description TEXT,
    price DECIMAL(10, 2),
    regular_price DECIMAL(10, 2),
    sale_price DECIMAL(10, 2),
    stock_quantity INTEGER DEFAULT 0,
    manage_stock BOOLEAN DEFAULT true,
    stock_status TEXT DEFAULT 'instock',
    status product_status DEFAULT 'publish',
    weight DECIMAL(8, 2),
    dimensions JSONB,
    categories JSONB,
    tags JSONB,
    images JSONB,
    attributes JSONB,
    variations JSONB,
    barcode TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        synced_at TIMESTAMP
    WITH
        TIME ZONE
);

-- Customers table (synced with WooCommerce)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    wc_customer_id INTEGER UNIQUE,
    email TEXT UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    phone TEXT,
    date_of_birth DATE,
    billing_address JSONB,
    shipping_address JSONB,
    avatar_url TEXT,
    is_paying_customer BOOLEAN DEFAULT false,
    orders_count INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        synced_at TIMESTAMP
    WITH
        TIME ZONE
);

-- Orders table (synced with WooCommerce)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    wc_order_id INTEGER UNIQUE,
    order_number TEXT,
    customer_id UUID REFERENCES customers (id),
    status order_status DEFAULT 'pending',
    currency TEXT DEFAULT 'EUR',
    total DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2),
    tax_total DECIMAL(10, 2) DEFAULT 0,
    shipping_total DECIMAL(10, 2) DEFAULT 0,
    discount_total DECIMAL(10, 2) DEFAULT 0,
    payment_method TEXT,
    payment_method_title TEXT,
    transaction_id TEXT,
    billing_address JSONB,
    shipping_address JSONB,
    line_items JSONB,
    shipping_lines JSONB,
    tax_lines JSONB,
    fee_lines JSONB,
    coupon_lines JSONB,
    meta_data JSONB,
    date_created TIMESTAMP
    WITH
        TIME ZONE,
        date_modified TIMESTAMP
    WITH
        TIME ZONE,
        date_completed TIMESTAMP
    WITH
        TIME ZONE,
        date_paid TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        synced_at TIMESTAMP
    WITH
        TIME ZONE
);

-- Order items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    order_id UUID REFERENCES orders (id) ON DELETE CASCADE,
    product_id UUID REFERENCES products (id),
    wc_product_id INTEGER,
    name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    tax_total DECIMAL(10, 2) DEFAULT 0,
    meta_data JSONB,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Inventory transactions table
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    product_id UUID REFERENCES products (id) ON DELETE CASCADE,
    type inventory_transaction_type NOT NULL,
    quantity INTEGER NOT NULL,
    previous_stock INTEGER,
    new_stock INTEGER,
    reason TEXT,
    notes TEXT,
    reference_id TEXT, -- order_id, adjustment_id, etc.
    user_id UUID REFERENCES auth.users (id),
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Scanner sessions table
CREATE TABLE scanner_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE,
    session_name TEXT,
    started_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        ended_at TIMESTAMP
    WITH
        TIME ZONE,
        items_scanned INTEGER DEFAULT 0,
        location TEXT,
        device_info JSONB,
        notes TEXT
);

-- Scanned items table
CREATE TABLE scanned_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    session_id UUID REFERENCES scanner_sessions (id) ON DELETE CASCADE,
    product_id UUID REFERENCES products (id),
    barcode TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    action scanner_action NOT NULL,
    expected_quantity INTEGER,
    actual_quantity INTEGER,
    notes TEXT,
    location TEXT,
    scanned_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Sync logs table
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    sync_type TEXT NOT NULL, -- 'products', 'orders', 'customers'
    direction TEXT NOT NULL, -- 'wc_to_supabase', 'supabase_to_wc', 'bidirectional'
    status TEXT NOT NULL, -- 'success', 'error', 'partial'
    records_processed INTEGER DEFAULT 0,
    records_success INTEGER DEFAULT 0,
    records_error INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP
    WITH
        TIME ZONE,
        duration_ms INTEGER
);

-- User profiles table (extends auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'manager', 'user'
    permissions JSONB,
    preferences JSONB,
    last_login TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    wc_category_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES categories (id),
    image_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        synced_at TIMESTAMP
    WITH
        TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_products_wc_id ON products (wc_product_id);

CREATE INDEX idx_products_sku ON products (sku);

CREATE INDEX idx_products_barcode ON products (barcode);

CREATE INDEX idx_products_status ON products (status);

CREATE INDEX idx_products_stock_quantity ON products (stock_quantity);

CREATE INDEX idx_products_updated_at ON products (updated_at);

CREATE INDEX idx_customers_wc_id ON customers (wc_customer_id);

CREATE INDEX idx_customers_email ON customers (email);

CREATE INDEX idx_customers_updated_at ON customers (updated_at);

CREATE INDEX idx_orders_wc_id ON orders (wc_order_id);

CREATE INDEX idx_orders_customer_id ON orders (customer_id);

CREATE INDEX idx_orders_status ON orders (status);

CREATE INDEX idx_orders_created_at ON orders (created_at);

CREATE INDEX idx_orders_updated_at ON orders (updated_at);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);

CREATE INDEX idx_order_items_product_id ON order_items (product_id);

CREATE INDEX idx_inventory_transactions_product_id ON inventory_transactions (product_id);

CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(type);

CREATE INDEX idx_inventory_transactions_created_at ON inventory_transactions (created_at);

CREATE INDEX idx_scanner_sessions_user_id ON scanner_sessions (user_id);

CREATE INDEX idx_scanner_sessions_started_at ON scanner_sessions (started_at);

CREATE INDEX idx_scanned_items_session_id ON scanned_items (session_id);

CREATE INDEX idx_scanned_items_product_id ON scanned_items (product_id);

CREATE INDEX idx_scanned_items_barcode ON scanned_items (barcode);

CREATE INDEX idx_scanned_items_scanned_at ON scanned_items (scanned_at);

CREATE INDEX idx_sync_logs_sync_type ON sync_logs (sync_type);

CREATE INDEX idx_sync_logs_status ON sync_logs (status);

CREATE INDEX idx_sync_logs_started_at ON sync_logs (started_at);

CREATE INDEX idx_categories_wc_id ON categories (wc_category_id);

CREATE INDEX idx_categories_parent_id ON categories (parent_id);

CREATE INDEX idx_categories_slug ON categories (slug);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE scanner_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE scanned_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Products policies
CREATE POLICY "Allow authenticated users to view products" ON products FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert products" ON products FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

CREATE POLICY "Allow authenticated users to update products" ON products FOR
UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete products" ON products FOR DELETE TO authenticated USING (true);

-- Customers policies
CREATE POLICY "Allow authenticated users to view customers" ON customers FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert customers" ON customers FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

CREATE POLICY "Allow authenticated users to update customers" ON customers FOR
UPDATE TO authenticated USING (true);

-- Orders policies
CREATE POLICY "Allow authenticated users to view orders" ON orders FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert orders" ON orders FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

CREATE POLICY "Allow authenticated users to update orders" ON orders FOR
UPDATE TO authenticated USING (true);

-- Order items policies
CREATE POLICY "Allow authenticated users to view order items" ON order_items FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert order items" ON order_items FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

CREATE POLICY "Allow authenticated users to update order items" ON order_items FOR
UPDATE TO authenticated USING (true);

-- Inventory transactions policies
CREATE POLICY "Allow authenticated users to view inventory transactions" ON inventory_transactions FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert inventory transactions" ON inventory_transactions FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

-- Scanner sessions policies
CREATE POLICY "Users can view their own scanner sessions" ON scanner_sessions FOR
SELECT TO authenticated USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their own scanner sessions" ON scanner_sessions FOR
INSERT
    TO authenticated
WITH
    CHECK (auth.uid () = user_id);

CREATE POLICY "Users can update their own scanner sessions" ON scanner_sessions FOR
UPDATE TO authenticated USING (auth.uid () = user_id);

-- Scanned items policies
CREATE POLICY "Users can view scanned items from their sessions" ON scanned_items FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM scanner_sessions
            WHERE
                scanner_sessions.id = scanned_items.session_id
                AND scanner_sessions.user_id = auth.uid ()
        )
    );

CREATE POLICY "Users can insert scanned items to their sessions" ON scanned_items FOR
INSERT
    TO authenticated
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM scanner_sessions
            WHERE
                scanner_sessions.id = scanned_items.session_id
                AND scanner_sessions.user_id = auth.uid ()
        )
    );

-- User profiles policies
CREATE POLICY "Users can view their own profile" ON user_profiles FOR
SELECT TO authenticated USING (auth.uid () = id);

CREATE POLICY "Users can update their own profile" ON user_profiles FOR
UPDATE TO authenticated USING (auth.uid () = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles FOR
INSERT
    TO authenticated
WITH
    CHECK (auth.uid () = id);

-- Categories policies
CREATE POLICY "Allow authenticated users to view categories" ON categories FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert categories" ON categories FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

CREATE POLICY "Allow authenticated users to update categories" ON categories FOR
UPDATE TO authenticated USING (true);

-- Sync logs policies (admin only)
CREATE POLICY "Allow authenticated users to view sync logs" ON sync_logs FOR
SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert sync logs" ON sync_logs FOR
INSERT
    TO authenticated
WITH
    CHECK (true);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, first_name, last_name)
    VALUES (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
    RETURN new;
END;
$$ language plpgsql security definer;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products(threshold INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    name TEXT,
    sku TEXT,
    stock_quantity INTEGER,
    status product_status
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.name, p.sku, p.stock_quantity, p.status
    FROM products p
    WHERE p.manage_stock = true 
    AND p.stock_quantity <= threshold 
    AND p.status = 'publish'
    ORDER BY p.stock_quantity ASC;
END;
$$ language plpgsql security definer;

-- Create function to update product stock
CREATE OR REPLACE FUNCTION update_product_stock(
    product_uuid UUID,
    quantity_change INTEGER,
    transaction_type inventory_transaction_type,
    reason_text TEXT DEFAULT NULL,
    user_uuid UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_stock INTEGER;
    new_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT stock_quantity INTO current_stock FROM products WHERE id = product_uuid;
    
    IF current_stock IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;
    
    -- Calculate new stock
    new_stock := current_stock + quantity_change;
    
    -- Prevent negative stock
    IF new_stock < 0 THEN
        new_stock := 0;
    END IF;
    
    -- Update product stock
    UPDATE products 
    SET stock_quantity = new_stock, 
        updated_at = NOW()
    WHERE id = product_uuid;
    
    -- Log the transaction
    INSERT INTO inventory_transactions (
        product_id, 
        type, 
        quantity, 
        previous_stock, 
        new_stock, 
        reason, 
        user_id
    ) VALUES (
        product_uuid, 
        transaction_type, 
        quantity_change, 
        current_stock, 
        new_stock, 
        reason_text, 
        user_uuid
    );
    
    RETURN TRUE;
END;
$$ language plpgsql security definer;

-- Insert some sample data for testing
-- Sample categories
INSERT INTO
    categories (name, slug, description)
VALUES (
        'Electronics',
        'electronics',
        'Electronic devices and accessories'
    ),
    (
        'Clothing',
        'clothing',
        'Apparel and fashion items'
    ),
    (
        'Books',
        'books',
        'Books and publications'
    ),
    (
        'Home & Garden',
        'home-garden',
        'Home and garden items'
    );

COMMENT ON
TABLE products IS 'Products synchronized with WooCommerce';

COMMENT ON
TABLE customers IS 'Customers synchronized with WooCommerce';

COMMENT ON TABLE orders IS 'Orders synchronized with WooCommerce';

COMMENT ON TABLE order_items IS 'Individual items within orders';

COMMENT ON
TABLE inventory_transactions IS 'Log of all inventory changes';

COMMENT ON TABLE scanner_sessions IS 'Barcode/QR scanning sessions';

COMMENT ON TABLE scanned_items IS 'Items scanned during sessions';

COMMENT ON
TABLE sync_logs IS 'Synchronization logs between WooCommerce and Supabase';

COMMENT ON
TABLE user_profiles IS 'Extended user profile information';

COMMENT ON
TABLE categories IS 'Product categories synchronized with WooCommerce';