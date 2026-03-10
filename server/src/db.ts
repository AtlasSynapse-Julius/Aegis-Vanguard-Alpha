/**
 * PostgreSQL client and migrations.
 * Copyright (c) Atlas Synapse.
 */

import { Pool, PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows as T;
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        vulnerabilities_count INTEGER NOT NULL DEFAULT 0,
        critical_count INTEGER NOT NULL DEFAULT 0,
        risk_score NUMERIC(5,2),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS vulnerabilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        score NUMERIC(5,2),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS discovered_endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan_id ON vulnerabilities(scan_id)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_discovered_endpoints_scan_id ON discovered_endpoints(scan_id)`
    );
    try {
      await client.query(`ALTER TABLE scans ADD COLUMN critical_count INTEGER NOT NULL DEFAULT 0`);
    } catch (e: any) {
      if (!e.message?.includes("already exists")) throw e;
    }
    try {
      await client.query(`ALTER TABLE scans ADD COLUMN lead_status TEXT NOT NULL DEFAULT 'New'`);
    } catch (e: any) {
      if (!e.message?.includes("already exists")) throw e;
    }
  } finally {
    client.release();
  }
}

export default pool;
