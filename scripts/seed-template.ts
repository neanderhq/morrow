import { Client } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { makePdf } from './fixtures/resume.mjs';

const password = process.env.DEMO_PASSWORD;
if (!process.env.DATABASE_URL || !password || password.length < 12 || password.length > 128) throw new Error('DATABASE_URL and generated DEMO_PASSWORD (12–128 characters) are required');
const db = new Client({ connectionString: process.env.DATABASE_URL });
const workspace = 'a1000000-0000-4000-8000-000000000001';
const staff = [
  ['morrow-demo-admin', 'Avery Morgan', 'admin@morrow.test', 'admin'],
  ['morrow-demo-recruiter', 'Jordan Lee', 'recruiter@morrow.test', 'recruiter'],
  ['morrow-demo-manager', 'Taylor Reed', 'manager@morrow.test', 'hiring_manager'],
  ['morrow-demo-interviewer', 'Casey Brooks', 'interviewer@morrow.test', 'interviewer'],
];
await db.connect();
try {
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('recruiting_workspace_bootstrap'))");
  const existing = await db.query("SELECT id FROM workspace WHERE singleton_key='primary'");
  if (existing.rowCount) {
    await db.query('COMMIT');
    console.log('Existing workspace preserved; no accounts, passwords or recruiting records changed.');
  } else {
    const hashed = await hashPassword(password);
    await db.query('INSERT INTO workspace (id,name) VALUES ($1,$2)', [workspace,'Morrow Demo']);
    for (const [id,name,email,role] of staff) {
      await db.query('INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)', [id,name,email]);
      await db.query("INSERT INTO account (id,account_id,provider_id,user_id,password,updated_at) VALUES ($1,$2,'credential',$2,$3,now())", [`${id}-credential`,id,hashed]);
      await db.query('INSERT INTO workspace_member (workspace_id,user_id,role) VALUES ($1,$2,$3)', [workspace,id,role]);
    }
    const jobs = [
      ['b1000000-0000-4000-8000-000000000001','Senior Product Engineer','Engineering','Remote','published','Build thoughtful tools with a small, collaborative product team. Work across the stack, learn from customers and help shape our engineering practices.'],
      ['b1000000-0000-4000-8000-000000000002','Product Designer','Design','Hybrid','published','Turn customer research into clear product experiences. Partner with engineering from early sketches through the finished interface.'],
      ['b1000000-0000-4000-8000-000000000003','Customer Success Lead','Customer Experience','Remote','draft','Help customers get value from our product and turn their feedback into a better experience.'],
    ];
    for (const [id,title,department,location,state,description] of jobs) {
      await db.query(`INSERT INTO job (id,workspace_id,title,department,location,employment_type,remote,description,hiring_manager_id,state,created_by) VALUES ($1,$2,$3,$4,$5,'full_time',true,$6,'morrow-demo-manager',$7,'morrow-demo-admin')`, [id,workspace,title,department,location,description,state]);
      await db.query('INSERT INTO job_assignment (workspace_id,job_id,user_id,assigned_by) VALUES ($1,$2,$3,$4)', [workspace,id,'morrow-demo-manager','morrow-demo-admin']);
      await db.query('INSERT INTO job_assignment (workspace_id,job_id,user_id,assigned_by) VALUES ($1,$2,$3,$4)', [workspace,id,'morrow-demo-interviewer','morrow-demo-admin']);
    }
    const candidates = [
      ['c1000000-0000-4000-8000-000000000001','Alex Rivera','alex@candidate.test'],
      ['c1000000-0000-4000-8000-000000000002','Sam Parker','sam@candidate.test'],
      ['c1000000-0000-4000-8000-000000000003','Jamie Chen','jamie@candidate.test'],
      ['c1000000-0000-4000-8000-000000000004','Morgan Blake','morgan@candidate.test'],
    ];
    for (const [id,name,email] of candidates) await db.query('INSERT INTO candidate (id,workspace_id,name,email) VALUES ($1,$2,$3,$4)', [id,workspace,name,email]);
    const fixtures = [[0,0,'screening'],[1,0,'interview'],[2,1,'applied'],[3,1,'offer'],[0,1,'applied']] as const;
    for (const [index,[candidateIndex,jobIndex,stage]] of fixtures.entries()) {
      const application = `d1000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
      const [candidateId,name,email] = candidates[candidateIndex];
      await db.query(`INSERT INTO application (id,workspace_id,job_id,candidate_id,applicant_name,applicant_email,resume_data,resume_name,resume_type,stage,cover_note) VALUES ($1,$2,$3,$4,$5,$6,$7,'fictional-resume.pdf','pdf',$8,$9)`, [application,workspace,jobs[jobIndex][0],candidateId,name,email,makePdf(),stage,'Fictional candidate used to explore the recruiting workspace.']);
      await db.query("INSERT INTO application_stage_history (workspace_id,application_id,from_stage,to_stage,actor_user_id) VALUES ($1,$2,null,'applied',null)", [workspace,application]);
      if (stage !== 'applied') await db.query("INSERT INTO application_stage_history (workspace_id,application_id,from_stage,to_stage,actor_user_id) VALUES ($1,$2,'applied',$3,'morrow-demo-recruiter')", [workspace,application,stage]);
      await db.query(`INSERT INTO application_note (workspace_id,application_id,author_user_id,body) VALUES ($1,$2,'morrow-demo-recruiter',$3)`, [workspace,application,'Sample review note: discuss this fictional candidate at the next hiring sync.']);
      await db.query(`INSERT INTO audit_event (workspace_id,actor_user_id,action,entity_type,entity_id,details) VALUES ($1,'morrow-demo-admin','application.received','application',$2,$3)`, [workspace,application,JSON.stringify({jobId:jobs[jobIndex][0],jobTitle:jobs[jobIndex][1],applicantName:name,applicantEmail:email})]);
    }
    await db.query('COMMIT');
    console.log('Seeded Morrow Demo: four staff roles, three jobs, four fictional candidates and five applications. Use your generated DEMO_PASSWORD; no email was sent.');
  }
} catch (error) { await db.query('ROLLBACK'); throw error; }
finally { await db.end(); }
