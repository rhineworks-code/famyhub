'use strict';

/**
 * Schema + migrations.
 *
 * Works for three situations:
 *  1. Fresh install           → all tables are created.
 *  2. Existing FamyHub DB     → missing tables/columns are added, nothing is dropped.
 *  3. Very old DB (name/password_hash columns) → data is back-filled into the current columns.
 *
 * Every step is idempotent and safe to run on every start.
 */

const db = require('./index');

const TABLES = [
    `CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        invite_code TEXT UNIQUE NOT NULL,
        calendar_token TEXT UNIQUE,
        smtp_host TEXT, smtp_port INTEGER, smtp_user TEXT, smtp_pass TEXT, smtp_from TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS family_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        family_id INTEGER,
        role TEXT DEFAULT 'member',
        is_admin INTEGER DEFAULT 0,
        permissions TEXT,
        reset_code TEXT, reset_expires DATETIME,
        language TEXT DEFAULT 'de', theme TEXT DEFAULT 'system',
        pin_code TEXT,
        two_factor_enabled INTEGER DEFAULT 0, two_factor_secret TEXT,
        dashboard_widgets TEXT, sidebar_order TEXT, sidebar_hidden TEXT,
        pocket_money_balance REAL DEFAULT 0.0, points_balance INTEGER DEFAULT 0,
        mood_emoji TEXT, mood_text TEXT, last_active TEXT,
        profile_picture TEXT, display_role TEXT,
        timezone TEXT DEFAULT 'Europe/Berlin', time_offset INTEGER DEFAULT 0,
        token_version INTEGER DEFAULT 0,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        feature_name TEXT NOT NULL,
        is_enabled INTEGER DEFAULT 1,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS chores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER,
        title TEXT NOT NULL, description TEXT,
        points INTEGER DEFAULT 0,
        assigned_to INTEGER, due_date TEXT,
        completed INTEGER DEFAULT 0, completed_by INTEGER, completed_at DATETIME,
        is_recurring INTEGER DEFAULT 0, recurring_interval TEXT DEFAULT 'daily',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS chore_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chore_id INTEGER, user_id INTEGER, family_id INTEGER,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        points_earned INTEGER,
        FOREIGN KEY(chore_id) REFERENCES chores(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS pocket_money_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        amount REAL NOT NULL, type TEXT NOT NULL, reason TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL, start TEXT NOT NULL, end TEXT,
        allDay INTEGER DEFAULT 0, description TEXT, color TEXT,
        location TEXT, image_url TEXT,
        family_id INTEGER, user_id INTEGER,
        external_uid TEXT, external_calendar_id INTEGER, is_external INTEGER DEFAULT 0,
        event_type TEXT DEFAULT 'normal', recurrence_pattern TEXT DEFAULT 'none',
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS external_calendars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, user_id INTEGER,
        name TEXT NOT NULL, url TEXT NOT NULL,
        color TEXT DEFAULT '#3788d8',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS shopping_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        family_id INTEGER,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        category TEXT,
        family_id INTEGER, list_id INTEGER,
        FOREIGN KEY(family_id) REFERENCES families(id),
        FOREIGN KEY(list_id) REFERENCES shopping_lists(id)
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, user_id INTEGER, user_name TEXT,
        content TEXT NOT NULL,
        image_url TEXT, reactions TEXT, poll_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        family_id INTEGER, created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_id INTEGER,
        filename TEXT NOT NULL, original_name TEXT,
        uploaded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS album_access (
        album_id INTEGER, user_id INTEGER,
        PRIMARY KEY (album_id, user_id),
        FOREIGN KEY(album_id) REFERENCES albums(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER,
        date TEXT NOT NULL, meal_type TEXT NOT NULL, recipe_name TEXT NOT NULL,
        notes TEXT, created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS meal_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER, user_id INTEGER, family_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(meal_id) REFERENCES meals(id) ON DELETE CASCADE,
        UNIQUE(meal_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        family_id INTEGER,
        name TEXT NOT NULL, relationship TEXT, phone TEXT, email TEXT, address TEXT, notes TEXT,
        is_emergency INTEGER DEFAULT 0, is_favorite INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(family_id) REFERENCES families(id)
    )`,
    `CREATE TABLE IF NOT EXISTS recipe_folders (
        id TEXT PRIMARY KEY,
        family_id INTEGER, name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, folder_id TEXT, created_by INTEGER,
        title TEXT NOT NULL, ingredients TEXT, instructions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(folder_id) REFERENCES recipe_folders(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        family_id INTEGER,
        title TEXT NOT NULL, description TEXT, deadline TEXT,
        recurring_interval TEXT, assigned_to TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS project_todos (
        id TEXT PRIMARY KEY,
        project_id TEXT, task TEXT NOT NULL,
        completed INTEGER DEFAULT 0, urgency TEXT DEFAULT 'normal',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS project_milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT, title TEXT NOT NULL, due_date TEXT,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, user_id INTEGER,
        type TEXT CHECK(type IN ('income', 'expense')),
        category TEXT NOT NULL, amount REAL NOT NULL, description TEXT, date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contract_categories (
        id TEXT PRIMARY KEY,
        family_id INTEGER, name TEXT NOT NULL,
        is_predicted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contracts (
        id TEXT PRIMARY KEY,
        family_id INTEGER, user_id INTEGER,
        provider TEXT NOT NULL, type TEXT NOT NULL,
        start_date TEXT, end_date TEXT,
        notice_period_months INTEGER DEFAULT 0, cost REAL DEFAULT 0,
        billing_interval INTEGER DEFAULT 1, billing_day INTEGER, billing_start_month INTEGER,
        is_shared INTEGER DEFAULT 0, is_predicted INTEGER DEFAULT 0,
        split_shares TEXT, notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vault_folders (
        id TEXT PRIMARY KEY,
        family_id INTEGER, name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vault (
        id TEXT PRIMARY KEY,
        family_id INTEGER, user_id INTEGER, folder_id TEXT,
        title TEXT NOT NULL, encrypted_data TEXT NOT NULL,
        is_shared INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(folder_id) REFERENCES vault_folders(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS wishlists (
        id TEXT PRIMARY KEY,
        family_id INTEGER, user_id INTEGER,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS wishlist_items (
        id TEXT PRIMARY KEY,
        wishlist_id TEXT,
        title TEXT NOT NULL, url TEXT, price REAL, notes TEXT, image_url TEXT,
        reserved_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS vacations (
        id TEXT PRIMARY KEY,
        family_id INTEGER,
        title TEXT NOT NULL, destination TEXT, start_date TEXT, end_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    // NOTE: the old code created "vacuum_items" (typo) but used "vacation_items" → packing lists broke on fresh installs.
    `CREATE TABLE IF NOT EXISTS vacation_items (
        id TEXT PRIMARY KEY,
        vacation_id TEXT,
        title TEXT NOT NULL, category TEXT DEFAULT 'Allgemein',
        is_packed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(vacation_id) REFERENCES vacations(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS dream_destinations (
        id TEXT PRIMARY KEY,
        family_id INTEGER, user_id INTEGER,
        title TEXT NOT NULL, notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS timeline_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, user_id INTEGER,
        type TEXT DEFAULT 'post', content TEXT, media_url TEXT, poll_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS timeline_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER, user_id INTEGER, reaction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES timeline_posts(id) ON DELETE CASCADE,
        UNIQUE(post_id, user_id, reaction)
    )`,
    `CREATE TABLE IF NOT EXISTS timeline_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER, user_id INTEGER, content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES timeline_posts(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS document_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, name TEXT NOT NULL, color TEXT DEFAULT '#6366f1'
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        family_id INTEGER, user_id INTEGER, category_id INTEGER,
        title TEXT NOT NULL, filename TEXT NOT NULL, content_text TEXT,
        is_archived INTEGER DEFAULT 0, is_shared INTEGER DEFAULT 0,
        storage_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS document_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, name TEXT NOT NULL, color TEXT DEFAULT '#6366f1'
    )`,
    `CREATE TABLE IF NOT EXISTS document_tag_mapping (
        document_id TEXT, tag_id INTEGER,
        PRIMARY KEY (document_id, tag_id),
        FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY(tag_id) REFERENCES document_tags(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL, auth TEXT NOT NULL,
        user_id INTEGER, family_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS push_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER, type TEXT NOT NULL,
        title_template TEXT, body_template TEXT, icon TEXT, badge TEXT,
        UNIQUE(family_id, type)
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
];

// Columns that were added over time. Missing ones are added to existing databases.
const COLUMNS = {
    families: ['calendar_token TEXT', 'smtp_host TEXT', 'smtp_port INTEGER', 'smtp_user TEXT', 'smtp_pass TEXT', 'smtp_from TEXT'],
    users: [
        'username TEXT', 'name TEXT', 'password TEXT', 'role TEXT', 'is_admin INTEGER DEFAULT 0', 'permissions TEXT',
        'reset_code TEXT', 'reset_expires DATETIME', "language TEXT DEFAULT 'de'", "theme TEXT DEFAULT 'light'",
        'pin_code TEXT', 'two_factor_enabled INTEGER DEFAULT 0', 'two_factor_secret TEXT',
        'dashboard_widgets TEXT', 'sidebar_order TEXT', 'sidebar_hidden TEXT',
        'pocket_money_balance REAL DEFAULT 0.0', 'points_balance INTEGER DEFAULT 0',
        'mood_emoji TEXT', 'mood_text TEXT', 'last_active TEXT', 'profile_picture TEXT', 'display_role TEXT',
        "timezone TEXT DEFAULT 'Europe/Berlin'", 'time_offset INTEGER DEFAULT 0', 'token_version INTEGER DEFAULT 0',
    ],
    events: [
        'location TEXT', 'image_url TEXT', 'user_id INTEGER', 'external_uid TEXT', 'external_calendar_id INTEGER',
        'is_external INTEGER DEFAULT 0', "event_type TEXT DEFAULT 'normal'", "recurrence_pattern TEXT DEFAULT 'none'",
    ],
    external_calendars: ['user_id INTEGER', "color TEXT DEFAULT '#3788d8'"],
    items: ['list_id INTEGER', 'category TEXT'],
    messages: ['image_url TEXT', 'reactions TEXT', 'poll_data TEXT'],
    projects: ['recurring_interval TEXT', 'assigned_to TEXT'],
    project_todos: ["urgency TEXT DEFAULT 'normal'"],
    contracts: [
        'user_id INTEGER', 'billing_interval INTEGER DEFAULT 1', 'is_shared INTEGER DEFAULT 0', 'is_predicted INTEGER DEFAULT 0',
        'split_shares TEXT', 'billing_day INTEGER', 'billing_start_month INTEGER',
    ],
    documents: ['storage_path TEXT', 'is_shared INTEGER DEFAULT 0', 'content_text TEXT', 'is_archived INTEGER DEFAULT 0'],
    vault: ['folder_id TEXT', 'is_shared INTEGER DEFAULT 0', 'user_id INTEGER'],
    recipes: ['folder_id TEXT'],
    chores: ["is_recurring INTEGER DEFAULT 0", "recurring_interval TEXT DEFAULT 'daily'"],
    contacts: ['is_favorite INTEGER DEFAULT 0'],
    wishlist_items: ['image_url TEXT'],
    subscriptions: ['family_id INTEGER', 'created_at DATETIME'],
};

const INDEXES = [
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_families_calendar_token ON families(calendar_token)',
    'CREATE INDEX IF NOT EXISTS idx_users_family ON users(family_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_family ON events(family_id)',
    'CREATE INDEX IF NOT EXISTS idx_items_family_list ON items(family_id, list_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_family_created ON messages(family_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_photos_album ON photos(album_id)',
    'CREATE INDEX IF NOT EXISTS idx_photos_filename ON photos(filename)',
    'CREATE INDEX IF NOT EXISTS idx_meals_family_date ON meals(family_id, date)',
    'CREATE INDEX IF NOT EXISTS idx_documents_family ON documents(family_id, is_archived)',
    'CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename)',
    'CREATE INDEX IF NOT EXISTS idx_timeline_family ON timeline_posts(family_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_chore_completions_chore ON chore_completions(chore_id, completed_at)',
    'CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id)',
];

const ensureColumn = async (table, definition) => {
    const column = definition.split(/\s+/)[0];
    if (await db.hasColumn(table, column)) return false;
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    db.refreshColumns(table);
    console.log(`[migrate] ${table}.${column} hinzugefügt`);
    return true;
};

const tableExists = async (name) => !!(await db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]));

const migrate = async () => {
    for (const sql of TABLES) await db.exec(sql);

    for (const [table, defs] of Object.entries(COLUMNS)) {
        for (const def of defs) await ensureColumn(table, def);
    }

    // --- Data back-fills for databases created by very old versions -------------
    const userCols = await db.columns('users');
    if (userCols.has('name')) {
        await db.run("UPDATE users SET username = name WHERE (username IS NULL OR username = '') AND name IS NOT NULL");
        await db.run("UPDATE users SET name = username WHERE (name IS NULL OR name = '') AND username IS NOT NULL");
    }
    if (userCols.has('password_hash')) {
        await db.run("UPDATE users SET password = password_hash WHERE (password IS NULL OR password = '') AND password_hash IS NOT NULL");
    }
    // Role consistency: the old code mixed "role" and "is_admin".
    await db.run("UPDATE users SET role = 'admin' WHERE (role IS NULL OR role = '') AND is_admin = 1");
    await db.run("UPDATE users SET role = 'member' WHERE role IS NULL OR role = ''");
    await db.run("UPDATE users SET is_admin = CASE WHEN role = 'admin' THEN 1 ELSE 0 END");

    // Packing list items that ended up in the misspelled table are moved over once.
    if (await tableExists('vacuum_items')) {
        await db.run(`INSERT OR IGNORE INTO vacation_items (id, vacation_id, title, category, is_packed, created_at)
                      SELECT id, vacation_id, title, category, is_packed, created_at FROM vacuum_items`);
    }

    for (const sql of INDEXES) {
        try { await db.exec(sql); } catch (err) { console.warn(`[migrate] Index übersprungen: ${err.message}`); }
    }

    await db.exec('PRAGMA user_version = 2');
};

module.exports = { migrate };
