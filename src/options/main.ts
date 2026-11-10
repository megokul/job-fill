import {
  datalistCountryOptions,
  datalistStateOptions,
} from '../shared/regions'
import {
  deleteFormMapping,
  getStore,
  replaceStore,
  saveCustomAnswers,
  saveFormMapping,
  saveProfile,
  saveSettings,
} from '../shared/storage'
import {
  EMPTY_PROFILE,
  PROFILE_KEYS,
  FILL_KEY_LABELS,
  PROFILE_LABELS,
  type CustomAnswer,
  type FormMapping,
  type Profile,
  type ProfileKey,
  type Store,
  type YesNo,
} from '../shared/types'
import { mergeStores } from '../shared/mergeStores'
import { parseBackup } from '../shared/validate'
import {
  suggestHttps,
  validateProfileField,
} from '../shared/profileValidation'
import { clear, h } from '../ui/dom'

const YES_NO = new Set<ProfileKey>(['workAuthorized', 'requiresSponsorship'])
const URL_KEYS = new Set<ProfileKey>(['linkedinUrl', 'portfolioUrl', 'githubUrl'])

const GROUPS: { title: string; keys: ProfileKey[] }[] = [
  {
    title: 'Identity',
    keys: ['firstName', 'lastName', 'preferredName', 'pronouns'],
  },
  { title: 'Contact', keys: ['email', 'phone'] },
  {
    title: 'Address',
    keys: [
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'postalCode',
      'country',
    ],
  },
  { title: 'Links', keys: ['linkedinUrl', 'portfolioUrl', 'githubUrl'] },
  {
    title: 'Work eligibility',
    keys: ['workAuthorized', 'requiresSponsorship'],
  },
  {
    title: 'Role and compensation',
    keys: [
      'currentCompany',
      'currentTitle',
      'yearsExperience',
      'noticePeriod',
      'howDidYouHear',
      'salaryExpectation',
    ],
  },
]

let store: Store
let saveTimer: number | undefined
let deletedMapping: FormMapping | null = null
let deletedTimer: number | undefined

void init()

async function init(): Promise<void> {
  store = await getStore()
  wireNav()
  renderAll()
  showSection(location.hash.replace('#', '') || 'profile')
  window.addEventListener('hashchange', () => {
    showSection(location.hash.replace('#', '') || 'profile')
  })
}

function wireNav(): void {
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((a) => {
    a.addEventListener('click', () => {
      document.querySelectorAll('[data-nav]').forEach((x) => x.classList.remove('active'))
      a.classList.add('active')
    })
  })
}

function showSection(id: string): void {
  for (const panel of document.querySelectorAll<HTMLElement>('.panel')) {
    panel.hidden = panel.id !== id
  }
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('active', a.getAttribute('data-nav') === id)
  })
}

function renderAll(): void {
  renderProfile()
  renderAnswers()
  renderSites()
  renderSettings()
  renderBackup()
}

function renderProfile(): void {
  const root = document.getElementById('profile')!
  clear(root)
  const filled = PROFILE_KEYS.filter((k) => String(store.profile[k]).trim()).length
  const pct = Math.round((filled / PROFILE_KEYS.length) * 100)
  const saved = h('span', { className: 'saved', id: 'profile-saved' }, '')

  root.append(
    h(
      'div',
      { className: 'panel-head' },
      h('h1', null, 'Profile'),
      saved,
    ),
    h('div', null, `Completeness ${filled}/${PROFILE_KEYS.length}`),
    h('div', { className: 'progress' }, h('span', { style: { width: `${pct}%` } })),
  )

  for (const group of GROUPS) {
    const fs = h('fieldset', { className: 'fieldset' }, h('legend', null, group.title))
    const grid = h('div', { className: 'grid' })
    for (const key of group.keys) {
      grid.append(profileField(key))
    }
    fs.append(grid)
    root.append(fs)
  }

  // datalists
  root.append(
    h(
      'datalist',
      { id: 'states-list' },
      ...datalistStateOptions().map((v) => h('option', { value: v })),
    ),
    h(
      'datalist',
      { id: 'countries-list' },
      ...datalistCountryOptions().map((v) => h('option', { value: v })),
    ),
  )
}

function profileField(key: ProfileKey): HTMLElement {
  const label = h('label', { htmlFor: `f-${key}` }, PROFILE_LABELS[key])
  const error = h('div', { className: 'error', id: `err-${key}` })
  let input: HTMLInputElement | HTMLSelectElement

  if (YES_NO.has(key)) {
    input = h(
      'select',
      { id: `f-${key}`, name: key },
      h('option', { value: '' }, '—'),
      h('option', { value: 'yes' }, 'Yes'),
      h('option', { value: 'no' }, 'No'),
    ) as HTMLSelectElement
    input.value = store.profile[key]
  } else {
    const type =
      key === 'email' ? 'email' : URL_KEYS.has(key) ? 'url' : key === 'phone' ? 'tel' : 'text'
    const autocomplete =
      key === 'firstName'
        ? 'given-name'
        : key === 'lastName'
          ? 'family-name'
          : key === 'email'
            ? 'email'
            : key === 'phone'
              ? 'tel'
              : key === 'city'
                ? 'address-level2'
                : key === 'state'
                  ? 'address-level1'
                  : key === 'postalCode'
                    ? 'postal-code'
                    : key === 'country'
                      ? 'country-name'
                      : 'off'
    input = h('input', {
      id: `f-${key}`,
      name: key,
      type,
      value: store.profile[key],
      autocomplete,
      list:
        key === 'state' ? 'states-list' : key === 'country' ? 'countries-list' : undefined,
    }) as HTMLInputElement
  }

  const onChange = () => {
    const value = input.value
    const message = validateProfileField(key, value)
    error.textContent = message ?? ''
    if (message && URL_KEYS.has(key)) {
      const suggestion = suggestHttps(value)
      if (suggestion) {
        error.textContent = `${message} `
        const fix = h('button', { type: 'button', className: 'btn' }, 'Use https://')
        fix.addEventListener('click', () => {
          input.value = suggestion
          error.textContent = ''
          queueProfileSave()
        })
        error.append(fix)
      }
      return
    }
    if (!message) queueProfileSave()
  }

  input.addEventListener('blur', onChange)
  input.addEventListener('input', () => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(onChange, 600)
  })

  return h(
    'div',
    { className: `field${URL_KEYS.has(key) || key.startsWith('address') ? ' full' : ''}` },
    label,
    input,
    error,
  )
}

function queueProfileSave(): void {
  const profile = readProfile()
  const invalid = PROFILE_KEYS.some((k) => validateProfileField(k, String(profile[k])))
  if (invalid) return
  void (async () => {
    store = await saveProfile(profile)
    const el = document.getElementById('profile-saved')
    if (el) {
      el.textContent = `Saved ✓ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    renderProfile()
  })()
}

function readProfile(): Profile {
  const profile = { ...EMPTY_PROFILE }
  for (const key of PROFILE_KEYS) {
    const el = document.getElementById(`f-${key}`) as
      | HTMLInputElement
      | HTMLSelectElement
      | null
    if (!el) continue
    const value = el.value.trim()
    if (YES_NO.has(key)) {
      ;(profile as Record<string, YesNo>)[key] =
        value === 'yes' || value === 'no' ? value : ''
    } else {
      ;(profile as Record<string, string>)[key] = value
    }
  }
  return profile
}

function renderAnswers(): void {
  const root = document.getElementById('answers')!
  clear(root)
  root.append(
    h('div', { className: 'panel-head' }, h('h1', null, 'Answers')),
    h(
      'p',
      { className: 'muted' },
      'Custom answers are used only on fields you map them to — never by heuristic fill.',
    ),
    h(
      'button',
      {
        className: 'btn primary',
        type: 'button',
        onClick: () => {
          const next: CustomAnswer = {
            id: crypto.randomUUID(),
            question: '',
            answer: '',
            updatedAt: Date.now(),
          }
          store.customAnswers = [...store.customAnswers, next]
          renderAnswers()
        },
      },
      'Add answer',
    ),
  )

  for (const answer of store.customAnswers) {
    const q = h('input', {
      value: answer.question,
      placeholder: 'Question label',
    }) as HTMLInputElement
    const a = h('textarea', {
      placeholder: 'Your answer',
    }) as HTMLTextAreaElement
    a.value = answer.answer
    const save = () => {
      answer.question = q.value.trim()
      answer.answer = a.value
      answer.updatedAt = Date.now()
      void saveCustomAnswers(store.customAnswers).then((s) => {
        store = s
      })
    }
    q.addEventListener('blur', save)
    a.addEventListener('blur', save)
    root.append(
      h(
        'div',
        { className: 'card' },
        h('div', { className: 'field' }, h('label', null, 'Question'), q),
        h('div', { className: 'field' }, h('label', null, 'Answer'), a),
        h(
          'button',
          {
            className: 'btn danger',
            type: 'button',
            onClick: () => {
              store.customAnswers = store.customAnswers.filter((x) => x.id !== answer.id)
              void saveCustomAnswers(store.customAnswers).then((s) => {
                store = s
                renderAnswers()
              })
            },
          },
          'Delete',
        ),
      ),
    )
  }
}

function renderSites(): void {
  const root = document.getElementById('sites')!
  clear(root)
  root.append(h('div', { className: 'panel-head' }, h('h1', null, 'Sites')))

  if (deletedMapping) {
    root.append(
      h(
        'div',
        { className: 'undo-bar' },
        h('span', null, `Deleted “${deletedMapping.name}”`),
        h(
          'button',
          {
            className: 'btn',
            type: 'button',
            onClick: () => {
              void saveFormMapping(deletedMapping!).then((s) => {
                store = s
                deletedMapping = null
                renderSites()
              })
            },
          },
          'Undo',
        ),
      ),
    )
  }

  const search = h('input', {
    className: 'search btn',
    placeholder: 'Search sites…',
  }) as HTMLInputElement
  root.append(search)
  const list = h('div', { id: 'sites-list' })
  root.append(list)

  const paint = () => {
    clear(list)
    const q = search.value.trim().toLowerCase()
    const mappings = store.formMappings
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.origin.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)

    if (mappings.length === 0) {
      list.append(
        h(
          'p',
          { className: 'muted' },
          'No saved mappings yet. Open a job form, then use Map this form from the popup.',
        ),
      )
      return
    }

    for (const m of mappings) {
      const autofillOn = store.settings.autofillSites.includes(m.origin)
      const toggle = h('input', {
        type: 'checkbox',
        checked: autofillOn,
      }) as HTMLInputElement
      toggle.addEventListener('change', () => {
        const sites = new Set(store.settings.autofillSites)
        if (toggle.checked) sites.add(m.origin)
        else sites.delete(m.origin)
        void saveSettings({
          autofillSites: [...sites],
          highlightFilled: store.settings.highlightFilled,
        }).then((s) => {
          store = s
        })
      })

      const nameInput = h('input', { value: m.name }) as HTMLInputElement
      const pathInput = h('input', { value: m.pathPattern }) as HTMLInputElement
      list.append(
        h(
          'details',
          { className: 'card' },
          h(
            'summary',
            null,
            `${m.name} · ${m.origin}${m.pathPattern} · ${m.fields.length} fields`,
          ),
          h('p', { className: 'muted' }, `Updated ${new Date(m.updatedAt).toLocaleString()}`),
          h('label', { className: 'check' }, toggle, 'Autofill on load'),
          h(
            'div',
            { className: 'row' },
            nameInput,
            pathInput,
            h(
              'button',
              {
                className: 'btn',
                type: 'button',
                onClick: () => {
                  void saveFormMapping({
                    ...m,
                    name: nameInput.value.trim() || m.name,
                    pathPattern: pathInput.value.trim() || '/',
                    updatedAt: Date.now(),
                  }).then((s) => {
                    store = s
                    renderSites()
                  })
                },
              },
              'Update',
            ),
            h(
              'button',
              {
                className: 'btn',
                type: 'button',
                onClick: () => chrome.tabs.create({ url: m.origin }),
              },
              'Open site',
            ),
            h(
              'button',
              {
                className: 'btn danger',
                type: 'button',
                onClick: () => {
                  deletedMapping = m
                  void deleteFormMapping(m.id).then((s) => {
                    store = s
                    renderSites()
                    window.clearTimeout(deletedTimer)
                    deletedTimer = window.setTimeout(() => {
                      deletedMapping = null
                      renderSites()
                    }, 6000)
                  })
                },
              },
              'Delete',
            ),
          ),
          h(
            'ul',
            null,
            ...m.fields.map((f) =>
              h(
                'li',
                null,
                f.profileKey
                  ? FILL_KEY_LABELS[f.profileKey]
                  : `Custom: ${
                      store.customAnswers.find((a) => a.id === f.customAnswerId)?.question ||
                      f.customAnswerId
                    }`,
                ' — ',
                f.match.label || f.selector || '',
              ),
            ),
          ),
        ),
      )
    }
  }
  search.addEventListener('input', paint)
  paint()
}

function renderSettings(): void {
  const root = document.getElementById('settings')!
  clear(root)
  const highlight = h('input', {
    type: 'checkbox',
    checked: store.settings.highlightFilled,
  }) as HTMLInputElement
  highlight.addEventListener('change', () => {
    void saveSettings({
      autofillSites: store.settings.autofillSites,
      highlightFilled: highlight.checked,
    }).then((s) => {
      store = s
    })
  })
  root.append(
    h('div', { className: 'panel-head' }, h('h1', null, 'Settings')),
    h('label', { className: 'check' }, highlight, 'Highlight filled fields'),
    h(
      'p',
      { className: 'muted' },
      'Keyboard shortcut: Alt+Shift+F. Customize in Chrome extension shortcuts.',
    ),
    h(
      'button',
      {
        className: 'btn',
        type: 'button',
        onClick: () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }),
      },
      'Open shortcut settings',
    ),
  )
}

function renderBackup(): void {
  const root = document.getElementById('backup')!
  clear(root)
  const preview = h('div', { className: 'muted', id: 'import-preview' })
  const replaceConfirm = h('div', {
    className: 'row',
    style: 'display:none',
  })
  const file = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
  }) as HTMLInputElement
  let pending: ReturnType<typeof parseBackup> | null = null

  const mergeBtn = h('button', {
    className: 'btn',
    type: 'button',
    disabled: true,
  }, 'Merge') as HTMLButtonElement
  const replaceBtn = h('button', {
    className: 'btn',
    type: 'button',
    disabled: true,
  }, 'Replace') as HTMLButtonElement

  const syncImportButtons = (): void => {
    const ready = Boolean(pending && !pending.fatal)
    mergeBtn.disabled = !ready
    replaceBtn.disabled = !ready
    replaceConfirm.style.display = 'none'
  }

  file.addEventListener('change', async () => {
    const f = file.files?.[0]
    if (!f) {
      pending = null
      preview.textContent = ''
      syncImportButtons()
      return
    }
    const text = await f.text()
    pending = parseBackup(text)
    if (pending.fatal) {
      preview.textContent = `Error — ${pending.errors.join('; ')}`
      syncImportButtons()
      return
    }
    const p = pending.store.profile
    const filled = PROFILE_KEYS.filter((k) => String(p[k]).trim()).length
    preview.textContent = `Preview — profile: ${filled} fields, ${pending.store.formMappings.length} sites, ${pending.store.customAnswers.length} answers.${
      pending.errors.length ? ` Warnings: ${pending.errors.join('; ')}` : ''
    }`
    syncImportButtons()
  })

  mergeBtn.addEventListener('click', () => {
    if (!pending || pending.fatal) return
    void (async () => {
      store = await replaceStore(mergeStores(store, pending!.store))
      pending = null
      file.value = ''
      renderAll()
    })()
  })

  replaceBtn.addEventListener('click', () => {
    if (!pending || pending.fatal) return
    replaceConfirm.style.display = ''
  })

  replaceConfirm.append(
    h('span', null, 'Replace all current data?'),
    h(
      'button',
      {
        className: 'btn danger',
        type: 'button',
        onClick: () => {
          if (!pending || pending.fatal) return
          void replaceStore(pending.store).then((s) => {
            store = s
            pending = null
            file.value = ''
            renderAll()
          })
        },
      },
      'Confirm',
    ),
    h(
      'button',
      {
        className: 'btn',
        type: 'button',
        onClick: () => {
          replaceConfirm.style.display = 'none'
        },
      },
      'Cancel',
    ),
  )

  const confirmInput = h('input', {
    placeholder: 'Type DELETE to confirm',
  }) as HTMLInputElement

  root.append(
    h('div', { className: 'panel-head' }, h('h1', null, 'Backup')),
    h(
      'div',
      { className: 'row' },
      h(
        'button',
        {
          className: 'btn primary',
          type: 'button',
          onClick: () => {
            const blob = new Blob([JSON.stringify(store, null, 2)], {
              type: 'application/json',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `job-fill-backup-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
          },
        },
        'Export JSON',
      ),
      h(
        'button',
        {
          className: 'btn',
          type: 'button',
          onClick: () => file.click(),
        },
        'Import JSON',
      ),
      file,
    ),
    preview,
    h('div', { className: 'row' }, mergeBtn, replaceBtn, h(
      'button',
      {
        className: 'btn',
        type: 'button',
        onClick: () => {
          pending = null
          preview.textContent = ''
          file.value = ''
          syncImportButtons()
        },
      },
      'Cancel',
    )),
    replaceConfirm,
    h('hr'),
    h('h2', null, 'Delete all data'),
    confirmInput,
    h(
      'button',
      {
        className: 'btn danger',
        type: 'button',
        onClick: () => {
          if (confirmInput.value !== 'DELETE') return
          void replaceStore({
            schemaVersion: store.schemaVersion,
            profile: { ...EMPTY_PROFILE },
            formMappings: [],
            customAnswers: [],
            settings: { autofillSites: [], highlightFilled: true },
          }).then((s) => {
            store = s
            confirmInput.value = ''
            renderAll()
          })
        },
      },
      'Delete all data',
    ),
  )
}
