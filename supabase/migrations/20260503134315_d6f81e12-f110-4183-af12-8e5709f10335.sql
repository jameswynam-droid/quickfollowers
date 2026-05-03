-- Replace any leftover provider brand names in service descriptions/names with QuickFollowers
UPDATE public.services
SET description = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(description, '\mOwlet''?s\M', 'QuickFollowers''', 'gi'),
      '\mFollowspanel''?s\M', 'QuickFollowers''', 'gi'
    ),
    '\mSmmfollows''?s\M', 'QuickFollowers''', 'gi'
  ),
  '\m(Owlet|Followspanel|Smmfollows|SMM Follows|SmmOwl)\M', 'QuickFollowers', 'gi'
)
WHERE description ~* '\m(Owlet|Followspanel|Smmfollows|SMM Follows|SmmOwl)\M';

UPDATE public.services
SET name = regexp_replace(name, '\m(Owlet|Followspanel|Smmfollows|SMM Follows|SmmOwl)\M', 'QuickFollowers', 'gi')
WHERE name ~* '\m(Owlet|Followspanel|Smmfollows|SMM Follows|SmmOwl)\M';

UPDATE public.services
SET category = regexp_replace(category, '\m(Owlet|Followspanel|Smmfollows|SMM Follows|SmmOwl)\M', 'QuickFollowers', 'gi')
WHERE category ~* '\m(Owlet|Followspanel|Smmfollows|SMM Follows|SmmOwl)\M';