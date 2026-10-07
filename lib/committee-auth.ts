import {betterAuth} from 'better-auth';
import {admin} from 'better-auth/plugins/admin';
import {nextCookies} from 'better-auth/next-js';
import {Pool} from 'pg';
import {createHmac} from 'node:crypto';
let instance:ReturnType<typeof makeAuth>|undefined;
function makeAuth(){
 const secret=process.env.ADMIN_SESSION_SECRET;
 if(!secret||secret.length<32)throw Error('Secure admin authentication is not configured');
 return betterAuth({
  appName:'KPKMM Committee',baseURL:'https://kpkmm-club-hub.vercel.app',basePath:'/api/committee',
  secret:createHmac('sha256',secret).update('kpkmm-committee-auth-v1').digest('hex'),
  database:new Pool({connectionString:process.env.DATABASE_URL||process.env.POSTGRES_URL,max:2}),
  user:{modelName:'committee_user'},session:{modelName:'committee_session',expiresIn:43200,cookieCache:{enabled:false}},
  account:{modelName:'committee_account'},verification:{modelName:'committee_verification'},
  emailAndPassword:{enabled:true,disableSignUp:true,minPasswordLength:12},
  rateLimit:{enabled:true,storage:'database',modelName:'committee_rate_limit',window:60,max:10},
  advanced:{cookiePrefix:'kpkmm-committee',useSecureCookies:true},
  plugins:[admin(),nextCookies()]
 });
}
export function committeeAuth(){return instance??=makeAuth();}
