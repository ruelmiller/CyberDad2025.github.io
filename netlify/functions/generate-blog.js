exports.handler = async (event, context) => {
  const { Octokit } = require("@octokit/rest");
  
  try {
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // Get current time in EST/EDT
    const now = new Date();
    const estOffset = -5; // EST is UTC-5
    const estTime = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    // Format: YYYY-MM-DD HH:MM:SS -0500
    const year = estTime.getFullYear();
    const month = String(estTime.getMonth() + 1).padStart(2, '0');
    const day = String(estTime.getDate()).padStart(2, '0');
    const hours = String(estTime.getHours()).padStart(2, '0');
    const minutes = String(estTime.getMinutes()).padStart(2, '0');
    const seconds = String(estTime.getSeconds()).padStart(2, '0');
    
    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}:${minutes}:${seconds}`;
    const fullTimestamp = `${dateStr} ${timeStr} -0500`;
    
    const fileName = `${dateStr}-${generateSlug()}.md`;
    const post = generateUltraReadablePost(fullTimestamp);

    // Claims guardrail (R5, mirrors R1's main.py / generator rules): never publish a post that breaks the owner-approved claims.
    const violations = claimsGuard(post);
    if (violations.length) {
      return {
        statusCode: 422,
        body: JSON.stringify({ success: false, message: 'Post blocked by claims guardrail; nothing committed', violations, filename: fileName })
      };
    }
    
    // Check if file already exists
    try {
      await octokit.rest.repos.getContent({
        owner: 'CyberDad2025',
        repo: 'CyberDad2025.github.io',
        path: `_posts/${fileName}`
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Post already exists',
          filename: fileName,
          timestamp: fullTimestamp
        })
      };
    } catch (error) {
      // File doesn't exist, create it
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: 'CyberDad2025',
      repo: 'CyberDad2025.github.io',
      path: `_posts/${fileName}`,
      message: `Add readable post ${fileName}`,
      content: Buffer.from(post).toString('base64'),
      branch: 'main'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Ultra-readable post created successfully',
        filename: fileName,
        timestamp: fullTimestamp
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Owner-approved claims only (claims-audit 2026-10-20): U.S. Marine Corps veteran, active CompTIA Security+, PAST hands-on SOC experience.
// Blocks: current-SOC wording, employer names, "expert"/"professional"/"pro" wording, years/durations of experience,
// any child age/gender/count, toddler-show names, a kit price other than $67, kit links other than /#kit, retired stores/checkout,
// and any MailerLite form other than KxzppG.
const CLAIMS_RULES = [
  ['current-SOC wording', /\bSOC analyst\b|\bincident responder\b|\b(?:I|he) (?:currently )?works? (?:in|at|for) (?:a |the )?SOC\b|\bby day I'?m\b|\bcurrent(?:ly)? (?:a |an )?(?:SOC|security) analyst\b/i],
  ['employer name', /L3 ?Harris|\bFAA\b|Federal Aviation|Lockheed|Raytheon|Northrop|Booz Allen|Leidos|\bSAIC\b|\bCACI\b|ManTech|General Dynamics|Peraton/i],
  ['expert/pro wording', /\bexperts?\b|\bexpertise\b|\bprofessionals?\b|\bpro\b/i],
  ['years/duration of experience', /\b\d+\+?\s*(?:years?|yrs?|months?)\s+(?:of\s+)?(?:experience|in (?:the )?(?:field|industry|cyber\w*|security|SOC))\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty)[- ](?:to[- ]\w+[- ])?(?:years?|months?)\s+(?:of\s+)?experience\b|\b\d+-year (?:veteran|career)\b/i],
  ['child age/gender/count', /\bmy (?:own )?(?:son|sons|daughter|daughters|kid|kids|child|children|boy|girl|toddler|teen|teenager|tween|little one|youngest|oldest)\b|\bour (?:son|sons|daughter|daughters|kids|children)\b|\b(?:dad|father|parent) of (?:one|two|three|four|five|\d)\b|\bmy \w+[- ]year[- ]old\b|\b\d+[- ]year[- ]old\b|\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}[^\n]*\bages\b/iu],
  ['toddler-show name', /CocoMelon|Blippi|Peppa Pig|Bluey|Paw Patrol|Ms\.? Rachel|Baby Shark|Pinkfong|Daniel Tiger/i],
  ['kit price not $67', /(?:Shield Kit|CyberDad Kit|the kit)[^\n.]{0,60}\$(?!67\b)\d+|\$(?!67\b)\d+[^\n.]{0,30}(?:Shield Kit|CyberDad Kit)/i],
  ['kit link not /#kit', /\/shield-kit\b|gumroad\.com|etsy\.com\/shop\/CyberDadPrints|checkout\.mailerlite\.com/i],
  // R9 (2026-10-21): unverified statistics. No sourced numbers exist for any of these, so block them outright.
  ['unverified stat: N% of families/parents', /\b\d{1,3}(?:\.\d+)?\s?%\s+of\s+(?:all\s+)?(?:families|parents|households|kids|children|teens|users|people|Americans)\b/i],
  ['unverified stat: attacks increased N%', /\b(?:cyber[- ]?)?(?:attacks?|threats?|incidents?|scams?|breaches|crimes?)\b[^.!?\n]{0,80}?\b(?:increased|increase|risen|rose|grown|grew|surged|jumped|spiked|up)\s+(?:by\s+)?(?:over\s+|more than\s+)?\d+(?:\.\d+)?\s?%|\b(?:increased|risen|grown|surged|jumped)\s+(?:by\s+)?\d+(?:\.\d+)?\s?%\s+(?:this|last|in the past|over the past|per)\s+year/i],
  ['unverified stat: trusted by a crowd (millions/thousands)', /\btrusted by (?:millions|thousands|hundreds|tens of thousands|over\s+\d|more than\s+\d|\d)/i],
  // R9d (CoS 2026-10-21): uncited 'N in M teens/kids/children/parents/families' ratios. Allowed only when the same line links its source (URL, markdown link, <a href> or 'Source:').
  ['unverified stat: N in M teens/kids/parents', /^(?![^\n]*(?:https?:\/\/|\]\(|<a\s[^>]*href=|\bsources?:))[^\n]*?\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:in|out of)\s+(?:every\s+)?(?:[2-9]|\d{2,}|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z.]+\s+)?(?:teens?|teenagers?|tweens?|kids?|children|child|youths?|parents?|families|family|households?)\b/im],
  // R9f (CoS + Product 2026-10-21): age-range badges ('ages 4-99', 'All ages (8-99)') are not backed by kit v3.4; reading time must not be a hardcoded number.
  ['unverified age-range badge: ages N-99', /\bages?\s*\(?\d{1,2}\s*(?:-|–|to)\s*99\b/i],
  ['hardcoded reading time: Takes N minutes to read', /\btakes?\s+\d+\s*(?:-\s*\d+\s*)?(?:minutes?|mins?)\s+to\s+read\b/i],
  // R9g (CoS 2026-10-21): uncited research/study attribution ('according to a (recent) study', 'studies + show', 'research + suggests', 'experts + say'); allowed only when the same line links its source (URL, markdown link, <a href> or 'Source:'). Plus 'Real' + 'Statistics' headings.
  ['uncited research/study attribution', /^(?![^\n]*(?:https?:\/\/|\]\(|<a\s[^>]*href=|\bsources?:))[^\n]*?\b(?:according to (?:a |an |the )?(?:recent |new |latest |\d{4} )?(?:cybersecurity |cyber |security |safety |online safety |industry |internet |crime )?(?:study|studies|survey|surveys|report|reports|research|statistics|stats|data|experts?)|(?:stud(?:y|ies)|surveys?|research|reports?|statistics|data) (?:shows?|suggests?|has shown|have shown|found|finds|indicates?|reveals?|revealed|confirms?)|experts? (?:say|says|agree|agrees|warn|warns|estimate|estimates|believe)|in a recent (?:study|survey|report))\b/im],
  ['"Real Statistics" heading', /\breal statistics\b|\bstatistics and (?:current )?trends\b/i],
  // R9h (CoS + Product 2026-10-21): no time or benefit promises in posts (setup time 'less than N min', 'N min or less', multi-year protection).
  ['time promise: less than N minutes', /\bless than \d+\s*(?:minutes?|mins?)\b/i],
  ['time promise: N Minutes or Less', /\b\d+\s*(?:minutes?|mins?)\s+or\s+less\b/i],
  ['benefit promise: "years of ... protection"', /\byears of (?:family )?protection\b/i],
  // R9i (CoS 2026-10-21): uncited minute promises in a title or heading (front matter title/seo_title/og_title, markdown headings, <h1>-<h6>).
  // Covers in/under/within/takes/only/just + N minutes, and hyphenated N-minute + fix/setup/check/guide/...; a source link on the line exempts it. Kit phrase allowed: 'one 15-minute Quick Action'.
  ['time promise in title/heading: in N minutes', /^(?![^\n]*(?:https?:\/\/|\]\(|<a\s[^>]*href=|\bsources?:))(?:[ \t]*(?:seo_title|og_title|title)[ \t]*:|[ \t]*#{1,6}[ \t]|[^\n]*<h[1-6]\b[^>]*>)[^\n]*?(?:\b(?:in|under|within|takes?|taking|only|just)[ \t]+(?:about[ \t]+|around[ \t]+|less[ \t]+than[ \t]+)?(?:\d+|one|two|three|four|five|ten|fifteen|twenty|thirty|sixty)[ \t]*-?[ \t]*(?:minutes?|mins?)\b|\b(?!(?<=\bone )15-minute Quick Action\b)(?:\d+|one|two|three|four|five|ten|fifteen|twenty|thirty|sixty)[ \t]*-[ \t]*minutes?[ \t]+(?:[\w'-]+[ \t]+){0,2}?(?:fix|fixes|setup|set-up|check|checks|checkup|check-up|guide|plan|audit|lockdown|makeover|routine|task|tasks|action|actions|tune-up|upgrade|challenge|habit|habits|tip|tips|win|wins|reset|review|walkthrough|tutorial|security|protection|lesson)\b)/im],
  // R9n (CoS + Product M-D7, 2026-10-21): mirrors main.py. Every minute phrase is a time promise except the allowed kit lines
  // ('15-minute Quick Action', 'Wait 10 minutes, then check your Spam/Junk folder') and a computed 'N min read'; 'tonight'/'instant' wording;
  // unsourced figures (allowed only when the same line links its source).
  // R9 (F, CoS 2026-10-21): minute rule also blocks 'a minute' and 'in/within seconds' (mirrors main.py).
  ['time promise: N minutes (outside the allowed kit lines)', /^(?![^\n]*(?:15-minute Quick Action|Wait 10 minutes, then check your Spam\/Junk folder))[^\n]*?(?:\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty-five|sixty|a few|few|several|a couple of|a)[ \t]*-?[ \t]*(?:minutes?|mins?)\b(?![ \t]+read\b)|\b(?:within|in)[ \t]+(?:minutes|seconds)\b)/im],
  ['\'tonight\'/\'instant\' wording', /\b(?:tonight|instant|instantly)\b/i],
  ['unsourced figure (no source on the line)', /^(?![^\n]*(?:https?:\/\/|\]\(|<a\s[^>]*href=|\bsources?:))[^\n]*?(?:\b\d{1,3}(?:\.\d+)?[ \t]?(?:%|percent)[ \t]+(?:of[ \t]+(?:all[ \t]+)?(?:[\w-]+[ \t]+){0,2}?(?:phishing|scams?|attacks?|breaches|hacks?|accounts?|passwords?|devices?|routers?|cases|incidents|threats|victims|users|people|families|parents|kids|children|teens|households|americans|emails?|wins|attempts|malware|ransomware|data)\b|(?:more|less|fewer|higher|lower|likelier)\b)|\b(?:prevents?|stops?|blocks?|reduces?|cuts?|eliminates?)[ \t]+(?:up[ \t]+to[ \t]+|over[ \t]+|about[ \t]+|nearly[ \t]+|almost[ \t]+)?\d{1,3}(?:\.\d+)?[ \t]?(?:%|percent)|\$[ \t]?\d[\d,.]*[ \t]*(?:million|billion|trillion)\b|\b\d[\d,.]*[ \t]*(?:million|billion)[ \t]+(?:people|users|americans|families|kids|children|teens|accounts|records|households|victims|attacks|scams)\b)/im],
  ['author-claim word in title/meta/author line', /^(?:title|description|excerpt|summary|author|seo_title):.*\b(?:experts?|expertise|pros?|professionals?|professional-grade|certified expert)\b|^#\s.*\b(?:experts?|expertise|pros?|professionals?)\b/im],
  ['MailerLite form not KxzppG', /data-form="(?!KxzppG")[^"]*"/]
];
function claimsGuard(text) {
  const out = [];
  for (const [name, re] of CLAIMS_RULES) { const m = text.match(re); if (m) out.push(`${name}: "${m[0]}"`); }
  return out;
}

function generateSlug() {
  const topics = [
    'simple-password-safety',
    'easy-wifi-protection',
    'avoid-bad-emails',
    'safe-internet-browsing',
    'protect-your-phone',
    'family-computer-safety',
    'kids-online-safety',
    'grandparent-tech-security',
    'easy-backup-guide',
    'simple-privacy-tips',
    'safe-social-media',
    'prevent-online-scams',
    'easy-antivirus-guide',
    'simple-two-factor-auth',
    'safe-online-shopping'
  ];
  
  return topics[Math.floor(Math.random() * topics.length)];
}

function generateUltraReadablePost(timestamp) {
  const templates = [
    {
      title: "🔒 Keep Your Passwords Safe - Super Easy Guide",
      summary: "Learn how to make strong passwords that protect your accounts, explained in simple steps anyone can follow.",
      content: `## 🎯 What You'll Learn Today

By the end of this guide, you'll know how to create passwords that keep the bad guys out of your accounts.

## 🤔 Why Do Passwords Matter?

Think of your password like the key to your house. If someone gets your key, they can get inside and take your stuff. Same with your computer accounts!

**Here's what happens with bad passwords:**
- ❌ Bad people can read your emails
- ❌ They can steal your money
- ❌ They can pretend to be you online
- ❌ They can see your personal photos

**Here's what happens with good passwords:**
- ✅ Your accounts stay safe
- ✅ Only you can get in
- ✅ Your information stays private
- ✅ You sleep better at night

## 🔑 The 3 Rules for Safe Passwords

### Rule #1: Make It Long
**Good:** MyFavoriteIceCreamIsChocolate2024!
**Bad:** abc123

**Why longer is better:**
- Harder for computers to guess
- Takes longer to break
- More characters = more protection

### Rule #2: Use Different Passwords for Different Things
**Think of it like this:**
- Your house key is different from your car key
- Your bank password should be different from your email password
- If someone gets one password, they can't get into everything

### Rule #3: Mix It Up
**Use all of these:**
- CAPITAL LETTERS (A, B, C)
- small letters (a, b, c)
- Numbers (1, 2, 3)
- Special characters (!, @, #)

## 🛠️ How to Make a Great Password (Step by Step)

### Step 1: Pick a Sentence You'll Remember
Example: "My family loves pizza every Friday night!"

### Step 2: Make It Into a Password
- **Start with:** My family loves pizza every Friday night!
- **Add numbers:** My family loves pizza every Friday night 2024!
- **Mix capitals:** My Family Loves Pizza Every Friday Night 2024!
- **Add symbols:** My-Family-Loves-Pizza-Every-Friday-Night-2024!

### Step 3: Test Your Password
**Ask yourself:**
- Is it at least 12 characters long? ✅
- Does it have capital and small letters? ✅
- Does it have numbers? ✅
- Does it have special characters? ✅
- Will I remember it? ✅

## 🎯 Quick Password Tips

### ✅ DO These Things:
- Use a different password for each account
- Write passwords down in a safe place (not on your computer)
- Change passwords if you think someone might know them
- Use a password manager if you're comfortable with technology

### ❌ DON'T Do These Things:
- Use your birthday or your pet's name
- Use the same password everywhere
- Share your passwords with strangers
- Write passwords on sticky notes near your computer

## 🔧 Password Manager - Your Digital Helper

**What is it?**
A password manager is like a safe for your passwords. It remembers all your passwords so you don't have to.

**Popular options:**
- **1Password** - Great for families
- **Bitwarden** - Free and secure
- **LastPass** - Easy to use

**How it works:**
1. You remember ONE master password
2. The app remembers all your other passwords
3. It fills them in automatically when you need them

## 🚨 Warning Signs Someone Got Your Password

**Watch for these clues:**
- Emails you didn't send
- Messages from friends saying you sent weird stuff
- Money missing from your accounts
- Can't log into your accounts anymore

**If this happens:**
1. Don't panic
2. Change your password immediately
3. Check all your accounts
4. Tell your bank or credit card company

## 👨‍👩‍👧‍👦 Family Password Safety

### For Parents:
- Teach kids to never share passwords
- Help them create strong passwords
- Check their accounts regularly
- Set up parental controls

### For Kids:
- Never tell anyone your password (except mom and dad)
- Always ask before creating new accounts
- Tell an adult if something weird happens online

### For Grandparents:
- Write passwords down in a notebook (keep it safe)
- Ask family for help setting up accounts
- Don't be afraid to ask questions
- It's okay to go slow and learn gradually

## 🎉 You Did It!

Congratulations! You now know how to create passwords that keep you safe online. Remember:

1. **Long passwords are strong passwords**
2. **Different passwords for different accounts**
3. **Mix letters, numbers, and symbols**
4. **Keep them secret and safe**

**Your security is important, and you're doing great by learning these skills!**

---

*💡 **Remember:** If you're ever confused or need help, ask a tech-savvy family member or friend. We're all learning together!*`
    },
    {
      title: "📶 Make Your Home WiFi Super Safe - Easy Steps",
      summary: "Simple steps to protect your home internet so bad people can't get in, explained in words everyone can understand.",
      content: `## 🎯 What You'll Learn Today

You'll learn how to make your home WiFi network safe from bad people who want to steal your information.

## 🤔 What is WiFi and Why Protect It?

**WiFi is like a bridge:**
- It connects your devices to the internet
- Your phone, computer, and tablet all use it
- If it's not protected, strangers can use it
- They might steal your personal information

**Think of it like your front door:**
- You wouldn't leave your front door wide open
- You lock it to keep strangers out
- WiFi needs a "lock" too

## 🔐 The 5 Simple Steps to Safe WiFi

### Step 1: Change the Default Password
**What this means:**
- Your router comes with a simple password like "password123"
- Everyone knows these default passwords
- You need to change it to something only you know

**How to do it:**
1. Look at the sticker on your router
2. Write down the web address (like 192.168.1.1)
3. Type that address in your web browser
4. Log in with the default username and password
5. Look for "WiFi Password" or "Network Password"
6. Change it to something strong (follow our password rules!)

### Step 2: Give Your Network a New Name
**What this means:**
- Your WiFi probably has a name like "NETGEAR_123"
- This tells bad people what type of router you have
- Change it to something fun but not personal

**Good names:**
- FlowersAndCoffee
- BookLoversHouse
- Pizza4Everyone

**Bad names:**
- JohnSmith123 (your real name)
- 123MainStreet (your address)
- Default names that came with the router

### Step 3: Turn On WPA3 (or WPA2) Security
**What this means:**
- This is like putting a strong lock on your WiFi
- It scrambles your information so bad people can't read it
- It's usually in your router settings under "Security"

**Look for these options:**
- ✅ WPA3 (newest and best)
- ✅ WPA2 (older but still good)
- ❌ WEP (old and dangerous)
- ❌ Open/No security (very dangerous)

### Step 4: Update Your Router Regularly
**What this means:**
- Router companies fix security problems
- You need to install these fixes
- It's like updating your phone apps

**How to do it:**
1. Check your router's web page monthly
2. Look for "Firmware Update" or "Router Update"
3. Click "Check for Updates"
4. Install any updates it finds
5. Some routers update automatically (even better!)

### Step 5: Create a Guest Network
**What this means:**
- This is a separate WiFi for visitors
- They can use internet but can't see your devices
- Keeps your main network private

**How it helps:**
- Friends can connect without knowing your main password
- If their device has problems, it won't affect yours
- You can turn it off when no one is visiting

## 🔍 How to Check If Your WiFi is Safe

### Monthly Safety Check:
1. **Look at connected devices**
   - Count how many devices should be connected
   - Remove any you don't recognize

2. **Check your internet speed**
   - If it's suddenly slow, someone might be using it
   - Run a speed test at speedtest.net

3. **Review your settings**
   - Make sure security is still turned on
   - Check that your password hasn't changed

### Warning Signs Someone is Using Your WiFi:
- ❌ Internet is much slower than usual
- ❌ You see devices you don't recognize
- ❌ Your data usage is higher than normal
- ❌ Strange pop-ups or ads on your devices

## 🛡️ Extra Protection Tips

### For Advanced Users:
- **Turn off WPS** (WiFi Protected Setup) - it's not secure
- **Use MAC address filtering** for important devices
- **Change the admin password** for your router settings
- **Turn off remote management** unless you need it

### For Everyone:
- **Place your router in the center of your home**
- **Keep router firmware updated**
- **Use strong, unique passwords**
- **Restart your router monthly**

## 👨‍👩‍👧‍👦 Family WiFi Safety

### Teaching Kids:
- Only connect to your home WiFi
- Never share the WiFi password with friends
- Tell an adult if something seems wrong
- Don't connect to random public WiFi

### For Grandparents:
- Write down your WiFi name and password
- Ask family to help set up the router
- Don't worry if it seems complicated - ask for help!
- Focus on using strong passwords

### For Parents:
- Set up parental controls on your router
- Monitor what devices are connected
- Teach kids about public WiFi dangers
- Create separate networks for smart home devices

## 🆘 What to Do If Something Goes Wrong

### If Your WiFi Gets Hacked:
1. **Don't panic** - this can be fixed
2. **Unplug your router** for 30 seconds
3. **Change all passwords** immediately
4. **Check all your devices** for problems
5. **Call your internet company** if you need help

### If You Forget Your Password:
1. **Look for the reset button** on your router
2. **Hold it down for 10 seconds** while plugged in
3. **Use the default password** (on the sticker)
4. **Set up your security again**

## 🎉 You're Ready to Keep Your WiFi Safe!

Great job! You now know how to:
- ✅ Change your WiFi password
- ✅ Pick a good network name
- ✅ Turn on security features
- ✅ Keep your router updated
- ✅ Create a guest network

**Remember:** Your home WiFi is like your front door - keep it locked and only let trusted people in!

---

*💡 **Need Help?** Ask a tech-savvy family member, call your internet company, or visit their website for step-by-step guides.*`
    },
    {
      title: "🎣 Avoid Email Tricks - Don't Get Fooled!",
      summary: "Learn how to spot fake emails that try to trick you into giving away your information, explained in simple terms.",
      content: `## 🎯 What You'll Learn Today

You'll learn how to spot fake emails that try to trick you, so you can stay safe online.

## 🤔 What Are Email Tricks (Phishing)?

**Phishing is like a digital con artist:**
- Bad people send fake emails
- They pretend to be banks, stores, or friends
- They want to steal your passwords or money
- They're very good at making emails look real

**Think of it like this:**
- A stranger calls saying they're from your bank
- They ask for your account number
- You wouldn't give it to them, right?
- Email tricks work the same way

## 🚨 Warning Signs of Fake Emails

### 🔍 Look for These Red Flags:

#### 1. Scary or Urgent Messages
**Examples:**
- "Your account will be closed in 24 hours!"
- "Urgent: Suspicious activity detected!"
- "Act now or lose your money!"

**Why they do this:**
- They want you to panic
- When you're scared, you don't think clearly
- You might click without checking if it's real

#### 2. Generic Greetings
**Bad signs:**
- "Dear Customer" (not your name)
- "Dear Sir/Madam"
- "Hello User"

**Good signs:**
- Uses your real name
- Mentions specific account details
- Feels personal and familiar

#### 3. Asking for Personal Information
**Never give these via email:**
- Social Security numbers
- Passwords
- Bank account numbers
- Credit card information
- Driver's license numbers

**Remember:** Real companies already have your information - they won't ask for it in emails!

#### 4. Suspicious Email Addresses
**Bad examples:**
- amazon-security@fake-email.com
- bank0fsecurity@gmail.com
- paypal.verification@random-site.net

**Good examples:**
- noreply@amazon.com
- security@bankofamerica.com
- service@paypal.com

#### 5. Strange Links and Attachments
**Warning signs:**
- Links that don't match the company name
- Unexpected attachments
- "Click here now!" buttons
- Links that look like: bit.ly/xyz123

## 🛡️ How to Check if an Email is Real

### Step 1: Take a Deep Breath
- Don't click anything immediately
- Fake emails want you to rush
- Real companies can wait for you to verify

### Step 2: Check the Sender
- Look at the email address carefully
- Does it match the company name?
- Are there spelling mistakes?
- Does it look official?

### Step 3: Look for Mistakes
**Fake emails often have:**
- Spelling errors ("You're account")
- Grammar mistakes ("We has detected")
- Weird punctuation
- Random capital letters

### Step 4: Hover Over Links (Don't Click!)
- Put your mouse over any links
- Look at the web address that appears
- Does it match the company?
- If it looks weird, don't click!

### Step 5: Contact the Company Directly
- Call the company's official phone number
- Go to their website by typing the address yourself
- Ask: "Did you send me an email about...?"
- They'll tell you if it's real or fake

## 🎯 Common Email Tricks to Watch For

### 1. Fake Bank Emails
**What they say:**
- "Suspicious activity on your account"
- "Verify your identity immediately"
- "Your account has been locked"

**What to do:**
- Don't click any links
- Call your bank directly
- Log into your account the normal way

### 2. Fake Package Delivery
**What they say:**
- "Your package couldn't be delivered"
- "Pay extra shipping fees"
- "Update your address"

**What to do:**
- Check tracking on the official website
- Call the shipping company
- Don't download attachments

### 3. Fake Prize Notifications
**What they say:**
- "You've won $1,000!"
- "Claim your prize now!"
- "You're our lucky winner!"

**What to do:**
- Remember: you can't win contests you didn't enter
- Real prizes don't ask for money upfront
- Delete these emails immediately

### 4. Fake Social Media Alerts
**What they say:**
- "Someone tagged you in a photo"
- "You have a new message"
- "Your account will be deleted"

**What to do:**
- Log into social media normally
- Check your notifications there
- Don't click email links

## 👨‍👩‍👧‍👦 Family Email Safety

### Teaching Kids:
- Never open emails from strangers
- Always ask an adult before clicking links
- Don't give out personal information
- If something seems too good to be true, it probably is

### For Grandparents:
- When in doubt, ask a family member
- It's okay to delete emails you're not sure about
- Real companies will contact you other ways too
- Don't be embarrassed to ask for help

### For Parents:
- Set up email filters to block spam
- Teach kids about email safety
- Review suspicious emails with family
- Create a family rule: ask before clicking

## 🆘 What to Do If You Get Tricked

### If You Clicked a Bad Link:
1. **Don't panic** - this happens to everyone
2. **Close your browser** immediately
3. **Run a virus scan** on your computer
4. **Change your passwords** for important accounts
5. **Tell someone you trust** what happened

### If You Gave Out Information:
1. **Contact your bank** immediately
2. **Change all related passwords**
3. **Watch your accounts** for strange activity
4. **Consider freezing your credit**
5. **Report it** to the company that was impersonated

### If You Sent Money:
1. **Contact your bank** right away
2. **Report it to the police**
3. **File a complaint** with the FTC
4. **Don't send more money** (even if they ask)

## 🔧 Email Safety Tools

### Built-in Protection:
- **Spam filters** - automatically catch many bad emails
- **Virus scanners** - check attachments for problems
- **Phishing protection** - warn you about suspicious emails

### Browser Protection:
- Keep your browser updated
- Use security extensions
- Enable phishing protection
- Don't save passwords on shared computers

### Email Apps:
- **Gmail** - has good spam protection
- **Outlook** - includes security features
- **Apple Mail** - works well with iPhones
- **Yahoo Mail** - has spam filters

## 🎉 You're Now Email Safe!

Congratulations! You now know how to:
- ✅ Spot fake emails
- ✅ Check if emails are real
- ✅ Avoid clicking dangerous links
- ✅ Protect your personal information
- ✅ Know what to do if something goes wrong

**Remember:** When in doubt, don't click! It's always better to be safe than sorry.

---

*💡 **Golden Rule:** Real companies will never ask for passwords or personal information via email. When in doubt, call them directly!*`
    }
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  
  return `---
layout: post
title: "${template.title}"
date: ${timestamp}
categories: [cybersecurity, family-safety, easy-guide]
tags: [security, simple, family, guide, protection]
author: CyberDad
description: "${template.summary}"
difficulty: "Super Easy"
age_appropriate: "For parents and families"
---

<div class="post-header">
  <h1>${template.title}</h1>
  <div class="post-meta">
    <span class="difficulty">📊 Super Easy</span>
    <span class="age-range">🏠 For parents and families</span>
  </div>
  <div class="post-summary">
    <p><strong>Quick Summary:</strong> ${template.summary}</p>
  </div>
</div>

${template.content}

<div class="post-footer">
  <div class="key-takeaways">
    <h2>🔑 Key Things to Remember</h2>
    <ul class="simple-list">
      <li>✅ Take your time - don't rush</li>
      <li>✅ When in doubt, ask for help</li>
      <li>✅ It's okay to go slow and learn gradually</li>
      <li>✅ Your safety is more important than convenience</li>
    </ul>
  </div>
  
  <div class="help-section">
    <h2>🤝 Need Help?</h2>
    <p>If you have questions or need help with this guide:</p>
    <ul class="help-options">
      <li>📧 Email us: <a href="mailto:ruel@getcyberdadkit.com">ruel@getcyberdadkit.com</a></li>
      <li>👨‍👩‍👧‍👦 Ask a tech-savvy family member</li>
      <li>📞 Call the company's official phone number</li>
      <li>🌐 Visit their official website</li>
    </ul>
  </div>
  
  <div class="share-section">
    <h2>📤 Share This Guide</h2>
    <p>Help keep your family and friends safe by sharing this guide with them!</p>
    <div class="share-buttons">
      <a href="mailto:?subject=Important Security Guide&body=I found this helpful security guide: {{ page.url | absolute_url }}" class="share-email">📧 Email This</a>
      <a href="#" onclick="window.print()" class="share-print">🖨️ Print This</a>
    </div>
  </div>
</div>

<style>
.post-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 10px;
  margin-bottom: 30px;
  text-align: center;
}

.post-header h1 {
  font-size: 2.2em;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.post-meta {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.post-meta span {
  background: rgba(255,255,255,0.2);
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 0.9em;
}

.post-summary {
  background: rgba(255,255,255,0.1);
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.post-summary p {
  margin: 0;
  font-size: 1.1em;
  line-height: 1.6;
}

article {
  font-size: 1.1em;
  line-height: 1.8;
  max-width: 800px;
  margin: 0 auto;
  color: #333;
}

h2 {
  color: #2c3e50;
  font-size: 1.6em;
  margin-top: 40px;
  margin-bottom: 20px;
  border-bottom: 3px solid #3498db;
  padding-bottom: 10px;
}

h3 {
  color: #34495e;
  font-size: 1.3em;
  margin-top: 30px;
  margin-bottom: 15px;
}

p {
  margin-bottom: 20px;
  text-align: left;
}

ul, ol {
  margin-bottom: 20px;
  padding-left: 25px;
}

li {
  margin-bottom: 10px;
  line-height: 1.6;
}

strong {
  color: #2c3e50;
  font-weight: bold;
}

code {
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.post-footer {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 10px;
  margin-top: 40px;
  border-top: 4px solid #3498db;
}

.key-takeaways {
  margin-bottom: 30px;
}

.simple-list {
  list-style: none;
  padding: 0;
}

.simple-list li {
  background: white;
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 8px;
  border-left: 4px solid #27ae60;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.help-section {
  margin-bottom: 30px;
}

.help-options {
  list-style: none;
  padding: 0;
}

.help-options li {
  background: white;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.share-buttons {
  display: flex;
  gap: 15px;
  margin-top: 15px;
}

.share-email, .share-print {
  background: #3498db;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
  transition: background 0.3s;
}

.share-email:hover, .share-print:hover {
  background: #2980b9;
  color: white;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .post-header h1 {
    font-size: 1.8em;
  }
  
  .post-meta {
    flex-direction: column;
    gap: 10px;
  }
  
  .share-buttons {
    flex-direction: column;
  }
  
  article {
    font-size: 1.05em;
  }
}

/* Print styles */
@media print {
  .post-header {
    background: #f0f0f0 !important;
    color: black !important;
  }
  
  .share-section {
    display: none;
  }
}
</style>

*Stay safe online! 🔒*
*- The Cyber Dad Team*`;
}

// Exposed for offline dry runs and tests only (Netlify uses exports.handler).
exports._test = { claimsGuard, generateUltraReadablePost, generateSlug, CLAIMS_RULES };
