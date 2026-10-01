-- Encuesta de satisfacción de clientes (2026-09-30).
--
-- Parte nativa del cierre de proyectos: al pasar un proyecto a Completado se
-- puede crear una encuesta, enviar por correo un enlace público
-- (/encuesta/{token}, sin login) y guardar las respuestas ligadas al
-- proyecto y al cliente. Las preguntas viven en la base de datos y se
-- administran en Configuración (agregar, editar, ordenar, desactivar,
-- obligatoria u opcional). Modelo de referencia: Google Form "Evaluación de
-- servicio" de Mindfreak.
--
-- Tablas:
-- * survey_questions: catálogo de preguntas por empresa. `metric` marca qué
--   pregunta alimenta cada indicador (calificación, NPS, recomendación,
--   comentario, autorización de testimonio, nombre).
-- * survey_settings: textos (correo, título, introducción, gracias) y ajustes
--   de automatización para más adelante (demora de envío, recordatorios).
-- * project_surveys: una encuesta por envío (proyecto, cliente, contacto,
--   token, estado PENDING → SENT → ANSWERED / CANCELLED, fechas, indicadores
--   ya calculados) + copia de las preguntas al crearla (si luego cambian las
--   preguntas, las encuestas ya enviadas no se alteran).
-- * project_survey_answers: una fila por respuesta (para reportes por
--   pregunta).
--
-- Acceso público: solo por las funciones get_public_survey / submit_public_survey
-- (SECURITY DEFINER, buscan exclusivamente por token y validan todo). El
-- cliente no inicia sesión y nunca ve IDs internos en la URL.
--
-- Idempotente.

-- ───────────────────────── Preguntas ─────────────────────────
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  position integer not null default 1,
  question_text text not null,
  help_text text,
  question_type text not null
    check (question_type in ('RATING_5', 'NPS_10', 'SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO')),
  options jsonb not null default '[]'::jsonb,
  is_required boolean not null default false,
  is_active boolean not null default true,
  metric text
    check (metric in ('RATING', 'NPS', 'RECOMMENDATION', 'COMMENT', 'TESTIMONIAL_CONSENT', 'RESPONDENT_NAME')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_survey_questions_company on public.survey_questions (company_id, position);
-- Indicadores de un solo valor: una pregunta por empresa (la calificación
-- general es el promedio de todas las preguntas RATING, por eso no entra).
create unique index if not exists uq_survey_questions_single_metric
  on public.survey_questions (company_id, metric)
  where metric in ('NPS', 'RECOMMENDATION', 'TESTIMONIAL_CONSENT', 'RESPONDENT_NAME');

drop trigger if exists set_updated_at on public.survey_questions;
create trigger set_updated_at before update on public.survey_questions
  for each row execute function public.set_updated_at();

-- ───────────────────────── Ajustes ─────────────────────────
create table if not exists public.survey_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  send_by_default boolean not null default true,
  -- Automatización (preparado; la v1 envía al finalizar el proyecto):
  send_delay_hours integer not null default 0 check (send_delay_hours between 0 and 720),
  reminder_enabled boolean not null default false,
  reminder_after_days integer not null default 3 check (reminder_after_days between 1 and 60),
  max_reminders integer not null default 1 check (max_reminders between 0 and 5),
  email_subject text not null default '¿Cómo te fue con tu evento? Cuéntanos tu experiencia',
  email_message text not null default 'Gracias por confiar en {empresa} para {proyecto}. Nos encantaría conocer tu opinión sobre el servicio: te tomará menos de 2 minutos.',
  survey_title text not null default 'Evaluación de servicio',
  survey_intro text not null default 'Agradecemos tu opinión sobre el servicio que te brindamos en {proyecto}, para seguir mejorando.',
  thank_you_message text not null default '¡Gracias por tu tiempo! Tu opinión nos ayuda a seguir creando experiencias inolvidables.',
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.survey_settings;
create trigger set_updated_at before update on public.survey_settings
  for each row execute function public.set_updated_at();

-- ───────────────────────── Encuestas ─────────────────────────
create table if not exists public.project_surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  contact_id uuid references public.client_contacts (id) on delete set null,
  recipient_name text,
  recipient_email text,
  token text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SENT', 'ANSWERED', 'CANCELLED')),
  questions jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  scheduled_send_at timestamptz,
  sent_at timestamptz,
  last_sent_at timestamptz,
  sent_by uuid references public.profiles (id) on delete set null,
  send_count integer not null default 0,
  last_send_error text,
  reminder_count integer not null default 0,
  last_reminder_at timestamptz,
  first_opened_at timestamptz,
  responded_at timestamptz,
  respondent_name text,
  overall_rating numeric(3, 2),
  nps_score smallint check (nps_score between 0 and 10),
  recommendation text,
  comments text,
  testimonial_consent boolean,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint project_surveys_token_length check (length(token) >= 32)
);

create unique index if not exists uq_project_surveys_token on public.project_surveys (token);
create index if not exists idx_project_surveys_project on public.project_surveys (project_id, created_at desc);
create index if not exists idx_project_surveys_client on public.project_surveys (client_id);
create index if not exists idx_project_surveys_status on public.project_surveys (company_id, status);
create index if not exists idx_project_surveys_responded on public.project_surveys (company_id, responded_at);

drop trigger if exists set_updated_at on public.project_surveys;
create trigger set_updated_at before update on public.project_surveys
  for each row execute function public.set_updated_at();

create table if not exists public.project_survey_answers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  survey_id uuid not null references public.project_surveys (id) on delete cascade,
  question_id uuid references public.survey_questions (id) on delete set null,
  question_key text not null,
  position integer not null,
  question_text text not null,
  question_type text not null,
  metric text,
  value_text text,
  value_number numeric,
  value_options jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_survey_answers_survey on public.project_survey_answers (survey_id, position);
create index if not exists idx_project_survey_answers_question on public.project_survey_answers (question_id);

-- ───────────────────────── RLS ─────────────────────────
alter table public.survey_questions enable row level security;
alter table public.survey_settings enable row level security;
alter table public.project_surveys enable row level security;
alter table public.project_survey_answers enable row level security;

drop policy if exists survey_questions_select on public.survey_questions;
create policy survey_questions_select on public.survey_questions for select
  using (company_id in (select public.user_company_ids()) and (public.has_permission('surveys.view') or public.has_permission('surveys.send')));
drop policy if exists survey_questions_write on public.survey_questions;
create policy survey_questions_write on public.survey_questions for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('surveys.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('surveys.manage'));

drop policy if exists survey_settings_select on public.survey_settings;
create policy survey_settings_select on public.survey_settings for select
  using (company_id in (select public.user_company_ids()) and (public.has_permission('surveys.view') or public.has_permission('surveys.send')));
drop policy if exists survey_settings_write on public.survey_settings;
create policy survey_settings_write on public.survey_settings for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('surveys.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('surveys.manage'));

drop policy if exists project_surveys_select on public.project_surveys;
create policy project_surveys_select on public.project_surveys for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('surveys.view'));
drop policy if exists project_surveys_insert on public.project_surveys;
create policy project_surveys_insert on public.project_surveys for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('surveys.send'));
drop policy if exists project_surveys_update on public.project_surveys;
create policy project_surveys_update on public.project_surveys for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('surveys.send'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('surveys.send'));

-- Las respuestas solo se escriben desde submit_public_survey.
drop policy if exists project_survey_answers_select on public.project_survey_answers;
create policy project_survey_answers_select on public.project_survey_answers for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('surveys.view'));
drop policy if exists project_survey_answers_delete on public.project_survey_answers;
create policy project_survey_answers_delete on public.project_survey_answers for delete
  using (company_id in (select public.user_company_ids()) and public.has_permission('surveys.send'));

revoke all on public.survey_questions, public.survey_settings, public.project_surveys, public.project_survey_answers from anon;
grant select, insert, update, delete on public.survey_questions, public.survey_settings, public.project_surveys to authenticated, service_role;
grant select, delete on public.project_survey_answers to authenticated;
grant all on public.project_survey_answers to service_role;

-- ───────────────────────── Permisos ─────────────────────────
insert into public.permissions (code, module, description) values
  ('surveys.view', 'surveys', 'Ver encuestas de satisfacción y sus respuestas'),
  ('surveys.send', 'surveys', 'Crear, enviar, reenviar, cancelar y reabrir encuestas'),
  ('surveys.manage', 'surveys', 'Configurar preguntas y textos de la encuesta')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on (
  (p.code = 'surveys.view' and r.name in ('ADMIN', 'MANAGER', 'SALES', 'FINANCE', 'OPERATIONS'))
  or (p.code = 'surveys.send' and r.name in ('ADMIN', 'MANAGER', 'SALES', 'OPERATIONS'))
  or (p.code = 'surveys.manage' and r.name in ('ADMIN', 'MANAGER'))
)
where r.company_id is null
on conflict do nothing;

-- ───────────────────────── Datos iniciales ─────────────────────────
insert into public.survey_settings (company_id)
select c.id from public.companies c
on conflict (company_id) do nothing;

-- Preguntas del Google Form de referencia, adaptadas a eventos.
insert into public.survey_questions (company_id, position, question_text, help_text, question_type, options, is_required, is_active, metric)
select c.id, q.position, q.question_text, q.help_text, q.question_type, q.options::jsonb, q.is_required, q.is_active, q.metric
from public.companies c
cross join (values
  (1, 'Tu nombre', null, 'SHORT_TEXT', '[]', true, true, 'RESPONDENT_NAME'),
  (2, '¿Cómo calificas la ejecución y planificación del evento?', '1 = Muy mala · 5 = Excelente', 'RATING_5', '[]', true, true, 'RATING'),
  (3, '¿Cómo calificas el servicio brindado durante el proceso?', '1 = Muy malo · 5 = Excelente', 'RATING_5', '[]', true, true, 'RATING'),
  (4, '¿Qué te gustaría agregar, modificar o que se hubiera hecho diferente?', null, 'LONG_TEXT', '[]', false, true, 'COMMENT'),
  (5, '¿Recomendarías nuestros servicios a alguien?', null, 'SINGLE_CHOICE', '["Definitivamente sí", "Puede ser", "Para nada"]', true, true, 'RECOMMENDATION'),
  (6, 'Del 0 al 10, ¿qué tan probable es que nos recomiendes con un amigo o colega?', '0 = Nada probable · 10 = Muy probable', 'NPS_10', '[]', false, false, 'NPS'),
  (7, '¿Nos autorizas a usar tu comentario como testimonio en nuestros canales?', 'Solo lo publicaríamos con tu nombre y el de tu empresa.', 'YES_NO', '[]', false, true, 'TESTIMONIAL_CONSENT')
) as q(position, question_text, help_text, question_type, options, is_required, is_active, metric)
where not exists (select 1 from public.survey_questions sq where sq.company_id = c.id);

-- ───────────────────────── Funciones públicas ─────────────────────────
-- Datos para la página pública. Solo por token; marca la primera apertura.
create or replace function public.get_public_survey(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_s public.project_surveys%rowtype;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return null;
  end if;

  select * into v_s from public.project_surveys where token = p_token;
  if not found then
    return null;
  end if;

  if v_s.first_opened_at is null and v_s.status in ('PENDING', 'SENT') then
    update public.project_surveys set first_opened_at = now() where id = v_s.id;
  end if;

  select jsonb_build_object(
    'status', v_s.status,
    'responded_at', v_s.responded_at,
    'recipient_name', v_s.recipient_name,
    'client_name', c.name,
    'project', jsonb_build_object('name', p.name, 'event_date', p.event_date),
    'company', jsonb_build_object(
      'name', co.name, 'legal_name', co.legal_name, 'logo_url', co.logo_url,
      'brand_primary', co.brand_primary, 'brand_accent', co.brand_accent,
      'email', co.email, 'phone', co.phone
    ),
    'texts', jsonb_build_object(
      'title', coalesce(st.survey_title, 'Evaluación de servicio'),
      'intro', coalesce(st.survey_intro, ''),
      'thanks', coalesce(st.thank_you_message, '¡Gracias por tu tiempo!')
    ),
    'questions', case when v_s.status in ('PENDING', 'SENT') then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', q->>'key', 'text', q->>'text', 'help', q->>'help', 'type', q->>'type',
        'options', coalesce(q->'options', '[]'::jsonb), 'required', coalesce((q->>'required')::boolean, false),
        'metric', q->>'metric'
      ) order by (q->>'position')::int), '[]'::jsonb)
      from jsonb_array_elements(v_s.questions) q
    ) else '[]'::jsonb end
  )
  into v_result
  from public.projects p
  join public.clients c on c.id = v_s.client_id
  join public.companies co on co.id = v_s.company_id
  left join public.survey_settings st on st.company_id = v_s.company_id
  where p.id = v_s.project_id;

  return v_result;
end;
$function$;

-- Guarda las respuestas (una sola vez por encuesta). Valida cada pregunta
-- contra la copia guardada al crear la encuesta. Todo o nada.
create or replace function public.submit_public_survey(p_token text, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_s public.project_surveys%rowtype;
  v_q jsonb;
  v_key text;
  v_type text;
  v_required boolean;
  v_metric text;
  v_val jsonb;
  v_text text;
  v_num numeric;
  v_opts jsonb;
  v_ratings numeric[] := '{}';
  v_nps smallint;
  v_reco text;
  v_comments text[] := '{}';
  v_consent boolean;
  v_name text;
  v_manager uuid;
  v_project_name text;
  v_overall numeric;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  select * into v_s from public.project_surveys where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_s.status = 'ANSWERED' then
    return jsonb_build_object('ok', false, 'error', 'already_answered');
  end if;
  if v_s.status = 'CANCELLED' then
    return jsonb_build_object('ok', false, 'error', 'cancelled');
  end if;

  begin
    -- Si se reabrió, se reemplazan las respuestas anteriores.
    delete from public.project_survey_answers where survey_id = v_s.id;

    for v_q in select * from jsonb_array_elements(v_s.questions) loop
      v_key := v_q->>'key';
      v_type := v_q->>'type';
      v_required := coalesce((v_q->>'required')::boolean, false);
      v_metric := v_q->>'metric';
      v_opts := coalesce(v_q->'options', '[]'::jsonb);
      v_val := p_answers -> v_key;
      v_text := null;
      v_num := null;

      if v_val is null or jsonb_typeof(v_val) = 'null'
         or (jsonb_typeof(v_val) = 'string' and btrim(v_val #>> '{}') = '')
         or (jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) = 0) then
        if v_required then
          raise exception 'required:%', v_q->>'text';
        end if;
        continue;
      end if;

      if v_type in ('RATING_5', 'NPS_10') then
        begin
          v_num := (v_val #>> '{}')::numeric;
        exception when others then
          raise exception 'invalid:%', v_q->>'text';
        end;
        if v_num <> trunc(v_num)
           or (v_type = 'RATING_5' and (v_num < 1 or v_num > 5))
           or (v_type = 'NPS_10' and (v_num < 0 or v_num > 10)) then
          raise exception 'invalid:%', v_q->>'text';
        end if;
        v_text := v_num::text;
      elsif v_type in ('SHORT_TEXT', 'LONG_TEXT') then
        v_text := btrim(v_val #>> '{}');
        if length(v_text) > (case when v_type = 'SHORT_TEXT' then 300 else 5000 end) then
          raise exception 'too_long:%', v_q->>'text';
        end if;
      elsif v_type = 'SINGLE_CHOICE' then
        v_text := v_val #>> '{}';
        if jsonb_typeof(v_val) <> 'string' or not (v_opts ? v_text) then
          raise exception 'invalid:%', v_q->>'text';
        end if;
      elsif v_type = 'MULTIPLE_CHOICE' then
        if jsonb_typeof(v_val) <> 'array' or exists (
          select 1 from jsonb_array_elements(v_val) e
          where jsonb_typeof(e) <> 'string' or not (v_opts ? (e #>> '{}'))
        ) then
          raise exception 'invalid:%', v_q->>'text';
        end if;
        select string_agg(e #>> '{}', ', ') into v_text from jsonb_array_elements(v_val) e;
      elsif v_type = 'YES_NO' then
        v_text := upper(v_val #>> '{}');
        if v_text not in ('SI', 'NO') then
          raise exception 'invalid:%', v_q->>'text';
        end if;
        v_text := case when v_text = 'SI' then 'Sí' else 'No' end;
      else
        raise exception 'invalid:%', v_q->>'text';
      end if;

      insert into public.project_survey_answers (
        company_id, survey_id, question_id, question_key, position, question_text, question_type,
        metric, value_text, value_number, value_options
      ) values (
        v_s.company_id, v_s.id, nullif(v_q->>'id', '')::uuid, v_key, coalesce((v_q->>'position')::int, 0),
        v_q->>'text', v_type, v_metric, v_text, v_num,
        case when v_type = 'MULTIPLE_CHOICE' then v_val else null end
      );

      if v_metric = 'RATING' and v_num is not null then v_ratings := v_ratings || v_num; end if;
      if v_metric = 'NPS' and v_num is not null then v_nps := v_num::smallint; end if;
      if v_metric = 'RECOMMENDATION' then v_reco := v_text; end if;
      if v_metric = 'COMMENT' and v_text is not null then v_comments := v_comments || v_text; end if;
      if v_metric = 'TESTIMONIAL_CONSENT' then v_consent := (v_text = 'Sí'); end if;
      if v_metric = 'RESPONDENT_NAME' then v_name := v_text; end if;
    end loop;

    select case when array_length(v_ratings, 1) > 0 then round(avg(x), 2) end
      into v_overall from unnest(v_ratings) x;

    update public.project_surveys set
      status = 'ANSWERED',
      responded_at = now(),
      overall_rating = v_overall,
      nps_score = v_nps,
      recommendation = v_reco,
      comments = nullif(array_to_string(v_comments, E'\n\n'), ''),
      testimonial_consent = v_consent,
      respondent_name = coalesce(v_name, recipient_name)
    where id = v_s.id;
  exception
    when raise_exception then
      return jsonb_build_object(
        'ok', false,
        'error', split_part(sqlerrm, ':', 1),
        'question', substr(sqlerrm, length(split_part(sqlerrm, ':', 1)) + 2)
      );
  end;

  select p.manager_id, p.name into v_manager, v_project_name from public.projects p where p.id = v_s.project_id;

  -- Auditoría del proyecto (sin usuario: respondió el cliente).
  insert into public.audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  values (v_s.company_id, null, 'SURVEY_RESPONSE', 'project', v_s.project_id,
          jsonb_build_object('survey_id', v_s.id, 'overall_rating', v_overall, 'nps', v_nps, 'recommendation', v_reco));

  -- Aviso al responsable del proyecto y a quien envió la encuesta.
  insert into public.notifications (company_id, user_id, type, title, message, entity_type, entity_id)
  select v_s.company_id, u, 'survey_answered', 'El cliente respondió la encuesta',
         'Encuesta de satisfacción de ' || coalesce(v_project_name, 'un proyecto') ||
         coalesce(' · Calificación ' || to_char(v_overall, 'FM0.0') || '/5', ''),
         'project', v_s.project_id
  from (select distinct u from unnest(array[v_manager, v_s.sent_by, v_s.created_by]) u where u is not null) t;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.get_public_survey(text) from public;
revoke all on function public.submit_public_survey(text, jsonb) from public;
grant execute on function public.get_public_survey(text) to anon, authenticated, service_role;
grant execute on function public.submit_public_survey(text, jsonb) to anon, authenticated, service_role;
