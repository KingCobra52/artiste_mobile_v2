import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for (const name of (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
    try { await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8')); }
    catch (error) { throw new Error(`Migration ${name}: ${error.message}`); }
  }
  await db.exec(await readFile('supabase/seed.sql','utf8'));
  for (const name of (await readdir('supabase/tests')).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/tests/${name}`,'utf8'));
    console.log(`PASS ${name}`);
  }
  console.log('All migrations replayed and PostgreSQL transaction checks passed.');
} finally { await db.close(); }
