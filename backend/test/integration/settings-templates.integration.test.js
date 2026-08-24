const assert = require('node:assert/strict');
const test = require('node:test');

test('settings, templates, feature persistence, and Admin RBAC work against PostgreSQL', { skip: process.env.RUN_INTEGRATION !== '1' }, async (context) => {
  const bcrypt = require('bcryptjs'); const jwt = require('jsonwebtoken');
  const env = require('../../src/config/env'); const pool = require('../../src/config/db'); const startServer = require('../../src/server');
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  const passwordHash = await bcrypt.hash('OriginalPass123', 4); const users = {};
  for (const name of ['admin','member']) users[name]=(await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id',[name,`${name}@settings.test`,passwordHash])).rows[0].id;
  await pool.query("UPDATE users SET account_role = 'admin' WHERE id = $1", [users.admin]);
  const bootstrap=(await pool.query("INSERT INTO projects(key,name,created_by) VALUES('BOOT','Bootstrap',$1) RETURNING id",[users.admin])).rows[0].id;
  await pool.query("INSERT INTO project_members(project_id,user_id,project_role) VALUES($1,$2,'admin')",[bootstrap,users.admin]);
  const token=(name)=>jwt.sign({sub:String(users[name])},env.jwtSecret,{algorithm:'HS256',expiresIn:'1h'});
  const server=startServer(0); await new Promise((resolve)=>server.once('listening',resolve));
  context.after(async()=>{await new Promise((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));await pool.end();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const request=(name,path,{method='GET',body}={})=>fetch(`${base}${path}`,{method,headers:{cookie:`token=${token(name)}`,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});

  const templates=await request('member','/settings/templates'); assert.equal(templates.status,200); assert.deepEqual((await templates.json()).templates.map((item)=>item.key),['kanban','scrum','work_requests','business','personal']);
  const defaults=await request('member','/settings/me'); assert.equal(defaults.status,200); assert.equal((await defaults.json()).preferences.locale,'en');
  const preferenceUpdate=await request('member','/settings/me',{method:'PATCH',body:{locale:'vi',timeZone:'Asia/Saigon',emailNotifications:false,inAppNotifications:true}}); assert.equal(preferenceUpdate.status,200); assert.equal((await preferenceUpdate.json()).preferences.time_zone,'Asia/Saigon');
  assert.equal((await request('member','/settings/system')).status,403);
  const systemUpdate=await request('admin','/settings/system',{method:'PATCH',body:{instanceName:'Taskflow Test',enabledApps:['timeline','docs']}}); assert.equal(systemUpdate.status,200); assert.deepEqual((await systemUpdate.json()).system.enabled_apps,['timeline','docs']);
  assert.equal((await request('admin','/projects',{method:'POST',body:{key:'DISABLED',name:'Disabled App',templateKey:'kanban',enabledFeatures:['forms']}})).status,400);

  const created=await request('admin','/projects',{method:'POST',body:{key:'SPRINT',name:'Sprint Space',templateKey:'scrum',enabledFeatures:['backlog','timeline'],viewerIds:[users.member]}}); assert.equal(created.status,201); const project=(await created.json()).project;
  assert.equal(project.template_key,'scrum'); assert.deepEqual(project.enabled_features,['summary','backlog','board','timeline']);
  const seeded=await pool.query(`SELECT (SELECT array_agg(name ORDER BY name) FROM issue_types WHERE project_id=$1) types,
    (SELECT count(*)::int FROM workflow_statuses WHERE project_id=$1) statuses,
    (SELECT count(*)::int FROM workflow_statuses WHERE project_id=$1 AND is_default) defaults,
    (SELECT count(*)::int FROM workflow_statuses WHERE project_id=$1 AND is_final) finals`,[project.id]);
  assert.deepEqual(seeded.rows[0],{types:['Bug','Epic','Story','Task'],statuses:4,defaults:1,finals:1});
  assert.equal((await request('member',`/projects/${project.id}`,{method:'PATCH',body:{enabledFeatures:['docs']}})).status,403);

  const rejected=await request('member','/settings/me/password',{method:'PATCH',body:{currentPassword:'WrongCurrentPass123',newPassword:'ChangedPass123'}}); assert.equal(rejected.status,400);
  const unchangedLogin=await fetch(`${base}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'member@settings.test',password:'OriginalPass123'})}); assert.equal(unchangedLogin.status,200);
  const changed=await request('member','/settings/me/password',{method:'PATCH',body:{currentPassword:'OriginalPass123',newPassword:'ChangedPass123'}}); assert.equal(changed.status,204);
  const oldLogin=await fetch(`${base}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'member@settings.test',password:'OriginalPass123'})}); assert.equal(oldLogin.status,401);
  const newLogin=await fetch(`${base}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'member@settings.test',password:'ChangedPass123'})}); assert.equal(newLogin.status,200);
});
