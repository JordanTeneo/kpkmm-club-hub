import {headers} from 'next/headers';
import {cache} from 'react';
import {db} from './shop';
import {committeeAuth} from './committee-auth';
export type CommitteeScope='membership'|'content'|'shop'|'appointments';
// Cache schema readiness only, never users, permissions or session results.
let ready:Promise<void>|undefined;
export async function committeeReady(){
 if(!ready)ready=(async()=>{
 await db()`CREATE TABLE IF NOT EXISTS club_committee_settings(id integer PRIMARY KEY CHECK(id=1),enabled boolean NOT NULL DEFAULT false)`;
 await db()`INSERT INTO club_committee_settings(id) VALUES(1) ON CONFLICT DO NOTHING`;
 await db()`CREATE TABLE IF NOT EXISTS club_committee_permissions(user_id text PRIMARY KEY,scopes text[] NOT NULL DEFAULT '{}',disabled boolean NOT NULL DEFAULT false)`;
 await db()`CREATE TABLE IF NOT EXISTS club_committee_audit(id bigserial PRIMARY KEY,actor text NOT NULL,action text NOT NULL,target text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
 })().catch(error=>{ready=undefined;throw error;});
 await ready;
}
async function readEnabled(){await committeeReady();return !!(await db()`SELECT enabled FROM club_committee_settings WHERE id=1`)[0]?.enabled;}
// React memoization lives only for one render, never across visitors or requests.
const renderEnabled=cache(readEnabled);
export async function committeeEnabled(){return (await headers()).has('next-action')?readEnabled():renderEnabled();}
async function readSession(){
 const session=await committeeAuth().api.getSession({headers:await headers()});
 if(!session)return null;
 const permissions=await db()`SELECT scopes,disabled FROM club_committee_permissions WHERE user_id=${session.user.id}`;
 if(permissions[0]?.disabled||session.user.banned)return null;
 return {...session,scopes:permissions[0]?.scopes||[],superAdmin:session.user.role==='admin'};
}
const renderSession=cache(readSession);
export async function committeeSession(){return (await headers()).has('next-action')?readSession():renderSession();}
export async function committeeAllowed(scope?:CommitteeScope){
 const session=await committeeSession();const allowed=!!session&&(session.superAdmin||(!scope?session.scopes.length>0:session.scopes.includes(scope)));
 const action=(await headers()).get('next-action');
 if(allowed&&session&&action)await db()`INSERT INTO club_committee_audit(actor,action,target) VALUES(${session.user.id},${'authorised-action:'+action},${scope||'admin'})`;
 return allowed;
}
export async function committeeAudit(action:string,target:string){
 if(!(await committeeEnabled()))return;
 const session=await committeeSession();if(!session)throw Error('Unauthorised');
 await db()`INSERT INTO club_committee_audit(actor,action,target) VALUES(${session.user.id},${action},${target})`;
}
