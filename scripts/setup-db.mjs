/**
 * ServiceTrack — Database Setup Script
 * Executes SUPABASE_SCHEMA.sql against the Supabase project via Management API
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const PROJECT_REF = 'avjzbefjpzyjragtsmth'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2anpiZWZqcHp5anJhZ3RzbXRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMzMzIzNywiZXhwIjoyMDg5OTA5MjM3fQ.cVh81hmIpnpymNqkvF6AzFbaGaiwXYRTC-UVa5LofPo'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`

async function execSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ sql_query: sql }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json().catch(() => null)
}

// Split SQL into individual statements, skipping empty ones
function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
}

async function main() {
  console.log('🚀 ServiceTrack — Database Setup\n')

  // Step 1: Read schema
  const schemaPath = join(ROOT, 'SUPABASE_SCHEMA.sql')
  let schema
  try {
    schema = readFileSync(schemaPath, 'utf-8')
    console.log(`✅ Schema loaded (${schema.split('\n').length} lines)`)
  } catch {
    console.error('❌ SUPABASE_SCHEMA.sql not found')
    process.exit(1)
  }

  // Step 2: First create the exec_sql helper function so we can run DDL
  console.log('\n📦 Creating SQL execution helper...')
  const createHelper = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `

  // Try using the pg REST endpoint directly for DDL
  const setupRes = await fetch(`${SUPABASE_URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: createHelper }),
  })

  console.log(`Helper endpoint status: ${setupRes.status}`)

  if (setupRes.status === 404) {
    // Try Management API
    console.log('Trying Management API...')
    const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: schema }),
    })
    console.log(`Management API status: ${mgmtRes.status}`)
    const mgmtBody = await mgmtRes.text()
    console.log(`Response: ${mgmtBody.slice(0, 300)}`)
  }

  console.log('\n✅ Setup script complete. Check Supabase dashboard to verify tables.')
}

main().catch(console.error)
