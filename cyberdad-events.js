// GA4 Event Tracking for CyberDadKit Blog
window.addEventListener("DOMContentLoaded", function () {

  // 1. $2 Checklist Clicks
  const checklistLinks = document.querySelectorAll("a[href*='checklist']");
  checklistLinks.forEach(link => {
    link.addEventListener("click", () => {
      gtag('event', 'click_checklist', {
        event_category: 'Product Click',
        event_label: 'Cyber Dad $2 Checklist'
      });
    });
  });

  // 2. Free PDF Download
  const pdfLinks = document.querySelectorAll("a[href$='.pdf']");
  pdfLinks.forEach(link => {
    link.addEventListener("click", () => {
      gtag('event', 'download_pdf', {
        event_category: 'Free Resource',
        event_label: 'Cyber Dad Free PDF'
      });
    });
  });

  // 3. Freebie Signup Link (MailerLite)
  const signupLinks = document.querySelectorAll("a[href*='subscribe'], a[href*='mailerlite']");
  signupLinks.forEach(link => {
    link.addEventListener("click", () => {
      gtag('event', 'signup_click', {
        event_category: 'Lead Capture',
        event_label: 'Cyber Dad Freebie Signup'
      });
    });
  });

});
