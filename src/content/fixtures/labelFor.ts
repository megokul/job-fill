/** Hand-written fixture: label[for] + autocomplete attributes. */
export const labelForHtml = `
<form id="apply">
  <label for="given">First name</label>
  <input id="given" name="given-name" autocomplete="given-name" />

  <label for="family">Last name</label>
  <input id="family" name="family-name" autocomplete="family-name" />

  <label for="mail">Email address</label>
  <input id="mail" type="email" name="email" autocomplete="email" />

  <label for="tel">Phone number</label>
  <input id="tel" type="tel" name="phone" autocomplete="tel" />

  <label for="addr1">Street address</label>
  <input id="addr1" name="address1" autocomplete="address-line1" />

  <label for="addr2">Apartment, suite, etc.</label>
  <input id="addr2" name="address2" autocomplete="address-line2" />

  <label for="city">City</label>
  <input id="city" name="city" autocomplete="address-level2" />

  <label for="state">State / Province</label>
  <input id="state" name="state" autocomplete="address-level1" />

  <label for="zip">Postal code</label>
  <input id="zip" name="zip" autocomplete="postal-code" />

  <label for="country">Country</label>
  <input id="country" name="country" autocomplete="country-name" />

  <label for="li">LinkedIn URL</label>
  <input id="li" name="linkedin" autocomplete="url" />

  <label for="site">Personal website</label>
  <input id="site" name="website" autocomplete="url" />
</form>
`
