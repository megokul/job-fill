import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  workAuthorized: string
}

const empty: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
  workAuthorized: '',
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

        <label>
          Country
          <select
            data-testid="country"
            value={state.country}
            onChange={(e) => set('country')(e.target.value)}
          >
            <option value="">Select…</option>
            <option value="14">Australia</option>
            <option value="231">United States of America</option>
          </select>
        </label>

        <fieldset>
          <legend>Are you legally authorized to work in the United States?</legend>
          <label>
            <input
              type="radio"
              name="workAuthorized"
              value="yes"
              checked={state.workAuthorized === 'yes'}
              onChange={() => set('workAuthorized')('yes')}
            />{' '}
            Yes
          </label>
          <label>
            <input
              type="radio"
              name="workAuthorized"
              value="no"
              checked={state.workAuthorized === 'no'}
              onChange={() => set('workAuthorized')('no')}
            />{' '}
            No
          </label>
        </fieldset>
      </form>
      <pre data-testid="state">{JSON.stringify(state)}</pre>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
