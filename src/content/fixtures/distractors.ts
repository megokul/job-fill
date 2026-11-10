/** Hand-written fixture: false-positive labels and reference sections. */
export const distractorsHtml = `
<form id="distractors">
  <label for="hear">How did you hear about this opportunity?</label>
  <input id="hear" name="source" />

  <label for="ethnicity">Ethnicity</label>
  <input id="ethnicity" name="ethnicity" />

  <label for="statement">Personal statement</label>
  <textarea id="statement" name="statement"></textarea>

  <label for="about">Tell us about yourself</label>
  <textarea id="about" name="about"></textarea>

  <label for="hotel">Hotel preference</label>
  <input id="hotel" name="hotel" />

  <fieldset>
    <legend>Reference</legend>
    <label for="ref-last">Reference last name</label>
    <input id="ref-last" name="ref_last_name" />
    <label for="ref-phone">Reference phone</label>
    <input id="ref-phone" name="ref_phone" />
  </fieldset>

  <fieldset>
    <legend>Emergency contact</legend>
    <label for="em-name">Full name</label>
    <input id="em-name" name="emergency_name" />
    <label for="em-phone">Phone</label>
    <input id="em-phone" name="emergency_phone" />
  </fieldset>
</form>
`
