-- Delete the user account (this will cascade to profiles and user_roles)
DELETE FROM auth.users WHERE email = 'ezeprosperabuchi@gmail.com';