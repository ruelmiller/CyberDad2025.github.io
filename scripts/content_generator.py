#!/usr/bin/env python3
import random
import datetime
from pathlib import Path

# SEO-OPTIMIZED TITLES (High search volume keywords)
TITLE_TEMPLATES = [
    "How to Protect Kids from {threat} - Complete Parent Guide 2025",
    "{threat} Safety for Families: 5 Essential Steps Parents Need",
    "Keep Your Family Safe from {threat} - Practical Tips That Work",
    "Family Guide: Preventing {threat} Attacks in Your Home",
    "Parents Alert: {threat} Threats and How to Stop Them",
    "Simple {topic} Security for Non-Tech Parents",
    "Child-Safe {topic} Setup: Step-by-Step Guide",
    "Family {topic} Protection: A Step-by-Step Setup Guide",
    "Why Every Parent Needs {topic} Security (2025 Update)",
    "Best {topic} Safety Practices for Modern Families",
]

# HIGH-SEARCH-VOLUME KEYWORDS
THREATS = [
    "Cyberbullying", "Identity Theft", "Online Predators", "Malware", 
    "Phishing", "Social Media Scams", "Gaming Threats", "WiFi Hacking",
    "Password Theft", "Device Tracking", "Data Breaches", "Ransomware"
]

TOPICS = [
    "Router", "Password Manager", "Antivirus", "VPN", "Parental Controls",
    "Social Media", "Gaming Console", "Smart TV", "Tablet", "Phone",
    "Home Network", "IoT Device", "Smart Speaker", "Laptop"
]

# SEO-OPTIMIZED CONTENT WITH KEYWORDS
CONTENT_TEMPLATES = {
    "intro": [
        "As a parent in 2025, protecting your family from cyber threats is more critical than ever. Here's what you need to know:",
        "Many families are online all day, so it helps to have a plan. Here's how to protect your loved ones:",
        "Many families are online all day, so a few simple habits go a long way. This guide walks you through them:",
    ],
    
    "steps": [
        "**Step 1: Immediate Protection**\nTake these actions right now to secure your family:\n\n• Enable two-factor authentication on all family accounts\n• Update all device passwords using our family password checklist\n• Install reputable antivirus software on every device\n\n",
        
        "**Step 2: Family Education**\nTeach your children these essential safety rules:\n\n• Never share personal information online\n• Recognize phishing emails and suspicious links\n• Report cyberbullying immediately to parents\n• Use privacy settings on social media platforms\n\n",
        
        "**Step 3: Technology Setup**\nConfigure your home network for maximum security:\n\n• Change default router passwords\n• Set up guest WiFi networks for visitors\n• Enable automatic security updates\n• Install parental control software\n\n",
        
        "**Step 4: Advanced Protection**\nPut these extra security measures in place:\n\n• Use a VPN for all family internet activity\n• Set up network monitoring for suspicious activity\n• Create separate user accounts for children\n• Regular security audits of all family devices\n\n",
        
        "**Step 5: Emergency Response**\nKnow what to do if your family experiences a cyber attack:\n\n• Immediately disconnect affected devices from internet\n• Document the incident with screenshots\n• Change all passwords on unaffected devices\n• Contact your bank if financial information may be compromised\n\n"
    ],
    
    "conclusion": [
        "**Bottom Line:** Set up these security measures once, then review them whenever your family gets a new device or app.",
        "**Take Action Today:** Download our free family security checklist and start protecting your loved ones immediately.",
        "**Remember:** Cybersecurity is not optional for modern families. Start with one step today and build from there.",
    ]
}

def generate_seo_post():
    # Choose SEO-optimized elements
    threat = random.choice(THREATS)
    topic = random.choice(TOPICS)
    title_template = random.choice(TITLE_TEMPLATES)
    
    # Generate SEO title using simple string replacement
    if "{threat}" in title_template:
        title = title_template.replace("{threat}", threat)
    else:
        title = title_template.replace("{topic}", topic)
    
    # Create filename with date
    now = datetime.datetime.now()
    clean_title = title.lower().replace(' ', '-').replace(':', '').replace('(', '').replace(')', '').replace(',', '').replace('?', '')
    filename = now.strftime('%Y-%m-%d') + "-" + clean_title[:50] + ".md"
    
    # Generate SEO-focused content
    intro = random.choice(CONTENT_TEMPLATES["intro"])
    steps = "".join(random.sample(CONTENT_TEMPLATES["steps"], 3))  # Pick 3 random steps
    conclusion = random.choice(CONTENT_TEMPLATES["conclusion"])
    
    # Determine category for SEO
    categories = ["Cybersecurity", "Family Safety", "Digital Protection"]
    category = random.choice(categories)
    
    # Create SEO-optimized excerpt
    excerpt = "Learn how to protect your family from cyber threats with our plain-English guide based on FBI, FTC, and CISA advice. Simple steps every parent can implement today."
    
    # Build complete blog post using simple string concatenation
    content = "---\n"
    content += "layout: post\n"
    content += "title: \"" + title + "\"\n"
    content += "date: " + now.strftime('%Y-%m-%d %H:%M:%S') + " +0000\n"
    content += "categories: [" + category + "]\n"
    content += "tags: [cybersecurity, family-safety, " + threat.lower().replace(' ', '-') + ", parents-guide]\n"
    content += "excerpt: \"" + excerpt + "\"\n"
    content += "author: CyberDad\n"
    content += "---\n\n"
    content += intro + "\n\n"
    content += steps + "\n\n"
    content += conclusion + "\n\n"
    
    # Add affiliate section
    content += "## 🛡️ Recommended Security Tools\n\n"
    content += "Protect your family with these trusted cybersecurity solutions:\n\n"
    content += "- **Norton 360 Deluxe** - Complete family protection with VPN\n"
    content += "- **NordVPN** - Secure your internet connection worldwide\n"
    content += "- **LastPass** - Password manager\n"
    content += "- **Malwarebytes** - Advanced malware protection\n\n"
    content += "*As a cybersecurity affiliate, I earn from qualifying purchases at no cost to you.*\n\n"
    
    # Add email signup section
    content += "## 🔒 Get FREE Cybersecurity Alerts\n\n"
    content += "**Join 12,000+ families getting instant notifications about threats affecting their devices!**\n\n"
    content += "<div style=\"background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;\">\n"
    content += "    <div class=\"ml-embedded\" data-form=\"KxzppG\"></div>\n"
    content += "    <p style=\"font-size: 12px; color: #666; margin-top: 10px;\">✅ Real-time threat alerts • Unsubscribe anytime</p>\n"
    content += "</div>\n\n"
    
    return filename, content

def create_post():
    try:
        # Create _posts directory if it doesn't exist
        posts_dir = Path("_posts")
        posts_dir.mkdir(exist_ok=True)
        
        # Generate and save the post
        filename, content = generate_seo_post()
        filepath = posts_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("✅ SEO-optimized post created: " + filename)
        return True
        
    except Exception as e:
        print("❌ Error creating post: " + str(e))
        return False

if __name__ == "__main__":
    create_post()
