/** Hand-written fixture: country/state selects and yes/no select. */
export const selectsHtml = `
<form id="geo">
  <label for="country">Country</label>
  <select id="country" name="country">
    <option value="">Select…</option>
    <option value="36">Australia</option>
    <option value="124">Canada</option>
    <option value="826">United Kingdom</option>
    <option value="840">United States</option>
  </select>

  <label for="state">State</label>
  <select id="state" name="state">
    <option value="">Select…</option>
    <option value="american-samoa">American Samoa</option>
    <option value="california">California</option>
    <option value="new-york">New York</option>
    <option value="texas">Texas</option>
  </select>

  <label for="auth">Authorized to work?</label>
  <select id="auth" name="work_authorized">
    <option value="">Select…</option>
    <option value="1">Affirmative</option>
    <option value="0">Negative</option>
  </select>
</form>
`
