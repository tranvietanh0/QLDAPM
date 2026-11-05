import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { openDesktop } from './desktop-test-driver.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const adminEmail=process.env.TEST_ADMIN_EMAIL||'admin@gmail.com';
const adminPassword=process.env.TEST_ADMIN_PASSWORD||'123456';
const email='desktop.test.'+Date.now()+'@test.vn';
const name='Desktop test '+Date.now();
const password='DesktopTest123';
const year=new Date().getFullYear();
const deadline=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
let admin,intern,profileId,ownsBackend=false;
try{
  try{await fetch('http://127.0.0.1:8081/api/health',{signal:AbortSignal.timeout(1000)});}catch{ownsBackend=true;}
  admin=await openDesktop(process.env.SERVER_TEST_EXE||path.join(root,'dist-server','QLDAPM-Server.exe'),root);
  assert.equal(await admin.evaluate('window.desktopApp.mode'),'admin');
  await admin.wait('!document.querySelector(".login-submit").disabled',160000);
  await admin.fill({email:adminEmail,password:adminPassword});
  await admin.click('Đăng nhập');
  await admin.wait('Boolean(document.querySelector(".shell"))');
  await admin.navigate('/interns');
  await admin.click('Tạo tài khoản thực tập sinh');
  await admin.wait('Boolean(document.querySelector("[role=dialog]"))');
  const metadata=await admin.evaluate('({departmentId:document.querySelector("[name=departmentId] option:nth-child(2)").value,mentorId:document.querySelector("[name=mentorId] option:nth-child(2)").value})');
  await admin.fill({name,email,password,...metadata,startDate:year+'-01-01',endDate:(year+1)+'-12-31'});
  await admin.evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
  await admin.wait('!document.querySelector("[role=dialog]")&&document.body.innerText.includes('+JSON.stringify(email)+')');
  profileId=(await admin.api('/interns')).find(row=>row.user.email===email)?.id;
  assert.ok(profileId,'Admin UI did not create intern account');
  await admin.navigate('/tasks');
  await admin.click('Giao công việc');
  await admin.wait('Boolean(document.querySelector("[role=dialog]"))');
  await admin.fill({internId:profileId,title:name,description:'Desktop test assigned by Admin',priority:'HIGH',deadline});
  await admin.evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
  await admin.wait('!document.querySelector("[role=dialog]")&&document.body.innerText.includes('+JSON.stringify(name)+')');
  intern=await openDesktop(process.env.CLIENT_TEST_EXE||path.join(root,'dist-electron','QLDAPM-Client.exe'),root);
  assert.equal(await intern.evaluate('window.desktopApp.mode'),'intern');
  assert.equal(await intern.evaluate('document.querySelector("[name=email]").value'),'');
  await intern.wait('!document.querySelector(".login-submit").disabled');
  await intern.fill({email:adminEmail,password:adminPassword});
  await intern.click('Đăng nhập');
  await intern.wait('Boolean(document.querySelector(".notice-error"))');
  assert.equal(await intern.evaluate('Boolean(document.querySelector(".shell"))'),false,'Admin must not log into intern app');
  await intern.fill({email,password});await intern.click('Đăng nhập');
  await intern.wait('Boolean(document.querySelector(".shell"))');
  assert.equal(await intern.evaluate('Boolean(document.querySelector('+JSON.stringify('a[href="/administration"]')+'))'),false);
  await intern.navigate('/tasks');
  assert.equal((await intern.api('/tasks')).length,1,'Intern must only see own task');
  assert.equal(await intern.evaluate('Array.from(document.querySelectorAll("button")).some(x=>x.textContent.trim()==="Giao công việc")'),false);
  await intern.click('Bắt đầu');await intern.wait('Boolean(document.querySelector("[role=dialog]"))');
  await intern.fill({completionNote:'Started from Client'});
  await intern.evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
  await intern.wait('!document.querySelector("[role=dialog]")&&document.body.innerText.includes("Started from Client")');
  await intern.click('Hoàn thành');await intern.wait('Boolean(document.querySelector("[role=dialog]"))');
  await intern.fill({completionNote:'Completed from Client'});
  await intern.evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
  await intern.wait('!document.querySelector("[role=dialog]")&&document.body.innerText.includes("Completed from Client")');
  await intern.navigate('/reports');await intern.click('Nộp báo cáo');
  await intern.wait('Boolean(document.querySelector("[role=dialog]"))');
  await intern.fill({weekNumber:44,completedWork:name,learned:'Java and React',problems:'None',planNextWeek:'Next assignment'});
  await intern.evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
  await intern.wait('!document.querySelector("[role=dialog]")&&document.body.innerText.includes('+JSON.stringify(name)+')');
  await admin.navigate('/reports');
  await admin.wait('document.body.innerText.includes('+JSON.stringify(name)+')');
  await admin.evaluate('Array.from(document.querySelectorAll("tbody tr")).find(x=>x.innerText.includes('+JSON.stringify(name)+')).querySelector("button.btn").click()');
  await admin.wait('Boolean(document.querySelector("[role=dialog]"))');
  await admin.fill({rating:9,mentorComment:'Admin reviewed from Server'});
  await admin.evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
  await admin.wait('!document.querySelector("[role=dialog]")');
  await intern.focus();
  await intern.wait('Boolean(document.querySelector(".pill-REVIEWED"))',25000);
  await intern.evaluate('document.querySelector("button[title^=Xem]").click()');
  await intern.wait('document.body.innerText.includes("Admin reviewed from Server")');
  assert.equal((await intern.api('/dashboard/statistics')).reports,1);
  assert.equal(admin.errors.length+intern.errors.length,0,JSON.stringify([...admin.errors,...intern.errors]));
  console.log('PASS: Admin exe creates account and assigns work; Client exe logs in, completes task and submits report; Admin reviews; Client sees feedback.');
  console.log('PASS: Portal role guard, scoped data, MySQL proxy and automatic refresh; no renderer exceptions.');
}finally{
  if(profileId&&admin){try{await admin.api('/interns/'+profileId,'DELETE');}catch(error){console.error('Temporary account cleanup failed: '+error.message);process.exitCode=1;}}
  if(intern)await intern.close();
  if(admin)await admin.close();
  if(ownsBackend){
    for(let i=0;i<30;i++){
      try{await fetch('http://127.0.0.1:8081/api/health',{signal:AbortSignal.timeout(500)});await delay(200);}
      catch{console.log('PASS: Closing Admin stops its owned backend.');break;}
      if(i===29)throw new Error('Admin left its backend running after closing');
    }
  }
}
