import { useState } from 'react'

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-[#1a1a1a]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#111] transition-colors"
      >
        <span className="text-base font-bold tracking-widest text-white">{title}</span>
        <span className="text-[#777] text-sm flex-shrink-0 ml-4">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-[#1a1a1a] space-y-3 text-[#999] text-base leading-relaxed">
          {children}
        </div>
      )}
    </div>
  )
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="text-[#777] font-bold flex-shrink-0 w-6">{n}.</span>
      <span>{children}</span>
    </div>
  )
}

function Code({ children }) {
  return (
    <code className="bg-[#1a1a1a] border border-[#2a2a2a] px-2 py-0.5 text-[#ccc] text-sm font-mono">
      {children}
    </code>
  )
}

export default function Guides() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-xs text-[#777] tracking-widest mb-1">DOCUMENTATION</div>
        <h1 className="text-lg font-bold text-white tracking-wide">Гайди по BACKLOG-COLLECTOR-9000</h1>
      </div>

      <div className="space-y-2">
        <Section title="ЩО ТАКЕ БЕКЛОГ І НАВІЩО ВІН" defaultOpen={true}>
          <p>
            Беклог — список задач для художників на завтра. Збирається щоранку: Float Check перевіряє
            завантаженість → Coda збирає беклог → Orders простягають пріоритет у Monday.
          </p>
          <p>
            Цей інтерфейс замінює ручні запуски скриптів через Claude Code — все в одному місці,
            одна кнопка, без питань про дозволи.
          </p>
        </Section>

        <Section title="ЯК ОТРИМАТИ FLOAT JWT ТОКЕН">
          <Step n="1">Відкрий браузер і зайди на <Code>rsg.float.com</Code></Step>
          <Step n="2">Натисни <Code>F12</Code> → вкладка <Code>Network</Code></Step>
          <Step n="3">В фільтрі вибери <Code>Fetch/XHR</Code></Step>
          <Step n="4">Перезавантаж сторінку або зроби будь-яку дію у Float</Step>
          <Step n="5">Знайди будь-який запит до <Code>rsg.float.com</Code> (наприклад <Code>/svc/api3/v3/people</Code>)</Step>
          <Step n="6">
            В розділі <Code>Request Headers</Code> знайди заголовок <Code>authorization</Code>
          </Step>
          <Step n="7">
            Скопіюй значення — воно починається з <Code>Bearer eyJ...</Code>.
            Потрібна тільки частина після "Bearer " (тобто сам <Code>eyJ...</Code>)
          </Step>
          <Step n="8">
            Встав токен у <Code>Settings → Float JWT Token → Update</Code>
          </Step>
          <p className="text-[#888]">
            ⏱ Токен живе ~2 тижні. Коли Float Check починає падати — оновлюй за цією інструкцією.
          </p>
        </Section>

        <Section title="ЯК ОТРИМАТИ GITHUB PAT">
          <Step n="1">Зайди на <Code>github.com/settings/tokens</Code></Step>
          <Step n="2">Fine-grained tokens → Generate new token</Step>
          <Step n="3">Repository access: тільки <Code>backlog-collector-9000</Code></Step>
          <Step n="4">
            Permissions: <Code>Actions → Read & Write</Code>, <Code>Contents → Read & Write</Code>,{' '}
            <Code>Secrets → Read & Write</Code>
          </Step>
          <Step n="5">Generate → скопіюй токен (показується один раз)</Step>
          <Step n="6">Встав у <Code>Settings → GitHub PAT → Save</Code></Step>
        </Section>

        <Section title="ЯК ДОДАТИ EXCEPTION">
          <p>Exceptions — таблиці конфігурації для скриптів. Зберігаються в репо як JSON.</p>
          <Step n="1">Відкрий вкладку <Code>EXCEPTIONS</Code></Step>
          <Step n="2">Вибери потрібну таблицю (наприклад <Code>Name Exceptions</Code>)</Step>
          <Step n="3">Натисни <Code>+ ADD ROW</Code></Step>
          <Step n="4">Введи значення у відповідні колонки</Step>
          <Step n="5">Натисни <Code>SAVE</Code> — зміни комітяться в репо, наступний run підхопить нові дані</Step>
        </Section>

        <Section title="FAQ — ТИПОВІ ПРОБЛЕМИ">
          <div className="space-y-2">
            <div className="border border-[#1e1e1e] p-4">
              <div className="text-[#ccc] font-bold mb-2">Float Check падає з помилкою 401</div>
              <div>Токен протух. Оновити по гайду вище.</div>
            </div>
            <div className="border border-[#1e1e1e] p-4">
              <div className="text-[#ccc] font-bold mb-2">Художник не матчиться (NO MATCH в логах)</div>
              <div>
                Ім'я у Float і Monday відрізняється. Додай виключення у{' '}
                <Code>Exceptions → Name Exceptions</Code>:
                колонка Float name → Monday search name.
              </div>
            </div>
            <div className="border border-[#1e1e1e] p-4">
              <div className="text-[#ccc] font-bold mb-2">Задача не отримує Order</div>
              <div>
                Або задача є в <Code>Skip Tasks</Code>, або назва не матчиться.
                Перевір <Code>Exceptions → Skip Tasks</Code>.
              </div>
            </div>
            <div className="border border-[#1e1e1e] p-4">
              <div className="text-[#ccc] font-bold mb-2">Кнопка RUN не реагує</div>
              <div>Перевір GitHub PAT у Settings. Якщо PAT не вставлений — workflow не задиспетчеться.</div>
            </div>
            <div className="border border-[#1e1e1e] p-4">
              <div className="text-[#ccc] font-bold mb-2">Float — READ ONLY?</div>
              <div>
                Так. Float — тільки читання. Назавжди. Скрипти НІКОЛИ не записують у Float.
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
