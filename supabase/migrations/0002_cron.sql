-- NOT APPLIED. Run on the TEST project first. The cron token is generated inside the database and kept in Vault: it never appears in code, git or chat.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Token: created once, inside the database.
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'cron_token') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_token');
  end if;
end $$;

-- 2) One call, made once by the person who runs the app, after the app is deployed:  select schedule_queue_cron('https://YOUR-APP-URL');
create or replace function schedule_queue_cron(app_url text) returns void language plpgsql security definer set search_path = public, vault, cron, net as $$
begin
  if exists (select 1 from vault.secrets where name = 'cron_url') then
    perform vault.update_secret((select id from vault.secrets where name = 'cron_url'), app_url || '/api/cron/queue');
  else
    perform vault.create_secret(app_url || '/api/cron/queue', 'cron_url');
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'aic-queue';
  perform cron.schedule('aic-queue', '*/5 * * * *', $job$
    select net.http_get(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_url'),
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_token')),
      timeout_milliseconds := 300000)
  $job$);
end $$;
revoke all on function schedule_queue_cron(text) from public, anon, authenticated;
grant execute on function schedule_queue_cron(text) to service_role;

-- 3) Check that a scheduled run reached the app (look for status 'succeeded' and a 200 response):
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, created from net._http_response order by created desc limit 5;
