-- Run AFTER 0005 and 0006. Adds the new v2 tasks to existing journeys without changing any started task.
select public.engine_refresh_journey_for(id) from public.journeys;
