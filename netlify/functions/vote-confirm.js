const {env,response,sha,emailHash,parse}=require('./_shared');
exports.handler=async event=>{if(event.httpMethod!=='POST')return response(405,{error:'Method not allowed'});try{
const {db}=env(),{poll_id,option_id,email,code}=parse(event);if(!/^[0-9]{6}$/.test(code||'')||!email||!poll_id||!option_id)return response(400,{error:'Invalid verification details.'});
if(!process.env.VOTE_PEPPER)return response(503,{error:'Voting security is not configured.'});
const hash=emailHash(email);const q=await db.from('vote_codes').select('*').eq('poll_id',poll_id).eq('email_hash',hash).eq('option_id',option_id).order('created_at',{ascending:false}).limit(1).maybeSingle();const c=q.data;
if(!c||new Date(c.expires_at)<new Date()||c.attempts>=5)return response(400,{error:'Code expired or unavailable. Request a new code.'});
await db.from('vote_codes').update({attempts:c.attempts+1}).eq('id',c.id);
if(sha(process.env.VOTE_PEPPER+'|'+code)!==c.code_hash)return response(400,{error:'Incorrect code.'});
// Atomic RPC rechecks poll state, duplicates, and code under a row lock.
const r=await db.rpc('confirm_public_vote',{p_code_id:c.id,p_option:option_id,p_hash:hash,p_code_hash:c.code_hash});if(r.error)return response(400,{error:r.error.message});
return response(200,{message:'Vote counted.'});}catch(e){console.error('vote-confirm',e.message);return response(500,{error:'Could not confirm vote.'})}};
