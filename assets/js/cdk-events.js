/*
 * CyberDadKit GA4 events (Growth tracking plan, launch-ready/tracking-plan.md section 2).
 * Uses the gtag already loaded by _layouts/default.html (G-5B1LNCPB56): no extra gtag/js
 * load and no extra gtag('config'). Loaded once, from _layouts/default.html only.
 * Nothing here blocks, delays or changes a form submit or a link navigation.
 *
 * generate_lead (KxzppG embed): fires only on a successful subscribe. MailerLite's
 *   webforms.min.js calls window.ml_webform_success_29749075() after the subscribe
 *   response says success, so we wrap that function. Invalid and failed submits never
 *   call it, so they are never counted.
 * generate_lead (3ZM1Dn popup): the popup renders in a cross-origin assets.mailerlite.com
 *   iframe, so a submit listener on this page never sees its submit. On success the
 *   popup posts "mlWebformSubmitSuccess-272871" to this window; we count that message
 *   (origin checked). Parameters are exactly the spec's.
 * begin_checkout: capture-phase click on any link to checkout.mailerlite.com, sent with
 *   transport_type beacon so it survives the navigation. Checkout is off today, so no
 *   such link exists on the site yet and this does nothing until one is published.
 */
(function () {
  function ev(name, params) { try { gtag('event', name, params); } catch (e) {} }

  // --- generate_lead: KxzppG embedded form (success only) ---
  var fn = 'ml_webform_success_29749075', tries = 0;
  function wrapSuccess() {
    var orig = window[fn];
    if (typeof orig === 'function' && !orig.__cdk) {
      var wrapped = function () {
        ev('generate_lead', { form_id: 'KxzppG', form_location: 'kit-signup', method: 'mailerlite_embed' });
        return orig.apply(this, arguments);
      };
      wrapped.__cdk = true;
      window[fn] = wrapped;
    }
    return typeof window[fn] === 'function' && window[fn].__cdk === true;
  }
  var t = setInterval(function () {
    if (wrapSuccess() || ++tries > 60) clearInterval(t);
  }, 500);
  // If the embed loads after the 30 s poll, wrap at submit time instead (the success
  // callback always runs after the submit, once MailerLite answers).
  document.addEventListener('submit', function () { wrapSuccess(); }, true);

  // --- generate_lead: 3ZM1Dn popup (success message from its iframe) ---
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://assets.mailerlite.com') return;
    if (e.data === 'mlWebformSubmitSuccess-272871') {
      ev('generate_lead', { form_id: '3ZM1Dn', method: 'mailerlite_popup_attempt' });
    }
  }, false);

  // --- begin_checkout: checkout link clicks (none on the site while checkout is off) ---
  document.addEventListener('click', function (e) {
    var l = e.target && e.target.closest && e.target.closest('a[href*="checkout.mailerlite.com"]');
    if (!l) return;
    ev('begin_checkout', { currency: 'USD', value: 67, transport_type: 'beacon',
      items: [{ item_id: '163449031913113430', item_name: 'CyberDad Shield Kit', price: 67, quantity: 1 }] });
  }, true);
  // --- select_promotion: post kit CTA (M-P1 _includes/kit-cta.html; data-creative-slot = post-top | post-end) ---
  document.addEventListener('click', function (e) { var l = e.target && e.target.closest && e.target.closest('a[data-cdk-event="select_promotion"]'); if (l) ev('select_promotion', { promotion_id: l.getAttribute('data-promotion-id'), promotion_name: l.getAttribute('data-promotion-name'), creative_slot: l.getAttribute('data-creative-slot'), transport_type: 'beacon' }); }, true);
})();
