import { useState } from 'react'

function Lightbox({ src, alt }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className="border border-[#2a2a2a] w-full cursor-zoom-in hover:opacity-90 transition-opacity"
      />
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  )
}

const TEAM_PAT = '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'

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

function CopyPat() {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(TEAM_PAT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center gap-3 bg-[#111] border border-[#2a2a2a] px-4 py-3">
      <code className="text-[#888] text-xs font-mono flex-1 truncate select-all">{TEAM_PAT}</code>
      <button
        onClick={copy}
        className="text-xs border border-[#444] text-[#aaa] hover:border-[#888] hover:text-white px-3 py-1.5 transition-colors flex-shrink-0"
      >
        {copied ? '✓ СКОПІЙОВАНО' : 'КОПІЮВАТИ'}
      </button>
    </div>
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
          <Step n="3">Постав галочку <Code>Disable cache</Code></Step>
          <Step n="4">В фільтрі вибери <Code>Fetch/XHR</Code> і введи <Code>/svc/api3</Code></Step>
          <Step n="5">Перезавантаж сторінку — у списку з'являться запити до Float</Step>
          <Step n="6">Клікни на будь-який запит → вкладка <Code>Headers</Code></Step>
          <Step n="7">В розділі <Code>Request Headers</Code> знайди заголовок <Code>Authorization</Code></Step>
          <Lightbox
            src={`${import.meta.env.BASE_URL}Float_token_2.png`}
            alt="Float JWT token — Authorization header в DevTools"
          />
          <Step n="8">
            Скопіюй значення — воно починається з <Code>Bearer eyJ...</Code>.
            Потрібна тільки частина після "Bearer " (тобто сам <Code>eyJ...</Code>)
          </Step>
          <Step n="9">Встав токен у <Code>Settings → Float JWT Token → Update</Code></Step>
          <Step n="10">Зніми галочку <Code>Disable cache</Code></Step>
          <p className="text-[#888]">
            ⏱ Токен живе ~2 тижні. Коли Float Check починає падати — оновлюй за цією інструкцією.
          </p>
        </Section>

        <Section title="GITHUB PAT — КОМАНДНИЙ ТОКЕН">
          <p>Командний токен вже створений. Просто скопіюй і встав у Settings.</p>
          <CopyPat />
          <Step n="1">Натисни кнопку вище — токен скопіюється в буфер</Step>
          <Step n="2">Відкрий <Code>Settings</Code> (іконка ⚙ вгорі праворуч)</Step>
          <Step n="3">Встав у поле <Code>GitHub PAT</Code> → <Code>Save</Code></Step>
          <p className="text-[#888]">
            Якщо токен перестав працювати — звернись до Андрія, він видасть новий.
          </p>
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
