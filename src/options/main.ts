import {
  deleteFieldMapping,
  deleteFormMapping,
  getStore,
  saveFormMapping,
  saveProfile,
  saveSettings,
} from '../shared/storage'
import {
  EMPTY_PROFILE,
  PROFILE_KEYS,
  PROFILE_LABELS,
  type FormMapping,
  type Profile,
  type ProfileKey,
  type Settings,
  type Store,
  type YesNo,
} from '../shared/types'

const profileForm = document.getElementById('profile-form')!
const saveProfileBtn = document.getElementById('save-profile')!
const resetProfileBtn = document.getElementById('reset-profile')!
const profileStatus = document.getElementById('profile-status')!
const autofillOnLoad = document.getElementById('autofill-on-load') as HTMLInputElement
const highlightFilled = document.getElementById('highlight-filled') as HTMLInputElement
const saveSettingsBtn = document.getElementById('save-settings')!
const settingsStatus = document.getElementById('settings-status')!
const mappingsList = document.getElementById('mappings-list')!
const mappingsStatus = document.getElementById('mappings-status')!
const exportBtn = document.getElementById('export-btn')!
const importInput = document.getElementById('import-input') as HTMLInputElement

const YES_NO_KEYS = new Set<ProfileKey>(['workAuthorized', 'requiresSponsorship'])
const FULL_WIDTH = new Set<ProfileKey>([
  'addressLine1',
  'addressLine2',
  'linkedinUrl',
  'portfolioUrl',
])

void init()

async function init(): Promise<void> {
  buildProfileFields()
  const store = await getStore()
  fillProfileForm(store.profile)
  fillSettings(store.settings)
  renderMappings(store.formMappings)

  saveProfileBtn.addEventListener('click', () => {
    void onSaveProfile()
  })
  resetProfileBtn.addEventListener('click', () => {
    fillProfileForm(EMPTY_PROFILE)
    profileStatus.textContent = 'Form reset (not saved yet).'
  })
  saveSettingsBtn.addEventListener('click', () => {
    void onSaveSettings()
  })
  exportBtn.addEventListener('click', () => {
    void onExport()
  })
  importInput.addEventListener('change', () => {
    void onImport()
  })
}

function buildProfileFields(): void {
  profileForm.innerHTML = PROFILE_KEYS.map((key) => {
    const label = PROFILE_LABELS[key]
    const full = FULL_WIDTH.has(key) ? ' full' : ''
    if (YES_NO_KEYS.has(key)) {
      return `
        <div class="field${full}">
          <label for="field-${key}">${label}</label>
          <select id="field-${key}" name="${key}">
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>`
    }
    const inputType =
      key === 'email' ? 'email' : key.endsWith('Url') ? 'url' : key === 'phone' ? 'tel' : 'text'
    return `
      <div class="field${full}">
        <label for="field-${key}">${label}</label>
        <input id="field-${key}" name="${key}" type="${inputType}" autocomplete="off" />
      </div>`
  }).join('')
}

function fillProfileForm(profile: Profile): void {
  for (const key of PROFILE_KEYS) {
    const el = document.getElementById(`field-${key}`) as
      | HTMLInputElement
      | HTMLSelectElement
      | null
    if (el) el.value = profile[key] ?? ''
  }
}

function readProfileForm(): Profile {
  const get = (key: ProfileKey): string => {
    const el = document.getElementById(`field-${key}`) as
      | HTMLInputElement
      | HTMLSelectElement
    return el.value.trim()
  }

  const yesNo = (key: ProfileKey): YesNo => {
    const value = get(key)
    return value === 'yes' || value === 'no' ? value : ''
  }

  return {
    firstName: get('firstName'),
    lastName: get('lastName'),
    email: get('email'),
    phone: get('phone'),
    addressLine1: get('addressLine1'),
    addressLine2: get('addressLine2'),
    city: get('city'),
    state: get('state'),
    postalCode: get('postalCode'),
    country: get('country'),
    linkedinUrl: get('linkedinUrl'),
    portfolioUrl: get('portfolioUrl'),
    workAuthorized: yesNo('workAuthorized'),
    requiresSponsorship: yesNo('requiresSponsorship'),
    salaryExpectation: get('salaryExpectation'),
  }
}

function fillSettings(settings: Settings): void {
  autofillOnLoad.checked = settings.autofillOnLoad
  highlightFilled.checked = settings.highlightFilled
}

async function onSaveProfile(): Promise<void> {
  const profile = readProfileForm()
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    profileStatus.textContent = 'Email looks invalid.'
    return
  }
  for (const key of ['linkedinUrl', 'portfolioUrl'] as const) {
    const value = profile[key]
    if (value && !/^https?:\/\//i.test(value)) {
      profileStatus.textContent = `${PROFILE_LABELS[key]} should start with http(s)://`
      return
    }
  }
  await saveProfile(profile)
  profileStatus.textContent = 'Profile saved.'
}

async function onSaveSettings(): Promise<void> {
  await saveSettings({
    autofillOnLoad: autofillOnLoad.checked,
    highlightFilled: highlightFilled.checked,
  })
  settingsStatus.textContent = 'Settings saved.'
}

function renderMappings(mappings: FormMapping[]): void {
  if (mappings.length === 0) {
    mappingsList.innerHTML =
      '<p class="empty">No saved mappings yet. Open a job form, then use Map this form from the popup.</p>'
    return
  }

  const sorted = [...mappings].sort((a, b) => b.updatedAt - a.updatedAt)
  mappingsList.innerHTML = sorted
    .map((m) => {
      const fields = m.fields
        .map(
          (f) => `
          <li>
            <span><strong>${escapeHtml(PROFILE_LABELS[f.profileKey])}</strong>
              <span style="color:#64748b"> — ${escapeHtml(f.match.label || f.match.name || f.selector || '')}</span>
            </span>
            <button type="button" class="btn danger" data-del-field data-form="${m.id}" data-field="${f.id}">Remove</button>
          </li>`,
        )
        .join('')

      return `
        <article class="mapping" data-id="${m.id}">
          <div class="mapping-head">
            <div>
              <h3>${escapeHtml(m.name)}</h3>
              <p class="meta">${escapeHtml(m.origin)}${escapeHtml(m.pathPattern)}</p>
            </div>
            <button type="button" class="btn danger" data-del-form="${m.id}">Delete</button>
          </div>
          <div class="mapping-edit">
            <input data-edit-name="${m.id}" value="${escapeAttr(m.name)}" aria-label="Mapping name" />
            <input data-edit-path="${m.id}" value="${escapeAttr(m.pathPattern)}" aria-label="Path pattern" />
            <button type="button" class="btn" data-save-meta="${m.id}">Update</button>
          </div>
          <ul class="mapping-fields">${fields || '<li>No fields</li>'}</ul>
        </article>`
    })
    .join('')

  mappingsList.querySelectorAll('[data-del-form]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.delForm!
      void (async () => {
        const store = await deleteFormMapping(id)
        renderMappings(store.formMappings)
        mappingsStatus.textContent = 'Mapping deleted.'
      })()
    })
  })

  mappingsList.querySelectorAll('[data-del-field]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement
      void (async () => {
        const store = await deleteFieldMapping(el.dataset.form!, el.dataset.field!)
        renderMappings(store.formMappings)
        mappingsStatus.textContent = 'Field mapping removed.'
      })()
    })
  })

  mappingsList.querySelectorAll('[data-save-meta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.saveMeta!
      void (async () => {
        const store = await getStore()
        const mapping = store.formMappings.find((m) => m.id === id)
        if (!mapping) return
        const nameInput = mappingsList.querySelector(
          `[data-edit-name="${id}"]`,
        ) as HTMLInputElement
        const pathInput = mappingsList.querySelector(
          `[data-edit-path="${id}"]`,
        ) as HTMLInputElement
        const next: FormMapping = {
          ...mapping,
          name: nameInput.value.trim() || mapping.name,
          pathPattern: pathInput.value.trim() || '/',
          updatedAt: Date.now(),
        }
        const updated = await saveFormMapping(next)
        renderMappings(updated.formMappings)
        mappingsStatus.textContent = 'Mapping updated.'
      })()
    })
  })
}

async function onExport(): Promise<void> {
  const store = await getStore()
  const blob = new Blob([JSON.stringify(store, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `job-fill-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  mappingsStatus.textContent = 'Exported.'
}

async function onImport(): Promise<void> {
  const file = importInput.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as Partial<Store>
    if (parsed.profile) await saveProfile({ ...EMPTY_PROFILE, ...parsed.profile })
    if (parsed.settings) {
      await saveSettings({
        autofillOnLoad: Boolean(parsed.settings.autofillOnLoad),
        highlightFilled: parsed.settings.highlightFilled !== false,
      })
    }
    if (Array.isArray(parsed.formMappings)) {
      for (const mapping of parsed.formMappings) {
        if (mapping?.id && mapping?.origin && Array.isArray(mapping.fields)) {
          await saveFormMapping(mapping as FormMapping)
        }
      }
    }
    const store = await getStore()
    fillProfileForm(store.profile)
    fillSettings(store.settings)
    renderMappings(store.formMappings)
    mappingsStatus.textContent = 'Import complete.'
  } catch {
    mappingsStatus.textContent = 'Import failed — invalid JSON.'
  } finally {
    importInput.value = ''
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}
