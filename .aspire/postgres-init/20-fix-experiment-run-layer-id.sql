\set ON_ERROR_STOP on
\connect featbit

BEGIN;

DO $migration$
DECLARE
    layer_type text;
BEGIN
    SELECT udt_name
      INTO layer_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'experiment_runs'
       AND column_name = 'layer_id';

    IF layer_type IS NULL THEN
        RAISE EXCEPTION 'public.experiment_runs.layer_id does not exist';
    END IF;

    IF layer_type <> 'uuid' THEN
        EXECUTE
            'ALTER TABLE public.experiment_runs
             ALTER COLUMN layer_id TYPE uuid
             USING layer_id::uuid';
    END IF;
END
$migration$;

ALTER TABLE public.experiment_runs
    ALTER COLUMN layer_id DROP NOT NULL,
    DROP COLUMN IF EXISTS run_id;

COMMIT;
