const {createClient}=require('@supabase/supabase-js');
const crypto=require('crypto');
const headers={'content-type':'application/json','cache-control':'no-store'};
const response=(code,data)=>({statusCode:code,headers,body:JSON.stringify(data)});
function env(){const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Error('Server environment is not configured');return {url,db:createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})}}
const sha=(text)=>crypto.createHash('sha256').update(text).digest('hex');
const pin=()=>String(crypto.randomInt(0,1000000)).padStart(6,'0');
const emailHash=(email)=>sha((process.env.VOTE_PEPPER||'')+'|'+email.trim().toLowerCase());
async function sendEmail(to,subject,html){if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL)throw Error('Email service is not configured');let r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:process.env.FROM_EMAIL,to:[to],subject,html})});if(!r.ok)throw Error('Email could not be delivered');}
async function getOwner(event,db){let token=(event.headers.authorization||'').replace(/^Bearer\s+/i,'');if(!token)throw Error('Not signed in');let u=await db.auth.getUser(token);if(u.error||!u.data?.user)throw Error('Invalid session');let p=await db.from('profiles').select('role,status').eq('id',u.data.user.id).single();if(p.data?.role!=='owner'||p.data?.status!=='approved')throw Error('Owner access required');return u.data.user}
const parse=e=>{try{return JSON.parse(e.body||'{}')}catch{return {}}};
module.exports={env,response,sha,pin,emailHash,sendEmail,getOwner,parse};
