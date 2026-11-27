#!/usr/bin/env node
import {randomBytes,createHash} from 'node:crypto';
import {SAMPLE_CARD} from '../sample-card.mjs';
const args=process.argv.slice(2);
function option(name,fallback=''){const i=args.indexOf(name);return i<0?fallback:args[i+1]||'';}
if(args.includes('--help')){
  console.log('Usage: node scripts/create-room.mjs --site https://USER.github.io/REPO/bingo/ [--name "Room name"] [--sample] [--expires 2027-01-01] [--json]');process.exit(0);
}
let site;
try{
  site=new URL(option('--site'));
  if(site.username||site.password||site.search||site.hash||!['http:','https:'].includes(site.protocol))throw Error();
  if(site.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(site.hostname))throw Error();
  if(!site.pathname.endsWith('/'))site.pathname+='/';
}catch{console.error('Use --site with your complete HTTPS bingo folder URL, with no query, fragment or credentials.');process.exit(1);}
const name=option('--name','Awards Night');if(!name.trim()||name.length>80){console.error('Room name must contain 1 to 80 characters.');process.exit(1);}
const expiry=option('--expires');let expiresSql='null';
if(expiry){const date=new Date(expiry);if(Number.isNaN(date.getTime())||date.getTime()<=Date.now()){console.error('--expires must be a future ISO date.');process.exit(1);}expiresSql=`'${date.toISOString()}'::timestamptz`;}
const short=randomBytes(16).toString('base64url'),long=randomBytes(32).toString('hex');
const hash=value=>createHash('sha256').update(value).digest('hex');
const sqlString=value=>"'"+value.replaceAll("'","''")+"'";
const room=`insert into bingo_private.room (name,token_hash,short_token_hash,expires_at) values (${sqlString(name.trim())},'${hash(long)}','${hash(short)}',${expiresSql}) returning id`;
let sql;
if(args.includes('--sample')){
  sql=`with new_room as (${room}), sample_card as (\n  insert into bingo_private.card (room_id,title,creator,cells,free_space)\n  select id,${sqlString(SAMPLE_CARD.title)},${sqlString(SAMPLE_CARD.creator)},${sqlString(JSON.stringify(SAMPLE_CARD.cells))}::jsonb,true from new_room\n  returning id,room_id\n) select room_id,id as sample_card_id from sample_card;`;
}else sql=room+';';
const invite=new URL(site),legacy=new URL(site);invite.hash=new URLSearchParams({invite:short});legacy.hash=new URLSearchParams({invite:long});
const result={inviteUrl:invite.href,longInviteUrl:legacy.href,sql};
if(args.includes('--json'))console.log(JSON.stringify(result));
else console.log(`KEEP THESE LINKS PRIVATE. They grant access to all cards in this room.\n\nShort invitation:\n${result.inviteUrl}\n\nLong invitation (same room):\n${result.longInviteUrl}\n\nRun this SQL in your Supabase SQL Editor. It contains only token hashes:\n\n${sql}\n\nSave the returned room_id for revocation, expiration, and backups. Do not commit either invitation link.`);
