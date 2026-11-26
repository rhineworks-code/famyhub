'use strict';

const sqlite3 = require('sqlite3');
const config = require('../config');

/**
 * Thin promise wrapper around a single sqlite3 connection.
 * All route code uses async/await on top of this – no callback pyramids.
 */
class Database {
    constructor(file) {
        this.file = file;
        this.raw = null;
        this._columns = new Map();
        this._txQueue = Promise.resolve();
    }

    open() {
        return new Promise((resolve, reject) => {
            this.raw = new sqlite3.Database(this.file, (err) => {
                if (err) return reject(err);
                resolve();
            });
        }).then(async () => {
            await this.exec('PRAGMA foreign_keys = ON;');
            await this.exec('PRAGMA journal_mode = WAL;');
            await this.exec('PRAGMA busy_timeout = 5000;');
            await this.exec('PRAGMA synchronous = NORMAL;');
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (!this.raw) return resolve();
            this.raw.close((err) => (err ? reject(err) : resolve()));
            this.raw = null;
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            this.raw.exec(sql, (err) => (err ? reject(err) : resolve()));
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.raw.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.raw.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.raw.run(sql, params, function onRun(err) {
                if (err) return reject(err);
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Runs `fn` inside BEGIN/COMMIT. Transactions are queued so that two
     * concurrent requests never try to open nested transactions on the
     * shared connection.
     */
    transaction(fn) {
        const job = this._txQueue.then(async () => {
            await this.exec('BEGIN IMMEDIATE');
            try {
                const result = await fn(this);
                await this.exec('COMMIT');
                return result;
            } catch (err) {
                try { await this.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
                throw err;
            }
        });
        // Keep the queue alive even if a job fails.
        this._txQueue = job.catch(() => {});
        return job;
    }

    /** Column names of a table (cached; call refreshColumns after ALTER TABLE). */
    async columns(table) {
        if (!this._columns.has(table)) {
            const rows = await this.all(`PRAGMA table_info(${table})`);
            this._columns.set(table, new Map(rows.map(r => [r.name, r])));
        }
        return this._columns.get(table);
    }

    async hasColumn(table, column) {
        return (await this.columns(table)).has(column);
    }

    refreshColumns(table) {
        if (table) this._columns.delete(table);
        else this._columns.clear();
    }
}

const db = new Database(config.dbPath);

/** Builds "?, ?, ?" for IN clauses. */
db.placeholders = (arr) => arr.map(() => '?').join(', ');

module.exports = db;
