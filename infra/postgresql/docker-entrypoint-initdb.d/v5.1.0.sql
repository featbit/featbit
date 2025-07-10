\connect featbit

-- https://github.com/featbit/featbit/pull/761

-- add auto_agents column
alter table relay_proxies
    add column auto_agents JSONB default '[]'::jsonb;

-- flatten the envIds array in relay_proxies.scopes
update relay_proxies
set scopes = (select jsonb_agg(envId)
              from relay_proxies,
                   jsonb_array_elements(scopes) as scope,
                   jsonb_array_elements_text(scope -> 'envIds') as envId)
where true;