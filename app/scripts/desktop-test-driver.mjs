import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export async function openDesktop(exe, root) {
  assert.ok(fs.existsSync(exe), 'Missing desktop exe: ' + exe);
  const port = await new Promise(resolve => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => { const port=server.address().port; server.close(()=>resolve(port)); });
  });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qldapm-portal-test-'));
  const env = { ...process.env, QLDAPM_PROJECT_ROOT: root };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(exe, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile], {
    cwd: root, env, stdio: 'ignore', windowsHide: false
  });
  let startError;
  child.once('error', error => { startError=error; });
  let page, socket;
  const pending = new Map(), errors = [];
  let nextId=0;
  const call=(method, params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},20000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const wait=async(expression,timeout=25000)=>{
    const deadline=Date.now()+timeout;
    while(Date.now()<deadline){if(await evaluate(expression))return;await delay(150);}
    throw new Error('Timed out: '+expression+'\n'+await evaluate('document.body.innerText'));
  };
  const close=async()=>{
    if(socket?.readyState===WebSocket.OPEN){
      try{socket.send(JSON.stringify({id:++nextId,method:'Browser.close'}));await delay(400);}catch{}socket.close();
    }
    for(let i=0;i<80&&child.exitCode===null&&!startError;i++)await delay(100);
    if(child.pid&&child.exitCode===null)await new Promise(resolve=>{
      const killer=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
      killer.once('exit',resolve);killer.once('error',resolve);
    });
  };
  try{
    const deadline=Date.now()+60000;
    while(Date.now()<deadline){
      if(startError)throw startError;
      try{
        const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(1000)})).json();
        page=pages.find(row=>row.type==='page'&&row.url.startsWith('http://127.0.0.1:'));
        if(page)break;
      }catch{}
      await delay(250);
    }
    assert.ok(page,'Desktop did not expose frontend: '+exe);
    socket=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.id){
        const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);
        if(message.error)item.reject(new Error(JSON.stringify(message.error)));else item.resolve(message.result);
      }else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
    });
    await call('Runtime.enable');
    await wait("Boolean(document.querySelector('.login-submit'))");
    return {
      evaluate, wait, close, errors,
      focus: () => call('Page.bringToFront'),
      fill: fields=>evaluate('('+function(fields){
        for(const [name,value]of Object.entries(fields)){
          const element=document.querySelector('[name="'+name+'"]');
          if(!element)throw new Error('Missing field: '+name);
          const prototype=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,String(value));
          element.dispatchEvent(new Event('input',{bubbles:true}));
          element.dispatchEvent(new Event('change',{bubbles:true}));
        }
      }.toString()+')('+JSON.stringify(fields)+')'),
      click: (text,scope='document')=>evaluate('Array.from('+scope+'.querySelectorAll("button")).find(x=>x.textContent.trim()==='+JSON.stringify(text)+')?.click()'),
      navigate: async route=>{
        await evaluate('document.querySelector('+JSON.stringify('a[href="'+route+'"]')+').click()');
        await wait('location.pathname==='+JSON.stringify(route)+'&&!document.querySelector(".loading")');
      },
      api: (route,method='GET',body)=>evaluate('('+async function(route,method,body){
        const mode=window.desktopApp.mode;
        const response=await fetch('/api'+route,{
          method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('ims-'+mode+'-token')},
          body:body===undefined?undefined:JSON.stringify(body)
        });
        const data=await response.json();
        if(!response.ok)throw new Error(JSON.stringify(data));return data;
      }.toString()+')('+JSON.stringify(route)+','+JSON.stringify(method)+','+(body===undefined?'undefined':JSON.stringify(body))+')')
    };
  }catch(error){await close();throw error;}
}
