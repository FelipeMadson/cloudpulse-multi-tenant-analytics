import test from 'node:test';
import assert from 'node:assert/strict';
import {SaasPlatformServer} from '../src/server.ts';

test('HTTP startup returns the actual ephemeral TCP port',async()=>{
  const server=new SaasPlatformServer();
  try{
    const port=await server.listen(0);
    assert.ok(port>0,'listen(0) must return the operating system assigned port');
    const response=await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status,200);
  }finally{await server.close();}
});

test('HTTP workflow refuses unconfigured deployment and webhook simulations never mark delivery',async()=>{
  const server=new SaasPlatformServer();
  try{
    await server.listen(44592);
    server.tenantManager.registerTenant({id:'delivery-check',name:'Delivery check'});
    const token=server.authManager.provisionKey('delivery-check','admin').token;
    const response=await fetch('http://127.0.0.1:44592/api/v1/workflows/run',{method:'POST',headers:{authorization:`Bearer ${token}`}});
    assert.equal(response.status,501);
    const result=await response.json();
    assert.equal(result.success,false);
    assert.equal(result.code,'WORKFLOW_EXECUTOR_NOT_CONFIGURED');
    assert.equal(result.execution,undefined);
    const event=server.webhooks.enqueue('delivery-check','resource.created',{id:'one'},'https://example.invalid/webhook','local-only-secret');
    const preview=await server.webhooks.processQueueSimulated();
    assert.equal(preview.simulation,true);
    assert.equal(event.status,'pending');
    assert.equal(event.attempts,0);
    assert.deepEqual(server.webhooks.listDelivered('delivery-check'),[]);
  }finally{await server.close();}
});

test('HTTP tenant catalog and resource reads stay inside authenticated tenant',async()=>{
  const server=new SaasPlatformServer();
  try{
    await server.listen(44591);
    const base='http://127.0.0.1:44591';
    for(const id of ['isolation-a','isolation-b'])server.tenantManager.registerTenant({id,name:id});
    const a=server.authManager.provisionKey('isolation-a','admin').token;
    const b=server.authManager.provisionKey('isolation-b','admin').token;
    assert.equal((await fetch(base+'/api/v1/tenants')).status,401);
    const catalog=await fetch(base+'/api/v1/tenants',{headers:{authorization:`Bearer ${a}`}});
    assert.equal(catalog.status,200);
    assert.deepEqual((await catalog.json()).tenants.map((tenant:{id:string})=>tenant.id),['isolation-a']);
    const created=await fetch(base+'/api/v1/resources',{method:'POST',headers:{authorization:`Bearer ${a}`,'content-type':'application/json'},body:JSON.stringify({id:'isolation-resource',title:'Private resource'})});
    assert.equal(created.status,201);
    const mine=await fetch(base+'/api/v1/resources',{headers:{authorization:`Bearer ${a}`}});
    assert.ok((await mine.json()).resources.some((resource:{id:string})=>resource.id==='isolation-resource'));
    const other=await fetch(base+'/api/v1/resources',{headers:{authorization:`Bearer ${b}`}});
    assert.equal((await other.json()).resources.length,0);
  }finally{await server.close();}
});
