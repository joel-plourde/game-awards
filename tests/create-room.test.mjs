import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const run=(...args)=>JSON.parse(execFileSync(process.execPath,['scripts/create-room.mjs','--site','https://example.github.io/party/bingo/','--json',...args],{encoding:'utf8'}));
test('room generator creates independent short and long invites but only hashes enter SQL',()=>{
  const result=run('--name',"Friends' night",'--sample');
  const short=new URLSearchParams(new URL(result.inviteUrl).hash.slice(1)).get('invite');
  const long=new URLSearchParams(new URL(result.longInviteUrl).hash.slice(1)).get('invite');
  assert.match(short,/^[A-Za-z0-9_-]{22}$/);assert.match(long,/^[a-f0-9]{64}$/);
  for(const token of [short,long]){assert.equal(result.sql.includes(token),false);assert.ok(result.sql.includes(createHash('sha256').update(token).digest('hex')));}
  assert.ok(result.sql.includes("Friends'' night"));assert.ok(result.sql.includes('sample_card'));assert.ok(result.sql.includes('Jojo'));
  assert.notEqual(run().inviteUrl,result.inviteUrl);
});
test('room generator rejects unsafe URLs and past expiry dates',()=>{
  for(const args of [['--site','https://example.com/#invite=abc'],['--site','http://example.com/'],['--site','https://a:b@example.com/'],['--site','https://example.com/','--expires','2020-01-01']]){
    const result=spawnSync(process.execPath,['scripts/create-room.mjs',...args],{encoding:'utf8'});assert.equal(result.status,1);
  }
});
