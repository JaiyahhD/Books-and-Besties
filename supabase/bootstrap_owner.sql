-- Run only AFTER signing up with your own email, verifying it, and replacing the email below.
-- This promotes ONLY the matching existing account. Do not share your account PIN.
update public.profiles set role='owner',status='approved' where lower(email)=lower('REPLACE_WITH_YOUR_EMAIL');
-- Verify: select id,email,role,status from public.profiles where role='owner';
