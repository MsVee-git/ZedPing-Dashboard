import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadRequest } from '../src/lib/uploadRequest.js';
test('100% transfer waits for saved response and reports progress', async()=>{
  let xhr;
  const previous=globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest=class {
    constructor(){xhr=this;this.upload={};this.headers={};}
    open(method,url){this.method=method;this.url=url;}
    setRequestHeader(key,value){this.headers[key]=value;}
    send(body){this.body=body;}
  };
  try {
    const progress=[];let done=false;
    const pending=uploadRequest('/content',{method:'POST',body:'file',headers:{Authorization:'Bearer token'},onUploadProgress:p=>progress.push(p)}).then(r=>{done=true;return r;});
    xhr.upload.onprogress({lengthComputable:true,loaded:10,total:10});
    await Promise.resolve();assert.equal(done,false);assert.deepEqual(progress,[100]);
    xhr.status=201;xhr.responseText='{"item":{"id":"saved"}}';xhr.onload();
    assert.equal((await (await pending).json()).item.id,'saved');
    assert.equal(xhr.headers.authorization,'Bearer token');
  } finally {globalThis.XMLHttpRequest=previous;}
});
