/** Hand-written fixture: fieldset legends and aria radiogroups. */
export const radioGroupsHtml = `
<form id="eligibility">
  <fieldset>
    <legend>Are you legally authorized to work in the United States?</legend>
    <label><input type="radio" name="work_auth" value="yes" /> Yes</label>
    <label><input type="radio" name="work_auth" value="no" /> No</label>
  </fieldset>

  <fieldset>
    <legend>Will you now or in the future require sponsorship?</legend>
    <label><input type="radio" name="sponsor" value="yes" /> Yes</label>
    <label><input type="radio" name="sponsor" value="no" /> No</label>
  </fieldset>

  <div role="radiogroup" aria-labelledby="pref-label">
    <div id="pref-label">Do you prefer remote work?</div>
    <label><input type="radio" name="remote" value="yes" /> Yes</label>
    <label><input type="radio" name="remote" value="no" /> No</label>
  </div>
</form>
`
