# Индексы и планы запросов

Индексы добавлены миграциями `0009-indexes.js` (B-tree под фильтры и сортировку списков) и
`0010-trgm-search.js` (расширение `pg_trgm`, GIN-индексы под поиск `ILIKE '%…%'`). Ниже —
планы типовых запросов API до и после на синтетической нагрузке: 200 единиц оборудования,
50 000 заявок (`node scripts/generate-load.js --equipment 200 --requests 50000`, затем
`ANALYZE`). Планы сняты через `EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF)`.

## Какие индексы и зачем

| Индекс                                                                                               | Запрос API                                                                                                        |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `maintenance_requests (status)`, `(priority)`                                                        | фильтры `GET /api/requests?status=…&priority=…`                                                                   |
| `maintenance_requests (created_at)`, `(planned_at)`                                                  | диапазоны `createdFrom/To`, `plannedFrom/To`, сортировка по умолчанию                                             |
| `maintenance_requests (equipment_id, status)`                                                        | вложенный ресурс `GET /api/equipment/:id/requests?status=…`, подсчёт открытых заявок перед удалением оборудования |
| `equipment (status)`, `(type)`, `(installed_at)`                                                     | фильтры и сортировка `GET /api/equipment`                                                                         |
| `equipment_passports (equipment_id)`                                                                 | карточка оборудования (уникальный ключ уже даёт индекс — добавлен явно для читаемости плана)                      |
| `request_status_history (request_id, new_status)`                                                    | дата последнего обслуживания в отчёте `equipment-load`, среднее время закрытия в сводке площадки                  |
| GIN `equipment (name)`, `(serial_number)`, `maintenance_requests (title)`, `technicians (full_name)` | параметр `q` в списках — поиск по подстроке без учёта регистра                                                    |

Индексы под внешние ключи (`equipment.site_id`, `maintenance_requests.equipment_id`,
`request_assignees.technician_id`, `request_parts.part_id`, `request_status_history (request_id, changed_at)`)
созданы вместе с таблицами: PostgreSQL не индексирует ссылающиеся колонки автоматически, а без
них каждая проверка `ON DELETE` и каждый JOIN превращаются в последовательное чтение.

## Поиск по теме заявки: `GET /api/requests?q=балансировка`

```sql
SELECT id, title FROM maintenance_requests
WHERE title ILIKE '%балансировка%'
ORDER BY created_at DESC NULLS LAST, id ASC LIMIT 20;
```

До (последовательное чтение всей таблицы, 70 мс):

```
Limit (actual rows=20 loops=1)
  ->  Sort (actual rows=20 loops=1)
        Sort Key: created_at DESC NULLS LAST, id
        ->  Seq Scan on maintenance_requests (actual rows=6251 loops=1)
              Filter: ((title)::text ~~* '%балансировка%'::text)
              Rows Removed by Filter: 43773
              Buffers: shared hit=910
Execution Time: 70.459 ms
```

После (GIN по триграммам, 12 мс):

```
Limit (actual rows=20 loops=1)
  ->  Sort (actual rows=20 loops=1)
        Sort Key: created_at DESC NULLS LAST, id
        ->  Bitmap Heap Scan on maintenance_requests (actual rows=6251 loops=1)
              Recheck Cond: ((title)::text ~~* '%балансировка%'::text)
              ->  Bitmap Index Scan on maintenance_requests_title_trgm_idx (actual rows=6251 loops=1)
                    Index Cond: ((title)::text ~~* '%балансировка%'::text)
                    Buffers: shared hit=36
Execution Time: 12.129 ms
```

## Заявки по оборудованию со статусом: `GET /api/equipment/:id/requests?status=done`

```sql
SELECT count(*) FROM maintenance_requests r
WHERE r.equipment_id = $1 AND r.status = 'done';
```

До (индекс только по `equipment_id`, статус фильтруется на 250 строках кучи, 256 буферов):

```
Bitmap Heap Scan on maintenance_requests r (actual rows=250 loops=1)
  Recheck Cond: (equipment_id = $0)
  Filter: (status = 'done'::request_status)
  Heap Blocks: exact=250
  ->  Bitmap Index Scan on maintenance_requests_equipment_id (actual rows=250 loops=1)
Execution Time: 0.575 ms
```

После (составной индекс отвечает без обращения к таблице, 8 буферов):

```
Index Only Scan using maintenance_requests_equipment_id_status_idx on maintenance_requests r (actual rows=250 loops=1)
  Index Cond: ((equipment_id = $0) AND (status = 'done'::request_status))
  Heap Fetches: 1
Execution Time: 0.142 ms
```

## Фильтр списка заявок: `GET /api/requests?status=in_progress&priority=critical`

До — `Seq Scan`, отброшено 50 022 строки (6,3 мс); после — `Bitmap Index Scan` по
`maintenance_requests_priority_idx` и фильтр по статусу на 12 503 строках (4,9 мс). Выигрыш
скромный: оба фильтра малоселективны (четыре значения каждый), и планировщик всё равно читает
почти всю таблицу. Составной индекс `(status, priority)` помог бы только при более неравномерном
распределении статусов, поэтому не добавлен.

## Где индекс не нужен

Поиск по оборудованию (`GET /api/equipment?q=…`) на 200 строках остаётся `Seq Scan` и до, и
после создания GIN-индекса: таблица занимает 4 страницы, и последовательное чтение дешевле
обращения к индексу. Планировщик переключится на индекс, когда справочник вырастет; индекс
оставлен, потому что стоит недорого (несколько килобайт) и обслуживается вместе с таблицей.

## Как повторить

```bash
node scripts/generate-load.js --equipment 200 --requests 50000
docker compose exec db psql -U maintenance -d maintenance -c "ANALYZE"
docker compose exec db psql -U maintenance -d maintenance \
  -c "EXPLAIN (ANALYZE, BUFFERS) SELECT id, title FROM maintenance_requests WHERE title ILIKE '%балансировка%' ORDER BY created_at DESC LIMIT 20"
npm run db:migrate:undo   # откатывает 0010, ещё раз — 0009; npm run db:migrate возвращает индексы
```

Нагрузочные данные удаляются вместе с базой (`docker compose down -v`) или запросом
`DELETE FROM equipment WHERE serial_number LIKE 'LOAD-%'` (заявки и журнал уходят каскадом).
