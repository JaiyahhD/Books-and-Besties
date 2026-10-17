const {env,response,sha,pin,emailHash,sendEmail,parse}=require('./_shared');
exports.handler=async event=>{if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});try{
const {db}=env(),{poll_id,option_id,email}=parse(event);
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||'')||!poll_id||!option_id)return response(400,{error:'Provide a valid email and book choice.'});
if(!process.env.VOTE_PEPPER)return response(503,{error:'Voting security is not configured.'});
const p=await db.from('polls').select('status,closes_at,title').eq('id',poll_id).single();if(p.error||p.data.status!=='open'||new Date(p.data.closes_at)<=new Date())return response(400,{error:'This poll is not open.'});
const o=await db.from('poll_options').select('title').eq('id',option_id).eq('poll_id',poll_id).single();if(o.error)return response(400,{error:'Invalid nomination.'});
const hash=emailHash(email);const existing=await db.from('votes').select('id').eq('poll_id',poll_id).eq('email_hash',hash).maybeSingle();if(existing.data)return response(400,{error:'This email has already voted.'});
const recent=await db.from('vote_codes').select('id').eq('poll_id',poll_id).eq('email_hash',hash).gte('created_at',new Date(Date.now()-60000).toISOString());if((recent.data||[]).length)return response(429,{error:'Wait one minute before requesting another code.'});
const code=pin();await db.from('vote_codes').delete().eq('poll_id',poll_id).eq('email_hash',hash);
const saved=await db.from('vote_codes').insert({poll_id,option_id,email_hash:hash,code_hash:sha(process.env.VOTE_PEPPER+'|'+code),expires_at:new Date(Date.now()+10*60000).toISOString()});if(saved.error)throw saved.error;
await sendEmail(email.trim(),`Your Books & Besties voting code`,`<div style="font-family:Arial,sans-serif"><h2>Books & Besties ♡</h2><p>Your code to vote for <b>${o.data.title.replace(/[<>]/g,'')}</b> is:</p><h1>${code}</h1><p>Expires in 10 minutes. If you did not request this, ignore this message.</p></div>`);
return response(200,{message:'Verification code sent.'});}catch(e){console.error('vote-request',e.message);return response(500,{error:'Could not send your code. Please try again.'})}};
