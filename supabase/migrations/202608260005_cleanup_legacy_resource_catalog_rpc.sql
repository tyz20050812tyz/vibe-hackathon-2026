-- Applies the v2 compatibility cleanup to projects that ran migration 003
-- before its guarded form was introduced. It is also harmless on fresh setups.
do $$
begin
  if to_regprocedure('public.search_resource_catalog(text,text,text,integer)') is not null then
    execute 'revoke all on function public.search_resource_catalog(text, text, text, integer) from public, anon, authenticated, service_role';
    execute 'drop function public.search_resource_catalog(text, text, text, integer)';
  end if;
end;
$$;
