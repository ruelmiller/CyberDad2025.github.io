/*
 * Client-side honeypot for the MailerLite KxzppG embedded signup form.
 * No MailerLite setting changes and nothing new is sent to MailerLite:
 *  - The trap input carries form="cdk-hp-none" (an id that does not exist), so it has no
 *    form owner. It is not in form.elements, so MailerLite's webforms.min.js
 *    (jQuery .serialize()) and a native form.submit() both leave it out of the request.
 *  - It sits off-screen inside an aria-hidden wrapper with tabindex="-1" and
 *    autocomplete="off": people don't see it, screen readers don't announce it and
 *    keyboard focus skips it.
 *  - If it has a value at submit time, the submit is stopped in the capture phase,
 *    before MailerLite's own submit handler runs, so no subscribe request is made.
 *    An empty trap changes nothing: the submit proceeds exactly as before.
 */
(function () {
  var SEL = '.ml-embedded[data-form="KxzppG"] form.ml-block-form';
  var n = 0, tries = 0;
  function add() {
    var forms = document.querySelectorAll(SEL);
    for (var i = 0; i < forms.length; i++) {
      var f = forms[i];
      if (f.querySelector('.cdk-hp')) continue;
      var id = 'cdk-hp-' + (++n);
      var w = document.createElement('div');
      w.className = 'cdk-hp';
      w.setAttribute('aria-hidden', 'true');
      w.style.cssText = 'position:absolute!important;left:-10000px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;';
      w.innerHTML = '<label for="' + id + '">Leave this field empty</label>' +
        '<input type="text" id="' + id + '" name="cdk_hp" form="cdk-hp-none" value="" tabindex="-1" autocomplete="off">';
      f.appendChild(w);
    }
    return forms.length;
  }
  var t = setInterval(function () { if (add() || ++tries > 60) clearInterval(t); }, 500);
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.matches || !f.matches(SEL)) return;
    add();
    var hp = f.querySelector('.cdk-hp input');
    if (hp && hp.value) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
})();
