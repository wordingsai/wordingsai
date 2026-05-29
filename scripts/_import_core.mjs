import pg from 'pg';
import fs from 'fs';
import os from 'os';
import path from 'path';

const conn = fs.readFileSync('D:/Richard/wordingsai-secrets.md','utf8').match(/DATABASE_URL=(postgresql:\/\/[^\s`]+)/)[1];
const ORG = 'c7BkNsHuGpIKHyEcrmgbySSP76uExuwf';
const REINS_WS = '84e54a3d-3bbe-40b7-aab1-7b0f40e2be7d';
const core = JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'core.json'),'utf8'));
console.log('Loaded', core.length, 'core clauses from JSON');

const c = new pg.Client({ connectionString: conn, ssl:{rejectUnauthorized:false} });
await c.connect();
try {
  await c.query('BEGIN');
  // 1. Wipe current global set (CASCADE cleans workspace_clauses, clause_versions, clause_chunks)
  const del = await c.query('DELETE FROM clauses WHERE is_global=true');
  console.log('Deleted global clauses:', del.rowCount);
  // 2. Insert clean core, link to Reinsurance workspace
  let inserted = 0;
  for (const r of core) {
    const ins = await c.query(
      `INSERT INTO clauses (organization_id,is_global,clause_name,clause_category,clause_text,library,status,approval_status,code,workspace_id,owner_user_id)
       VALUES ($1,true,$2,$3,$4,'Core','Approved','Approved',$5,NULL,NULL) RETURNING id`,
      [ORG, r.name, r.category, r.clauseText, r.code || null]
    );
    await c.query('INSERT INTO workspace_clauses (workspace_id,clause_id) VALUES ($1,$2)', [REINS_WS, ins.rows[0].id]);
    inserted++;
  }
  console.log('Inserted core clauses + workspace links:', inserted);
  await c.query('COMMIT');
  // verify
  const v = await c.query("SELECT count(*)::int n FROM clauses WHERE is_global=true");
  const vc = await c.query("SELECT count(*)::int n FROM clauses WHERE is_global=true AND code IS NOT NULL AND code<>''");
  const vl = await c.query("SELECT count(*)::int n FROM workspace_clauses WHERE workspace_id=$1",[REINS_WS]);
  const lib = await c.query("SELECT library, count(*)::int n FROM clauses WHERE is_global=true GROUP BY library");
  console.log('\nVERIFY -> global clauses:', v.rows[0].n, '| with code:', vc.rows[0].n, '| reinsurance links:', vl.rows[0].n);
  console.log('libraries:', lib.rows.map(r=>`${r.library}:${r.n}`).join(', '));
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ROLLED BACK:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
