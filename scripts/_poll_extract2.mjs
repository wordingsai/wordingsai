import pg from 'pg'; import fs from 'fs';
const conn = fs.readFileSync('D:/Richard/wordingsai-secrets.md','utf8').match(/DATABASE_URL=(postgresql:\/\/[^\s`]+)/)[1];
const CID='0f98c63a-2ea1-43e5-8f46-34d360826a16';
const c = new pg.Client({ connectionString: conn, ssl:{rejectUnauthorized:false} }); await c.connect();
const q = async s => (await c.query(s)).rows;
for (let i=0;i<40;i++){
  const r = (await q(`SELECT analysis_progress p, contract_status st, left(file_content,500) fc, length(file_content) len FROM contracts WHERE id='${CID}'`))[0];
  const fc = r.fc;
  if (fc && fc.length > 50) {
    const plural = /--- PAGES \d+-\d+ ---/.test(fc);
    const singular = /--- PAGE \d+ ---/.test(fc) && !plural;
    console.log(`[${i}] prog:${r.p} len:${r.len} extractor:${singular?'PDFPLUMBER':plural?'GEMINI':'?'}`);
    console.log('first 400 chars:\n', fc.slice(0,400));
    console.log('\n=== RESULT:', singular?'pdfplumber ran (--- PAGE N ---)':plural?'Gemini ran (--- PAGES X-Y ---)':'unknown format', '===');
    break;
  }
  console.log(`[${i}] prog:${r.p} status:${r.st} fileContent: still null (extracting...)`);
  await new Promise(res=>setTimeout(res,15000));
}
await c.end();
