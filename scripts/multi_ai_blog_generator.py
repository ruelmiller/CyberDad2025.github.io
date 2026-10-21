#!/usr/bin/env python3
"""
FIXED Multi-AI Blog Generator - Properly formats Jekyll posts
Fixes the front matter issue causing posts not to display
"""

import os
import sys
import json
import random
import yaml
import requests
from datetime import datetime

class MultiAIBlogGenerator:
    def __init__(self):
        # API keys from environment
        self.openai_key = os.getenv('OPENAI_API_KEY')
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY') 
        self.gemini_key = os.getenv('GEMINI_API_KEY')
        self.cohere_key = os.getenv('COHERE_API_KEY')
        
        # Family cybersecurity topics
        self.topics = [
            "Password Manager Setup for Families",
            "Home Router Security in 5 Minutes", 
            "Smart TV Privacy Settings Guide",
            "Two-Factor Authentication Setup",
            "Protect Your Phone from Scams",
            "Safe Internet Browsing for Kids",
            "Family WiFi Security Checklist",
            "Social Media Privacy for Teens",
            "Prevent Online Scams",
            "Secure Email for Families",
            "Home Security Camera Setup",
            "Identity Theft Prevention",
            "Safe Online Shopping Guide",
            "Parental Control Software Guide",
            "Backup Your Family Photos Safely",
            "Secure Video Calling Setup",
            "Gaming Console Security",
            "Smart Home Device Protection",
            "Digital Legacy Planning",
            "Cyberbullying Prevention Guide"
        ]

    def try_openai(self, topic):
        """Try OpenAI API first"""
        try:
            import openai
            openai.api_key = self.openai_key
            
            prompt = f"""Write a comprehensive family cybersecurity blog post about "{topic}".

Requirements:
- 800-1200 words
- Family-friendly language  
- Practical step-by-step instructions
- Include security tips parents can actually use
- Focus on protecting children and family devices
- NEVER state or imply the author's child's or children's age, gender, name, or school, or how many children he has; refer to his household only as "my family".
- Add emojis for engagement
- Include "What You'll Learn Today" section
- End with a call-to-action

Format as engaging blog content that helps families stay safe online."""

            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
                temperature=0.7
            )
            
            content = response.choices[0].message.content.strip()
            print("✅ OpenAI generation successful")
            return content, "OpenAI"
            
        except Exception as e:
            print(f"❌ OpenAI failed: {e}")
            return None, None

    def try_gemini(self, topic):
        """Try Google Gemini API as backup"""
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={self.gemini_key}"
            
            prompt = f"""Write a comprehensive family cybersecurity blog post about "{topic}".

Requirements:
- 800-1200 words
- Family-friendly language  
- Practical step-by-step instructions
- Include security tips parents can actually use
- Focus on protecting children and family devices
- NEVER state or imply the author's child's or children's age, gender, name, or school, or how many children he has; refer to his household only as "my family".
- Add emojis for engagement
- Include "What You'll Learn Today" section
- End with a call-to-action

Format as engaging blog content that helps families stay safe online."""

            payload = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }]
            }
            
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            result = response.json()
            content = result['candidates'][0]['content']['parts'][0]['text'].strip()
            print("✅ Gemini generation successful")
            return content, "Gemini"
            
        except Exception as e:
            print(f"❌ Gemini failed: {e}")
            return None, None

    def try_anthropic(self, topic):
        """Try Anthropic Claude as backup"""
        try:
            import anthropic
            
            client = anthropic.Anthropic(api_key=self.anthropic_key)
            
            prompt = f"""Write a comprehensive family cybersecurity blog post about "{topic}".

Requirements:
- 800-1200 words
- Family-friendly language  
- Practical step-by-step instructions
- Include security tips parents can actually use
- Focus on protecting children and family devices
- NEVER state or imply the author's child's or children's age, gender, name, or school, or how many children he has; refer to his household only as "my family".
- Add emojis for engagement
- Include "What You'll Learn Today" section
- End with a call-to-action

Format as engaging blog content that helps families stay safe online."""

            response = client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            
            content = response.content[0].text.strip()
            print("✅ Anthropic generation successful")
            return content, "Anthropic"
            
        except Exception as e:
            print(f"❌ Anthropic failed: {e}")
            return None, None

    def create_fallback_content(self, topic):
        """Create template content if all AI services fail"""
        content = f"""# {topic}

🔒 **Quick Summary:** Learn how to {topic.lower()} with simple steps anyone can follow.

⏱️ **Takes 5 minutes to read** 📚 **Super Easy** 🔒 **Perfect for ages 8-99**

**Quick Summary:** Essential cybersecurity guide to help families stay safe online.

## 🎯 What You'll Learn Today

By the end of this guide, you'll know exactly how to protect your family from cyber threats.

## 🚀 Getting Started

Here are the essential steps every family needs to know:

### Step 1: Basic Security Setup
- Enable strong passwords on all devices
- Turn on automatic updates
- Use reputable antivirus software

### Step 2: Family Safety Measures  
- Set up parental controls
- Educate children about online safety
- Create a family technology agreement

### Step 3: Ongoing Protection
- Regular security checkups
- Stay informed about new threats
- Backup important family data

## 🛡️ Pro Tips for Families

- **Talk to your kids** about cybersecurity regularly
- **Lead by example** with good security habits  
- **Stay updated** on the latest family safety tools

## 🎯 Take Action Today

Start with just one security improvement today. Your family's digital safety is worth the effort!

**Need help?** Get plain-English family safety guidance, based on official FBI, FTC, and CISA advice, designed specifically for parents and kids."""

        print("✅ Fallback content generated")
        return content, "Fallback Template"

    def create_blog_post(self):
        """Generate and save a blog post"""
        
        # Select random topic
        topic = random.choice(self.topics)
        print(f"🎯 Topic: {topic}")
        print(f"📝 Generating content for: {topic}")
        
        # Try AI services in order
        content = None
        ai_used = None
        
        print("🤖 Trying AI services in order...")
        
        # Try OpenAI first
        if self.openai_key and not content:
            print("🔄 Trying OpenAI...")
            content, ai_used = self.try_openai(topic)
        
        # Try Gemini second  
        if self.gemini_key and not content:
            print("🔄 Trying Gemini...")
            content, ai_used = self.try_gemini(topic)
            
        # Try Anthropic third
        if self.anthropic_key and not content:
            print("🔄 Trying Anthropic...")
            content, ai_used = self.try_anthropic(topic)
            
        # Use fallback if all fail
        if not content:
            print("🔄 All AI services failed, using fallback...")
            content, ai_used = self.create_fallback_content(topic)

        # Create filename
        date_str = datetime.now().strftime('%Y-%m-%d')
        title_slug = topic.lower().replace(' ', '-').replace(':', '').replace('/', '-')
        title_slug = ''.join(c for c in title_slug if c.isalnum() or c in '-')[:50]
        filename = f"{date_str}-{title_slug}.md"
        
        # FIXED: Create proper Jekyll front matter
        timezone = datetime.now().strftime('%z')
        if not timezone:
            timezone = '-0500'  # Default EST
            
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Create proper front matter - THIS IS THE FIX!
        front_matter = f"""---
layout: post
title: "{topic}"
date: {current_time} {timezone}
categories: [cybersecurity, family-safety, security-guide]
tags: [security, family, guide, protection, cybersecurity]
author: CyberDad
description: "Learn {topic.lower()} with simple steps anyone can follow."
reading_time: "5 minutes"
difficulty: "Super Easy"
age_appropriate: "All ages (8-99)"
---

"""
        
        # Combine front matter and content
        full_content = front_matter + content
        
        # Save to _posts directory
        posts_dir = "_posts"
        if not os.path.exists(posts_dir):
            os.makedirs(posts_dir)
            
        filepath = os.path.join(posts_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(full_content)
        
        print(f"✅ SUCCESS!")
        print(f"📝 Blog post created using {ai_used}")
        print(f"📄 File: {filename}")
        print(f"📊 Content length: {len(content)} characters")
        
        return True

    def verify_post_creation(self):
        """Verify the post was actually created"""
        posts_dir = "_posts"
        if os.path.exists(posts_dir):
            posts = [f for f in os.listdir(posts_dir) if f.endswith('.md')]
            print(f"📊 Total posts in directory: {len(posts)}")
            if posts:
                latest = sorted(posts)[-1]
                print(f"📝 Latest post: {latest}")
                return True
        return False

def main():
    """Main execution function"""
    print("🚀 Starting CyberDad Multi-AI Blog Generator...")
    print("🔧 FIXED VERSION - Proper Jekyll formatting!")
    
    try:
        generator = MultiAIBlogGenerator()
        
        # Generate the blog post
        success = generator.create_blog_post()
        
        if success:
            print("✅ Content generation completed successfully")
            generator.verify_post_creation()
        else:
            print("❌ Content generation failed")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
