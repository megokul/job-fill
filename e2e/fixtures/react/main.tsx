import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Select, { type SingleValue } from 'react-select'

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  location: string
  workAuthorized: string
}

const empty: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
  location: '',
  workAuthorized: '',
}

const countryOptions = [
  { value: '14', label: 'Australia' },
  { value: '231', label: 'United States of America' },
]

const LOCATION_OPTIONS = [
  'London, CA',
  'Austin, TX',
  'San Francisco, CA',
  'Remote',
]

function LocationTypeahead(props: {
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  const [text, setText] = useState(props.value)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<string[]>([])

  useEffect(() => {
    setText(props.value)
  }, [props.value])

  useEffect(() => {
    if (!open) {
      setOptions([])
      return
    }
    const timer = window.setTimeout(() => {
      setOptions(LOCATION_OPTIONS)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, text])

  const close = (): void => {
    setOpen(false)
    setOptions([])
  }

  return (
    <div>
      <label htmlFor="location-cb">Location</label>
      <input
        id="location-cb"
        data-testid="location"
        role="combobox"
        aria-controls="location-list"
        aria-expanded={open}
        aria-autocomplete="list"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setText(props.value)
            close()
          }
        }}
      />
      <div
        id="location-list"
        role="listbox"
        hidden={!open || options.length === 0}
      >
        {options.map((opt) => (
          <div
            key={opt}
            role="option"
            data-value={opt}
            onMouseDown={(e) => {
              e.preventDefault()
              setText(opt)
              props.onChange(opt)
              close()
            }}
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  )
}

function YesNoListbox(props: {
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const label =
    props.value === 'yes' ? 'Yes' : props.value === 'no' ? 'No' : 'Select…'

  return (
    <div>
      <span id="wa-label">Are you legally authorized to work in the United States?</span>
      <button
        type="button"
        id="wa-btn"
        data-testid="workAuthorized"
        aria-haspopup="listbox"
        aria-labelledby="wa-label"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        {label}
      </button>
      {open ? (
        <div id="wa-list" role="listbox">
          {['Yes', 'No'].map((opt) => (
            <div
              key={opt}
              role="option"
              data-value={opt.toLowerCase()}
              onMouseDown={(e) => {
                e.preventDefault()
                props.onChange(opt.toLowerCase())
                setOpen(false)
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function App(): React.ReactElement {
  const [state, setState] = useState<FormState>(empty)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const errors = useMemo(() => {
    const next: Record<string, string> = {}
    if (touched.email && !state.email.includes('@')) {
      next.email = 'Required email'
    }
    if (touched.firstName && !state.firstName.trim()) {
      next.firstName = 'Required'
    }
    return next
  }, [state, touched])

  const set =
    (key: keyof FormState) =>
    (value: string): void => {
      setState((prev) => ({ ...prev, [key]: value }))
    }

  const countryValue =
    countryOptions.find((o) => o.value === state.country) ?? null

  return (
    <div>
      <h1>React apply</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <label>
          First name
          <input
            data-testid="firstName"
            value={state.firstName}
            onChange={(e) => set('firstName')(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
          />
        </label>
        {errors.firstName ? <div>{errors.firstName}</div> : null}

        <label>
          Last name
          <input
            data-testid="lastName"
            value={state.lastName}
            onChange={(e) => set('lastName')(e.target.value)}
          />
        </label>

        <label>
          Email
          <input
            data-testid="email"
            type="email"
            value={state.email}
            onChange={(e) => set('email')(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          />
        </label>
        {errors.email ? <div>{errors.email}</div> : null}

        <label>
          Phone
          <input
            data-testid="phone"
            value={state.phone}
            onChange={(e) => set('phone')(e.target.value)}
          />
        </label>

        <label htmlFor="country-select">Country</label>
        <div data-testid="country">
          <Select
            inputId="country-select"
            options={countryOptions}
            value={countryValue}
            placeholder="Select…"
            classNamePrefix="country-select"
            onChange={(opt: SingleValue<(typeof countryOptions)[number]>) => {
              set('country')(opt?.value ?? '')
            }}
          />
        </div>

        <LocationTypeahead
          value={state.location}
          onChange={set('location')}
        />

        <YesNoListbox
          value={state.workAuthorized}
          onChange={set('workAuthorized')}
        />
      </form>
      <pre data-testid="state">{JSON.stringify(state)}</pre>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
