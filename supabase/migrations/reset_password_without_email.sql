-- Create a function to reset a user's password without email verification
create or replace function reset_password_without_email(
  p_user_id uuid,
  p_password text
)
returns json
language plpgsql
security definer
as $$
declare
  v_user auth.users;
  v_encrypted_password text;
begin
  -- Check if user exists
  select * into v_user
  from auth.users
  where id = p_user_id;

  if not found then
    return json_build_object('success', false, 'message', 'User not found');
  end if;

  -- Encrypt the password using Supabase's internal encryption
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- Update the user's password
  update auth.users
  set encrypted_password = v_encrypted_password,
      updated_at = now()
  where id = p_user_id;

  return json_build_object('success', true);
exception
  when others then
    return json_build_object('success', false, 'message', SQLERRM);
end;
$$; 