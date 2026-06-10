import { useState } from 'react'

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[#1a2336]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#131a2b] transition-colors"
      >
        <span className="text-base font-bold tracking-widest text-white">{title}</span>
        <span className="text-[#6f81ab] text-sm flex-shrink-0 ml-4">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-[#1a2336] space-y-3 text-[#93a2c2] text-base leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="text-[#6f81ab] font-bold flex-shrink-0 w-6">{n}.</span>
      <span>{children}</span>
    </div>
  )
}

function Code({ children }) {
  return (
    <code className="bg-[#1a2336] border border-[#2b3a5e] px-2 py-0.5 text-[#c9d3e6] text-sm font-mono">
      {children}
    </code>
  )
}

function FaqItem({ q, children }) {
  return (
    <div className="border border-[#1e1e1e] p-4">
      <div className="text-[#c9d3e6] font-bold mb-2">{q}</div>
      <div>{children}</div>
    </div>
  )
}

export default function Guides() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-xs text-[#6f81ab] tracking-widest mb-1">DOCUMENTATION</div>
        <h1 className="text-lg font-bold text-white tracking-wide">Гайди — BK9K</h1>
      </div>

      <div className="space-y-2">

        <Section title="ЩО ТАКЕ BK9K" defaultOpen={true}>
          <p>
            BK9K (Backlog Collector 9000) — інструмент для щоденного збору беклогу художників.
            Замінює ручні запуски скриптів: все в одному місці, одна кнопка.
          </p>
          <p>Три функції:</p>
          <div className="space-y-1">
            <div>— <strong className="text-white">Float Check</strong> — перевіряє завантаження художників у Float, відправляє звіт в Discord</div>
            <div>— <strong className="text-white">Order Sync</strong> — проставляє Order в Monday відповідно до порядку задач у Float</div>
            <div>— <strong className="text-white">Assemble Backlog</strong> — збирає беклог через Coda</div>
          </div>
          <p className="text-[#6173a0]">Float — тільки читання. Monday — тільки колонка Order. Назавжди.</p>
        </Section>

        <Section title="ПЕРШИЙ ЗАПУСК — GITHUB PAT">
          <p>
            Для роботи BK9K потрібен GitHub Personal Access Token.
            Отримай його особисто від <strong className="text-white">Андрія Головка</strong>.
          </p>
          <Step n="1">Отримай токен від Андрія</Step>
          <Step n="2">Відкрий BK9K → вгорі буде оранжевий банер</Step>
          <Step n="3">Натисни <Code>ВСТАНОВИТИ PAT</Code> → відкриється Settings</Step>
          <Step n="4">Встав токен у поле <Code>GitHub PAT</Code> → <Code>Save</Code></Step>
          <p className="text-[#8191b6]">Токен зберігається тільки в браузері. Після очищення кешу — треба вставити знову.</p>
        </Section>

        <Section title="FLOAT CHECK — ЯК ВИКОРИСТОВУВАТИ">
          <Step n="1">Встанови <Code>Target Date</Code> вгорі (за замовчуванням — наступний робочий день)</Step>
          <Step n="2">Натисни <Code>RUN</Code> у картці Float Check</Step>
          <Step n="3">Статус зміниться на <Code>RUNNING</Code>, потім <Code>DONE</Code></Step>
          <Step n="4">Звіт з'явиться в основному Discord-каналі беклогу з тегами PM</Step>
          <p>Для тестового запуску (без тегів PM, в тестовий канал) — використовуй <Code>Float Check — Test</Code>.</p>
          <p className="text-[#8191b6]">
            Що означають секції у звіті:<br />
            — художник без помітки → все OK<br />
            — <Code>{'< 8h'}</Code> / <Code>{'> Xh'}</Code> → недо- або перезавантажений<br />
            — <Code>Tentative</Code> → задача не підтверджена<br />
            — <Code>🚫 Не заплановані</Code> → художник без задач<br />
            — <Code>⚠️ Conflicting</Code> → задачі двох різних PM в один день
          </p>
        </Section>

        <Section title="ORDER SYNC — ЯК ВИКОРИСТОВУВАТИ">
          <Step n="1">Встанови <Code>Target Date</Code></Step>
          <Step n="2">Увімкни <Code>DRY RUN</Code> якщо хочеш перевірити без запису в Monday</Step>
          <Step n="3">Натисни <Code>RUN</Code></Step>
          <Step n="4">В логах GitHub Actions видно що і в якому порядку проставилось</Step>
          <p className="text-[#8191b6]">
            Order Sync зчитує візуальний порядок задач у Float-календарі (порядок перетягуванням)
            і переносить його в колонку Order у Monday. Тільки Order — більше нічого не змінюється.
          </p>
          <p className="text-[#8191b6]">
            Якщо з'явився жовтий банер — FLOAT_SESSION_COOKIE протух.
            Дивись гайд нижче.
          </p>
        </Section>

        <Section title="FLOAT SESSION COOKIE — ЯК ОНОВИТИ">
          <p>
            Потрібен для Order Sync щоб отримати правильний порядок задач з Float.
            Живе ~2 тижні, після чого — жовтий банер на Dashboard.
          </p>
          <Step n="1">Відкрий <Code>rsg.float.com</Code> у браузері (переконайся що залогінений)</Step>
          <Step n="2">F12 → вкладка <Code>Application</Code> → <Code>Cookies</Code> → <Code>rsg.float.com</Code></Step>
          <Step n="3">Знайди куку <Code>float2sessprd</Code> → скопіюй <Code>Value</Code></Step>
          <Step n="4">Відкрий BK9K → Settings → поле <Code>FLOAT SESSION COOKIE</Code> → вставити → <Code>UPDATE</Code></Step>
          <p className="text-[#8191b6]">Термін дії видно в колонці Expires у DevTools. Зазвичай ~2 тижні від останнього входу.</p>
        </Section>

        <Section title="ЯК ДОДАТИ EXCEPTION">
          <p>Exceptions — налаштування виключень для Float Check і Order Sync. Зберігаються в репо як JSON.</p>
          <Step n="1">Відкрий вкладку <Code>Exceptions</Code> у навігації</Step>
          <Step n="2">Вибери потрібну вкладку (Float Check / Name Exceptions / Skip Tasks / Project Exceptions)</Step>
          <Step n="3">Натисни <Code>+ ADD ROW</Code> → заповни поля</Step>
          <Step n="4">Натисни <Code>SAVE</Code> — зміни комітяться в репо, наступний run підхопить їх</Step>
          <div className="space-y-2 mt-2">
            <div className="border border-[#1e1e1e] p-3">
              <div className="text-[#c9d3e6] font-bold text-sm mb-1">Float Check</div>
              <div className="text-sm space-y-0.5">
                <div>— <Code>max_hours</Code>: нестандартний ліміт годин для художника</div>
                <div>— <Code>skip_artist</Code>: повністю ігнорувати художника у звіті</div>
                <div>— <Code>skip_tag</Code>: задачі з цим тегом не рахуються в годинах</div>
              </div>
            </div>
            <div className="border border-[#1e1e1e] p-3">
              <div className="text-[#c9d3e6] font-bold text-sm mb-1">Skip Tasks</div>
              <div className="text-sm space-y-1">
                <div>Адміністративні задачі які не є проектним навантаженням: QA, Art Direction, Syncs, Tech Support тощо.</div>
                <div className="text-[#6f81ab]">Їх години <strong className="text-[#a6b3cd]">рахуються</strong> в загальне завантаження — художник з 7.5h проекту + 0.5h QA = 8h і не буде зафлаговано. Але якщо у художника <em>тільки</em> такі задачі без проектних — він потрапить у секцію "Не заплановані".</div>
              </div>
            </div>
            <div className="border border-[#1e1e1e] p-3">
              <div className="text-[#c9d3e6] font-bold text-sm mb-1">Project Exceptions</div>
              <div className="text-sm">Ручний PM-override для проекту. Якщо PM визначається неправильно автоматично — вкажи тут вручну який PM відповідає за цей проект.</div>
            </div>
            <div className="border border-[#1e1e1e] p-3">
              <div className="text-[#c9d3e6] font-bold text-sm mb-1">Name Exceptions</div>
              <div className="text-sm">Якщо ім'я художника у Float відрізняється від Monday — Order Sync не знайде збіг. Вкажи mapping: Float ім'я → Monday ім'я.</div>
            </div>
          </div>
        </Section>

        <Section title="FAQ — ТИПОВІ ПРОБЛЕМИ">
          <div className="space-y-2">
            <FaqItem q="Float Check падає з помилкою 401 / червоний банер">
              Float API ключ протух або скинутий. Зверніться до <strong className="text-white">Андрія</strong> — він оновить <Code>FLOAT_API_KEY</Code> у GitHub Secrets.
            </FaqItem>
            <FaqItem q="Жовтий банер — ордери можуть бути неправильні">
              FLOAT_SESSION_COOKIE протух. Оновити самостійно за гайдом вище або звернутись до Андрія.
            </FaqItem>
            <FaqItem q="Кнопка RUN не реагує">
              Перевір GitHub PAT у Settings. Якщо оранжевий банер — PAT не вставлений або протух. Отримай новий від Андрія.
            </FaqItem>
            <FaqItem q="Художник не матчиться (NO MATCH в логах Order Sync)">
              Ім'я у Float і Monday відрізняється. Додай у <Code>Exceptions → Name Exceptions</Code>: Float ім'я → Monday ім'я.
            </FaqItem>
            <FaqItem q="PM не тегається або тегається неправильний">
              Або проект не має PM у Float, або PM не в списку pm_discord. Додай <Code>pm_override</Code> у <Code>Project Exceptions</Code> для цього проекту.
            </FaqItem>
            <FaqItem q="Задача не отримує Order">
              Перевір <Code>Exceptions → Skip Tasks</Code> — задача може бути там. Або ім'я художника не матчиться (дивись Name Exceptions).
            </FaqItem>
            <FaqItem q="Exceptions не зберігаються">
              Перевір що PAT має права <Code>Contents: R/W</Code>. Якщо помилка "SHA mismatch" — спробуй ще раз, зазвичай це разово.
            </FaqItem>
          </div>
        </Section>

        <Section title="CHANGELOG">
          <div className="space-y-5">

            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-white font-bold tracking-wider">v1.3</span>
                <span className="text-[#51679c] text-xs">08.06.2026</span>
              </div>
              <ul className="space-y-1 text-[#93a2c2]">
                <li>— Float visual sort order: Playwright + session cookie → правильний порядок задач</li>
                <li>— OrderSyncCookieBanner: попередження коли FLOAT_SESSION_COOKIE протух</li>
                <li>— Fix: NO_MENTIONS режим для кількох PM на одному проекті</li>
                <li>— Fix: CORS помилка в Exceptions (прибрано Cache-Control header)</li>
                <li>— Assemble Backlog: кнопка RUN вимкнена, Coda кнопка рівноправна</li>
                <li>— Daily reminder: щоденне нагадування в Discord о 17:45 (Пн–Пт)</li>
                <li>— README і гайди оновлені</li>
              </ul>
            </div>

            <div className="border-t border-[#1a2336] pt-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[#a6b3cd] font-bold tracking-wider">v1.2</span>
                <span className="text-[#51679c] text-xs">04.06.2026</span>
              </div>
              <ul className="space-y-1 text-[#6f81ab]">
                <li>— Float API Key замість JWT: безстроковий, не протухає</li>
                <li>— PM attribution через Float project_manager (без Monday)</li>
                <li>— 3-денне вікно для визначення домінантного PM</li>
                <li>— Fix: multi-person tasks (people_ids)</li>
                <li>— Fix: SHA stale caching при збереженні exceptions</li>
                <li>— Backlog Assemble 2D/3D кнопки + Make.com інтеграція</li>
              </ul>
            </div>

            <div className="border-t border-[#1a2336] pt-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[#6173a0] font-bold tracking-wider">v1.1</span>
                <span className="text-[#51679c] text-xs">02.06.2026</span>
              </div>
              <ul className="space-y-1 text-[#51679c]">
                <li>— PM Override: chips + dropdown в Project Exceptions</li>
                <li>— Fix: SPA routing 404, UTF-8 в JSON конфігах</li>
                <li>— Settings: Discord Webhook поля</li>
              </ul>
            </div>

            <div className="border-t border-[#1a2336] pt-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[#44598c] font-bold tracking-wider">v1.0</span>
                <span className="text-[#51679c] text-xs">02.06.2026</span>
              </div>
              <ul className="space-y-1 text-[#44598c]">
                <li>— Початковий запуск: Float Check + Order Sync</li>
                <li>— Exceptions UI, Settings, NoPATBanner</li>
              </ul>
            </div>

          </div>
        </Section>

      </div>
    </div>
  )
}
