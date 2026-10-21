def log_activity(content_data, success, full_description=None, pin_url=None, error_details=None):
    """Enhanced logging with complete details"""
    
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "content_type": content_data.get('type', 'unknown'),
        "title": content_data.get('title_prefix', ''),
        "success": success,
        
        # COMPLETE CONTENT LOGGING
        "generated_content": {
            "full_content": content_data.get('content', ''),
            "keywords": content_data.get('keywords', ''),
            "cta": content_data.get('cta', ''),
            "title_prefix": content_data.get('title_prefix', '')
        },
        
        # EXACT PINTEREST POST DATA
        "pinterest_post": {
            "full_description": full_description,
            "description_length": len(full_description) if full_description else 0,
            "pin_url": pin_url,
            "board_id": os.getenv('PINTEREST_BOARD_ID', 'not_set')
        },
        
        # ERROR DETAILS IF FAILED
        "error_info": error_details,
        
        # ENVIRONMENT INFO
        "environment": {
            "has_openai_key": bool(os.getenv('OPENAI_API_KEY')),
            "has_pinterest_token": bool(os.getenv('PINTEREST_ACCESS_TOKEN')),
            "has_board_id": bool(os.getenv('PINTEREST_BOARD_ID')),
            "content_type_env": os.getenv('CONTENT_TYPE', 'not_set')
        }
    }
    
    # Create logs directory if it doesn't exist
    os.makedirs('logs', exist_ok=True)
    
    # Append to daily log file
    log_file = f"logs/pinterest_{datetime.now().strftime('%Y-%m-%d')}.json"
    
    try:
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                logs = json.load(f)
        else:
            logs = []
        
        logs.append(log_entry)
        
        with open(log_file, 'w') as f:
            json.dump(logs, f, indent=2)
            
        print(f"📊 Detailed log saved to: {log_file}")
        
    except Exception as e:
        print(f"⚠️ Logging error: {str(e)}")

def main():
    """Main function with comprehensive debugging"""
    

    print("🚀 PINTEREST TRAFFIC BLITZ - ENHANCED VERSION")
    print("=" * 60)
    print(f"🕐 Started at: {datetime.now().isoformat()}")

    # Environment check
    print("\n🔧 ENVIRONMENT VALIDATION:")
    env_status = {
        "OPENAI_API_KEY": bool(os.getenv("OPENAI_API_KEY")),
        "PINTEREST_ACCESS_TOKEN": bool(os.getenv("PINTEREST_ACCESS_TOKEN")),
        "PINTEREST_BOARD_ID": bool(os.getenv("PINTEREST_BOARD_ID")),
        "CONTENT_TYPE": os.getenv("CONTENT_TYPE", "not_set"),
    }
    for key, value in env_status.items():
        status = "✅ Present" if value else "❌ Missing"
        if key == "CONTENT_TYPE":
            status = f"✅ Set to: {value}" if value != "not_set" else "⚠️ Not set (will default to 'general')"
        print(f"   {key}: {status}")

    try:
        # Generate targeted content
        print("\n📝 CONTENT GENERATION:")
        content_data = generate_targeted_content()
        print(f"   ✅ Generated {content_data['type']} content")
        print(f"   📄 Content preview: {content_data['content'][:100]}...")

        # Create Pinterest description
        print("\n📌 PINTEREST OPTIMIZATION:")
        description = create_pinterest_description(content_data)
        print(f"   ✅ Description created ({len(description)} characters)")

        # Post to Pinterest (force homepage for all Pins)
        print("\n🎯 PINTEREST POSTING:")
        pin_url = "https://cyberdad2025.github.io/?src=pinterest&utm_source=pinterest&utm_medium=pin&utm_campaign=traffic_blitz"

        # Overwrite the content_data url so Pinterest always uses the homepage
        content_data["url"] = pin_url  

        success, pin_url, error_details = post_to_pinterest(content_data, description)

        # Enhanced logging
        log_activity(content_data, success, description, pin_url, error_details)

        print("\n📊 FINAL RESULT:")
        if success:
            print("   🎉 SUCCESS! Pinterest post created")
            print(f"   🔗 Pin URL (homepage override): {pin_url}")
            print(f"   🔥 Content type: {content_data['type']}")
        else:
            print("   ❌ FAILED! Pinterest posting unsuccessful")
            print("   🔍 Check logs above for detailed error information")
            if error_details:
                print(f"   🚨 Error summary: {error_details}")

        print(f"\n🕐 Completed at: {datetime.now().isoformat()}")

    except Exception as e:
        error_msg = str(e)
        print(f"\n❌ CRITICAL ERROR: {error_msg}")
        import traceback
        print("📋 Full traceback:")
        print(traceback.format_exc())
        # Log the error
        log_activity(
            {"type": "critical_error", "content": error_msg},
            False,
            None,
            None,
            {"error": error_msg, "traceback": traceback.format_exc()},
        )


if __name__ == "__main__":
    main()
