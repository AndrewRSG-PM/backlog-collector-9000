# BK9K — Технічний контекст для Claude

Цей файл містить повну технічну документацію по BK9K (Backlog Collector 9000).
Додай його як Project Knowledge у свій Claude — він дозволить вирішувати проблеми і відповідати на питання по BK9K без додаткового контексту.

---

## 1. Що таке BK9K і для чого

**BK9K (Backlog Collector 9000)** — внутрішній веб-інструмент RSG для щоденного менеджменту беклогу художників.

**URL:** https://andrewrsg-pm.github.io/backlog-collector-9000
**Репо:** https://github.com/AndrewRSG-PM/backlog-collector-9000

Три основні функції:
1. **Float Check** — перевіряє завантаження художників у Float на задану дату, відправляє звіт в Discord з тегами відповідальних PM
2. **Order Sync** — проставляє порядок (Order) задач у Monday відповідно до візуального порядку задач у Float
3. **Assemble Backlog** — тригерить Make.com сценарій збірки беклогу (наразі кнопка RUN вимкнена, використовується через Coda)

**Правила (абсолютні):**
- Float — тільки читання. BK9K нічого не змінює у Float
- Monday — тільки колонка Order. Нічого більше не пишеться

---

## 2. Архітектура

```
Браузер (GitHub Pages SPA)
  → workflow_dispatch (GitHub API)
    → GitHub Actions
      → Node.js скрипти
        → Float API (читання)
        → Monday API (тільки Order column)
        → Discord Webhook (відправка звітів)
```

**Стек:** React 19 + Vite + Tailwind CSS v3, темна тема `#0d0d0d`, font-size 17px
**Деплой:** Push у `main` → GitHub Actions → GitHub Pages автоматично

---

## 3. GitHub PAT

**Що це:** Personal Access Token — потрібен кожному користувачу BK9K для запуску workflows і збереження налаштувань.

**Де зберігається:** тільки в `localStorage` браузера (`bc9000_github_pat`). Не в GitHub Secrets. Кожен вставляє свій особисто.

**Як отримати:** від Андрія Головка (він генерує і роздає особисто).

**Якщо генеруєш сам:**
- GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Repository: `backlog-collector-9000`
- Permissions: Actions (R/W), Contents (R/W), Secrets (R/W)

**Де ввести в BK9K:** відкрити сайт → оранжевий банер "GitHub PAT не встановлено" → ВСТАНОВИТИ PAT → поле GitHub PAT → Save.

---

## 4. GitHub Secrets

Всі секрети зберігаються в GitHub Secrets репо і доступні в GitHub Actions workflows. Оновлюються через BK9K Settings UI (шифрування libsodium) або через GitHub UI.

| Secret | Що це | Хто оновлює |
|--------|-------|-------------|
| `FLOAT_API_KEY` | Офіційний Float API ключ (безстроковий) | Андрій |
| `MONDAY_TOKEN` | Monday.com API токен | Андрій |
| `DISCORD_WEBHOOK_PROD` | Webhook основного беклог-каналу | Андрій |
| `DISCORD_WEBHOOK_TEST` | Webhook тестового каналу | Андрій |
| `FLOAT_SESSION_COOKIE` | Сесійна кука Float (`float2sessprd`), потрібна для order-sync | Андрій, раз на ~2 тижні |

---

## 5. Скрипти

### `scripts/float-check.js`

Читає з Float: людей, задачі, timeoffs, проекти, акаунти.
Перевіряє завантаження кожного художника на TARGET_DATE.
Формує звіт і відправляє в Discord.

**Env vars:**
- `FLOAT_API_KEY` — обов'язковий
- `TARGET_DATE` — дата у форматі YYYY-MM-DD (default: наступний робочий день)
- `NO_MENTIONS` — `true` = не тегати PM в повідомленні (показує імена текстом)
- `TEST_MODE` — `true` = відправляти в тестовий webhook
- `DISCORD_WEBHOOK_PROD` / `DISCORD_WEBHOOK_TEST`

**Логіка перевірки:**
- `< 8h` або `> max_hours` → помітка в звіті
- `Tentative` задачі → помітка
- Художник не запланований → секція "Не заплановані"
- Кілька PM на одну задачу → секція "Conflicting"

### `scripts/order-sync.js`

Читає задачі з Float на TARGET_DATE.
Отримує візуальний порядок задач через Playwright (svc/api3 + FLOAT_SESSION_COOKIE).
Читає Monday backlog boards.
Записує Order колонку в Monday відповідно до порядку у Float.

**Env vars:**
- `FLOAT_API_KEY`, `MONDAY_TOKEN` — обов'язкові
- `FLOAT_SESSION_COOKIE` — сесійна кука для Playwright (без неї — fallback до приблизного порядку)
- `TARGET_DATE`, `DRY_RUN` — `true` = тільки лог, нічого не пишеться в Monday

---

## 6. Float API

### Офіційний API (основний)
- **Base URL:** `https://api.float.com/v3`
- **Auth:** `Authorization: Bearer <FLOAT_API_KEY>`
- **Пагінація:** `per-page=200&page=N`
- **Важливо:** `department_id` вкладено: `person.department?.department_id` (не `person.department_id`)
- **Multi-person tasks:** `task.people_id` буває `null` при 2+ людях → використовувати `task.people_id ? [task.people_id] : (task.people_ids || [])`
- **`project_manager`** у проекті = `account_id` (не `people_id`) → потрібно завантажити `/accounts` окремо

### Internal API (тільки для order-sync)
- **Base URL:** `https://rsg.float.com/svc/api3/v3`
- **Auth:** Bearer JWT (перехоплюється Playwright)
- **Навіщо:** тільки цей API повертає поле `priority` задачі (відповідає візуальному порядку у Float-календарі)
- **`priority`:** більш від'ємне значення = вище у Float. Сортувати ascending.

---

## 7. FLOAT_SESSION_COOKIE

### Що це і навіщо
Float SPA (single-page app) генерує JWT токен через JavaScript при вході. Офіційний API не має поля `priority`. Щоб отримати правильний візуальний порядок задач, order-sync.js використовує Playwright (headless Chrome), який:
1. Відкриває `rsg.float.com` з сесійною кукою
2. Перехоплює Bearer JWT з network requests
3. Використовує JWT для запиту до internal API з `priority` полем

Кука `float2sessprd` — сесійна кука Float, живе ~2 тижні.

### Як оновити (покроково)
1. Відкрий `rsg.float.com` у браузері (переконайся що залогінений)
2. F12 → вкладка **Application** → **Cookies** → `rsg.float.com`
3. Знайди куку **`float2sessprd`** → скопіюй **Value** (виглядає як `ttgapcpimq7c2cf1aels60fhjl`)
4. Відкрий BK9K → Settings → поле **FLOAT SESSION COOKIE** → вставити → UPDATE
5. Або: GitHub → репо → Settings → Secrets → `FLOAT_SESSION_COOKIE` → Update

### Що буде якщо протухла
- order-sync.js падає на fallback (офіційний API, порядок приблизний)
- В GitHub Actions з'являється annotation `FLOAT_SESSION_COOKIE_EXPIRED`
- На Dashboard BK9K з'являється жовтий банер: "ОРДЕРИ МОЖУТЬ БУТИ ПРОСТАВЛЕНІ НЕПРАВИЛЬНО"

---

## 8. GitHub Actions Workflows

### `float-check.yml`
| Input | Тип | Default | Опис |
|-------|-----|---------|------|
| `date` | string | '' (tomorrow) | YYYY-MM-DD |
| `no_mentions` | boolean | false | Без @тегів PM |
| `test_mode` | boolean | false | Тестовий webhook |

### `order-sync.yml`
| Input | Тип | Default | Опис |
|-------|-----|---------|------|
| `date` | string | '' (tomorrow) | YYYY-MM-DD |
| `dry_run` | boolean | false | Не писати в Monday |

Включає кроки: `npm ci` → кеш Playwright Chromium → `npx playwright install chromium --with-deps` → `node scripts/order-sync.js`

### `backlog-assemble.yml`
| Input | Тип | Опис |
|-------|-----|------|
| `dept` | string | '2D' або '3D' |
| `date` | string | YYYY-MM-DD |

Відправляє Discord-нотифікацію + curl до Make.com webhook.
- 2D webhook: `https://hook.eu1.make.com/0r2v6scul53iv537kxfl3fh1pht0nxh9`
- 3D webhook: `https://hook.eu1.make.com/0cx7d1wpl2ouudadg7d61u742mqgiy6w`
- Дата передається у форматі `M/D/YYYY` (конвертується у workflow)

### `daily-reminder.yml`
Cron: `45 14 * * 1-5` (17:45 Kyiv EEST / UTC+3, Пн-Пт)
Відправляє нагадування в основний беклог-канал з тегом ролі @PM (`<@&1329466362476625933>`).
⚠️ Взимку (UTC+2) змінити cron на `45 15 * * 1-5`.

---

## 9. PM Attribution (логіка визначення PM для задачі)

Порядок пріоритетів у `float-check.js`:

1. **`project_exceptions` → `pm_override`** (ручний override, найвищий пріоритет)
2. **Float `project.project_manager`** → `account_id` → ім'я акаунту → `pm_discord.json` (float_name)

Monday більше не використовується для PM attribution.

**3-денне вікно:** PM визначається по сумі годин за dayBefore + target + dayAfter. Тегається PM з максимальними годинами. Запобігає хибному тегу коли художник переходить між проектами різних PM.

---

## 10. pm_discord.json

Файл: `config/pm_discord.json`

```json
[
  { "pm_name": "Andrew Holovko",    "float_name": "PM Andrew",    "discord_id": "1473964446652039168" },
  { "pm_name": "Hanna Pavlovska",   "float_name": "PM Hanna",     "discord_id": "1187007896341463175" },
  { "pm_name": "Anna Riapolova",    "float_name": "PM ANNA",      "discord_id": "894601664093356063"  },
  { "pm_name": "Anna Lozynska",     "float_name": "Ann RSG PM Jr","discord_id": "1507345186181742715" },
  { "pm_name": "Nick Boichenko",    "float_name": "PM Nikita",    "discord_id": "1331997837860405260" },
  { "pm_name": "Alina Shevchuk",    "float_name": "PM Alina S",   "discord_id": "1329372254450225177" },
  { "pm_name": "Oleksandr Salabai", "float_name": "PM Aleksandr", "discord_id": "923128286266130432"  },
  { "pm_name": "Polina Chaviak",    "float_name": "PM Polina",    "discord_id": "1074700213354238094" },
  { "pm_name": "Roman Tkachenko",   "float_name": "PM Roman",     "discord_id": "1033054881189203978" },
  { "pm_name": "Yegor Khrushch",    "float_name": "PM YEGOR",     "discord_id": "1256354350721138750" },
  { "pm_name": "Valeriia Dubina",   "float_name": "PM Lera",      "discord_id": "1498262798256570419" }
]
```

- `pm_name` — реальне ім'я (відображається в UI, використовується для pm_override)
- `float_name` — ім'я акаунту у Float (використовується для project_manager lookup)
- `discord_id` — Discord user ID для формування тегу `<@id>`

---

## 11. Exceptions (налаштування виключень)

Файли зберігаються в `config/` репо. Редагуються через BK9K Settings → Exceptions.

### Float Check exceptions (`config/float_check_exceptions.json`)

| Тип | Що робить |
|-----|-----------|
| `max_hours` | Нестандартний ліміт годин для художника (напр. арт-директор 4h) |
| `skip_artist` | Художника повністю ігнорувати у Float Check |
| `skip_tag` | Задачі з цим тегом у Float не рахуються в годинах |
| `timeoff_type` | Тип відсутності який рахується як "Off" (напр. `count_as_off`) |

### Skip Tasks (`config/skip_tasks_exact.json` і `skip_tasks_contain.json`)
Назви задач у Float, які виключаються з підрахунку:
- `skip_tasks_exact` — точний збіг назви
- `skip_tasks_contain` — підрядок у назві
Такі задачі не впливають на статус художника у звіті.

### Project Exceptions (`config/project_exceptions.json`)
```json
{ "float_project": "Walking Dead", "monday_project": "DECA WD", "pm_override": "Andrew Holovko" }
```
- `float_project` — частина або повна назва проекту у Float (регістр не важливий)
- `monday_project` — назва в Monday (якщо відрізняється)
- `pm_override` — ім'я PM з `pm_name` поля pm_discord.json; кілька через кому: `"Andrew Holovko, Hanna Pavlovska"`

### Name Exceptions (`config/name_exceptions.json`)
```json
{ "float_name": "Vladislav Kaminskiy", "monday_name": "Kaminsky" }
```
Якщо ім'я художника у Float відрізняється від Monday — Order Sync не знаходить збіг. Тут вказується mapping.

### PM Discord (`config/pm_discord.json`)
Описано у розділі 10.

---

## 12. Банери на Dashboard

| Банер | Колір | Умова появи | Дія |
|-------|-------|-------------|-----|
| NoPATBanner | Оранжевий | `localStorage` не має `bc9000_github_pat` | Встановити PAT в Settings |
| FloatFailBanner | Червоний | Останній float-check.yml завершився з `conclusion: failure` | Оновити FLOAT_API_KEY |
| OrderSyncCookieBanner | Жовтий | GitHub Actions annotation `FLOAT_SESSION_COOKIE_EXPIRED` в останньому order-sync run | Оновити FLOAT_SESSION_COOKIE |

Банери перевіряються при завантаженні сторінки через GitHub API (getLatestRun + getRunAnnotations).

---

## 13. Типові проблеми і фікси

### "Failed to fetch" в Exceptions
**Причина:** `Cache-Control: no-cache` header блокується CORS GitHub API.
**Статус:** пофіксовано (прибрано header, кеш-бастинг через `?_=${Date.now()}` в URL).

### SHA mismatch при збереженні налаштувань
**Причина:** браузер кешував GitHub API GET-відповідь зі старим SHA.
**Статус:** пофіксовано (`writeConfigFile` завжди fetch-ить свіжий SHA перед записом).

### Order Sync проставляє неправильний порядок
**Причина 1:** FLOAT_SESSION_COOKIE протух → Playwright не може отримати JWT → fallback без `priority` поля.
**Рішення:** оновити `FLOAT_SESSION_COOKIE` в Settings.

**Причина 2:** Задачі в Monday мають дублікати (одна задача на кількох людей або на кілька дат).
**Поведінка:** дублікати пропускаються, Order залишається з першої позиції (лог показує `(dup, order kept from earlier position)`).

### Float Check показує 0 художників
**Причина:** `department_id` вкладено в об'єкт: треба `person.department?.department_id`, не `person.department_id`.
**Статус:** пофіксовано.

### PM не визначається або визначається неправильно
**Причина 1:** Float account name ("PM Andrew") не збігається з `pm_name` у pm_discord.json.
**Рішення:** перевірити `float_name` поле у pm_discord.json — воно має точно збігатись з назвою Float-акаунту.

**Причина 2:** Проект не має `project_manager` у Float, або PM не в pm_discord.json.
**Рішення:** додати `pm_override` у Project Exceptions для цього проекту.

### Float Check тегає PM у тестовому режимі
**Причина:** `NO_MENTIONS` не передалось у workflow, або `pm` містить кілька mentions через пробіл — lookup в `discordToPm` не знаходить комбінований рядок.
**Статус:** пофіксовано (split по пробілу, lookup кожного mention окремо).

### npm ci fails у GitHub Actions
**Причина:** `package-lock.json` не синхронізований після додавання залежності.
**Рішення:** запустити `npm install --package-lock-only` локально і запушити оновлений lock-файл.

---

## 14. Структура файлів репо

```
backlog-collector-9000/
├── .github/
│   └── workflows/
│       ├── float-check.yml
│       ├── order-sync.yml
│       ├── backlog-assemble.yml
│       └── daily-reminder.yml
├── config/
│   ├── float_check_exceptions.json
│   ├── skip_tasks_exact.json
│   ├── skip_tasks_contain.json
│   ├── project_exceptions.json
│   ├── name_exceptions.json
│   └── pm_discord.json
├── scripts/
│   ├── float-check.js
│   └── order-sync.js
├── src/
│   ├── lib/
│   │   └── github.js          # GitHub API утиліти (PAT, workflows, config files, secrets)
│   ├── pages/
│   │   ├── Dashboard.jsx      # Головна сторінка (Float Check, Order Sync, Assemble Backlog)
│   │   ├── Settings.jsx       # Налаштування (PAT, secrets, exceptions)
│   │   └── Guides.jsx         # Гайди (як отримати PAT, Float JWT тощо)
│   └── components/
│       └── SettingsModal.jsx  # Модалка налаштувань
├── package.json               # Залежності: react, vite, tailwind, playwright, libsodium-wrappers
├── README.md                  # Інструкція для користувачів
└── BK9K-CONTEXT.md            # Цей файл (для Claude)
```

---

## 15. Додатково

### Backlog Google Sheets (exceptions config)
URL: `https://docs.google.com/spreadsheets/d/1FbGeUjiyPCyHR4Z70NbImlWlMFrU5pd6D_PAR-Et78k`
Використовується як backup/read конфігурації. Sharing: "Anyone with the link can view".

### Make.com збірка беклогу
Тригериться через `backlog-assemble.yml`. Збирає дані і формує беклог у Coda.
Наразі кнопка RUN в BK9K відключена — збирати через Coda напряму.

### Daily reminder
Щодня о 17:45 Kyiv (Пн-Пт) відправляє в основний беклог-канал повідомлення з тегом @PM ролі (`<@&1329466362476625933>`).
Взимку (UTC+2) змінити cron у `daily-reminder.yml` з `45 14` на `45 15`.
