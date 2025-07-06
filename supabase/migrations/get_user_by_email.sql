-- Function to get a user's ID from auth.users by email
create or replace function get_user_by_email(p_email text)
returns json
language plpgsql
security definer
as $$
declare
  v_user auth.users;
begin
  -- Get the user from auth.users
  select *
  into v_user
  from auth.users
  where email = p_email;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', v_user.id,
    'email', v_user.email
  );
end;
$$; 