import {cookies} from 'next/headers';
import {digest,isAdmin} from './shop';
import {committeeEnabled,committeeSession} from './committee-access';

// Bind Google consent to the validated login, not to a legacy cookie that may
// not exist. Re-evaluate permission on both departure and return from Google.
export async function gmailSessionBinding():Promise<string|null>{
 if(!await isAdmin('membership'))return null;
 if(await committeeEnabled()){
  const current=await committeeSession();
  if(!current?.session?.id||!current.user?.id)return null;
  return digest('gmail-committee:'+JSON.stringify([current.user.id,current.session.id]));
 }
 const raw=(await cookies()).get('kpkmm-admin')?.value;
 return raw?digest(raw):null;
}
