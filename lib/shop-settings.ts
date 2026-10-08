import {db} from './shop';

let ready:Promise<void>|undefined;
export async function shopSettingsReady(){
 if(!ready)ready=(async()=>{
  await db()`CREATE TABLE IF NOT EXISTS shop_settings(id integer PRIMARY KEY CHECK(id=1),enabled boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now())`;
  await db()`INSERT INTO shop_settings(id,enabled) VALUES(1,true) ON CONFLICT(id) DO NOTHING`;
 })().catch(error=>{ready=undefined;throw error;});
 await ready;
}
export async function marketplaceEnabled(){
 await shopSettingsReady();
 const rows=await db()`SELECT enabled FROM shop_settings WHERE id=1`;
 return rows[0]?.enabled===true;
}
