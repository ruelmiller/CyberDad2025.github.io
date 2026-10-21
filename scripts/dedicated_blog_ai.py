#!/usr/bin/env python3
"""
Dedicated AI Blog Content Generator for CyberDad
Simple, reliable content creation focused on posting
"""

import os
import sys
import json
import random
import yaml
from datetime import datetime
from openai import OpenAI

class DedicatedBlogAI:
    def __init__(self):
        # Simple OpenAI setup
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        
        # Cybersecurity topics specifically for families
        self.topics = [
            "Password Manager Setup for Families",
            "Quick Home Router Security Check", 
            "Smart TV Privacy Settings Guide",
            "iPhone Security for Parents",
            "Family WiFi Safety Checklist",
            "Two-Factor Authentication Made Simple",
            "Social Media Privacy for Teens",
            "Online Shopping Security Tips",
            "Identity Theft Prevention for Families",
            "Kids Internet Safety Guide",
            "Smart Home Device Security",
            "Phishing Email Recognition",
            "Family Data Backup Strategy",
            "Secure Video Calling for Families",
            "Gaming Console Safety Settings",
            "Family Cloud Storage Security",
            "Parental Control Software Guide",
            "Secure Messaging Apps for Families",
            "Family Financial Security Online",
            "Digital Privacy for Children"
        ]
        
        # Success tracking
        self.posts_created = 0
        
    def generate_content(self, topic):
        """Generate family-friendly cybersecurity content"""
        if not self.client:
            return self.create_fallback_content(topic)
        
        try:
            print(f"🤖 Generating content about: {topic}")
            
            response = self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": """You are CyberDad, a U.S. Marine Corps veteran and CompTIA Security+ certified dad who turns official FBI, FTC, and CISA guidance into plain-English steps for families. Never claim current SOC work, never name employers, never say "expert". NEVER state or imply the author's child's or children's age, gender, name, or school, or how many children he has; refer to his household only as "my family". Write practical, easy-to-follow security guides for parents and families. 

Guidelines:
- Use simple, non-technical language
- Include step-by-step instructions
- Add practical examples
- Focus on actionable advice
- Keep it family-friendly
- Include quick safety tips
- Make it 600-800 words"""
                    },
                    {
                        "role": "user", 
                        "content": f"Write a comprehensive blog post about '{topic}' for families. Include practical steps, examples, and actionable advice that parents can implement today."
                    }
                ],
                max_tokens=1200,
                temperature=0.7
            )
            
            content = response.choices[0].message.content
            print(f"✅ Generated {len(content)} characters of content")
            return content
            
        except Exception as e:
            print(f"❌ OpenAI generation failed: {e}")
            return self.create_fallback_content(topic)
    
    def create_fallback_content(self, topic):
        """Create reliable fallback content when AI fails"""
        print(f"🔄 Using fallback content for: {topic}")
        
        content = f"""# {topic}

Keeping your family safe online is more important than ever. This guide provides simple, practical steps you can take today to improve your family's cybersecurity.

## Why This Matters

Digital security affects every family member, from young children to grandparents. Understanding {topic.lower()} helps protect your personal information, privacy, and digital life.

## Quick Safety Steps

Here are the most important things you can do right now:

### 1. Assess Your Current Setup
Take a few minutes to review your current security practices. Look for areas where you can make improvements without major changes to your routine.

### 2. Make One Improvement Today
Choose the easiest security step you can implement immediately. Small changes add up to significant protection over time.

### 3. Involve the Whole Family
Make sure everyone understands the basics. Security works best when the entire family is on the same page.

### 4. Set Regular Reminders
Schedule monthly check-ins to maintain good security habits. Consistency is key to long-term protection.

## Step-by-Step Instructions

Follow these simple steps to get started:

**Step 1**: Update your devices and apps regularly
- Enable automatic updates when possible
- Check for updates monthly if automatic updates aren't available
- Don't delay security updates

**Step 2**: Use strong, unique passwords
- Consider using a family password manager
- Create passwords that are at least 12 characters long
- Never reuse passwords across important accounts

**Step 3**: Enable two-factor authentication
- Add this extra security layer to important accounts
- Use authentication apps when possible
- Keep backup codes in a safe place

**Step 4**: Review privacy settings
- Check settings on social media accounts
- Review sharing permissions on family devices
- Limit data collection when possible

## Family-Friendly Tips

- Make security a family discussion, not a lecture
- Start with easy changes before moving to more complex ones
- Celebrate when family members practice good security habits
- Keep security tools simple and user-friendly

## Common Mistakes to Avoid

- Don't use the same password everywhere
- Avoid clicking suspicious links in emails or messages
- Don't share personal information with unknown contacts
- Never ignore security update notifications

## Quick Action Checklist

Use this checklist to get started today:

- [ ] Update at least one device
- [ ] Change one weak password
- [ ] Enable two-factor authentication on one account
- [ ] Review privacy settings on one social media account
- [ ] Talk to family members about online safety

## Next Steps

Start with one simple change today. Security doesn't have to be overwhelming - small, consistent steps make a big difference for your family's digital safety.

Remember: the best security system is one that your family actually uses consistently.

## Need Help?

If you have questions about implementing these security measures, consider:
- Consulting with a local computer technician
- Asking tech-savvy friends or family members
- Contacting customer support for your devices or services

---

**Stay safe and stay informed!**

*This guide is part of our family cybersecurity series. Regular security practices help protect what matters most - your family's digital life.*
"""
        
        return content
    
    def create_blog_post(self, topic, content):
        """Create Jekyll blog post with proper formatting"""
        try:
            # Create safe filename
            now = datetime.now()
            date_str = now.strftime('%Y-%m-%d')
            title_slug = topic.lower().replace(' ', '-').replace(':', '').replace('/', '-')
            title_slug = ''.join(c for c in title_slug if c.isalnum() or c in '-')[:50]
            filename = f"{date_str}-{title_slug}.md"
            
            # Create frontmatter
            frontmatter = {
                'layout': 'post',
                'title': topic,
                'date': now.strftime('%Y-%m-%d %H:%M:%S +0000'),
                'categories': ['cybersecurity', 'family'],
                'tags': ['family-safety', 'cybersecurity', 'digital-parenting', 'security-tips'],
                'excerpt': content[:150] + '...',
                'author': 'CyberDad',
                'reading_time': f"{max(1, len(content.split()) // 200)} min read"
            }
            
            # Create complete post
            post_content = f"""---
{yaml.dump(frontmatter, default_flow_style=False)}---

{content}

---

## 🛡️ More Family Security Resources

- [Complete Family Password Guide](/2025/07/30/simple-password-safety.html)
- [Home Network Security Guide](/2025/07/24/home-network-security.html)
- [Kids Online Safety Guide](/2025/07/26/safe-internet-browsing-for-kids.html)
- [Family Privacy Settings Guide](/2025/07/24/family-digital-privacy.html)

**📧 Questions?** Email us at ruel@getcyberdadkit.com

**🔒 Stay Protected**: Follow us for daily family security tips and updates.

---

*Content verified for family safety • Updated {now.strftime('%B %Y')} • CyberDad Team*
"""
            
            # Ensure _posts directory exists
            os.makedirs('_posts', exist_ok=True)
            
            # Write the file
            filepath = os.path.join('_posts', filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(post_content)
            
            print(f"✅ Created blog post: {filename}")
            print(f"📄 File size: {len(post_content)} characters")
            print(f"📍 Location: {filepath}")
            
            self.posts_created += 1
            return True
            
        except Exception as e:
            print(f"❌ Error creating post: {e}")
            return False
    
    def run_content_generation(self):
        """Main function to generate and create blog post"""
        try:
            print("🚀 CyberDad Dedicated Blog AI Starting...")
            print("=" * 50)
            
            # Select topic
            topic = random.choice(self.topics)
            print(f"📝 Selected Topic: {topic}")
            
            # Generate content
            content = self.generate_content(topic)
            
            if not content:
                print("❌ Failed to generate content")
                return False
            
            # Create blog post
            success = self.create_blog_post(topic, content)
            
            if success:
                print("\n🎉 SUCCESS!")
                print(f"✅ Blog post created successfully")
                print(f"📊 Session stats: {self.posts_created} posts created")
                return True
            else:
                print("\n❌ FAILED!")
                print("❌ Could not create blog post")
                return False
                
        except Exception as e:
            print(f"💥 Critical error: {e}")
            return False
    
    def verify_post_creation(self):
        """Verify that posts were actually created"""
        try:
            posts_dir = '_posts'
            if not os.path.exists(posts_dir):
                print("⚠️ No _posts directory found")
                return False
            
            # Count markdown files
            posts = [f for f in os.listdir(posts_dir) if f.endswith('.md')]
            total_posts = len(posts)
            
            # Check for today's posts
            today = datetime.now().strftime('%Y-%m-%d')
            today_posts = [f for f in posts if f.startswith(today)]
            
            print(f"\n📊 Post Verification:")
            print(f"   📁 Total posts in directory: {total_posts}")
            print(f"   📅 Posts created today: {len(today_posts)}")
            
            if today_posts:
                print(f"   📝 Today's posts:")
                for post in today_posts:
                    print(f"      • {post}")
            
            return len(today_posts) > 0
            
        except Exception as e:
            print(f"❌ Verification error: {e}")
            return False

def main():
    """Main execution function"""
    print("🤖 CyberDad Dedicated Blog AI")
    print("🎯 Mission: Create and publish family cybersecurity content")
    print("=" * 60)
    
    # Initialize AI
    ai = DedicatedBlogAI()
    
    # Check API key
    if not ai.api_key:
        print("⚠️ No OpenAI API key found - using fallback content")
    else:
        print("✅ OpenAI API key detected")
    
    # Generate content
    success = ai.run_content_generation()
    
    # Verify creation
    verification = ai.verify_post_creation()
    
    # Final report
    print("\n" + "=" * 60)
    if success and verification:
        print("🎉 MISSION ACCOMPLISHED!")
        print("✅ Blog post created and verified")
        return 0
    else:
        print("❌ MISSION FAILED!")
        print("❌ Blog post creation unsuccessful")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
