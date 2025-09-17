\connect featbit

-- https://github.com/featbit/featbit/pull/761

-- add auto_agents column
alter table relay_proxies
    add column auto_agents JSONB default '[]'::jsonb;

-- flatten the envIds array in relay_proxies.scopes
update relay_proxies outer_rp
set scopes = (select coalesce(jsonb_agg(envId), '[]'::jsonb)
              from relay_proxies inner_rp,
                   jsonb_array_elements(scopes) as scope,
                   jsonb_array_elements_text(scope -> 'envIds') as envId
              where inner_rp.id = outer_rp.id)
where is_all_envs = false;