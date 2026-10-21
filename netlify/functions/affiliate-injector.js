// netlify/functions/affiliate-injector.js
// Automatically injects affiliate links into blog posts

const AFFILIATE_PRODUCTS = {
  // VPN Services
  'nordvpn': {
    link: 'https://nordvpn.com/ref/YOURCODE',
    keywords: ['nordvpn', 'nord vpn', 'vpn service', 'virtual private network'],
    replacement: '[NordVPN](https://nordvpn.com/ref/YOURCODE)'
  },
  'expressvpn': {
    link: 'https://expressvpn.com/ref/YOURCODE',
    keywords: ['expressvpn', 'express vpn', 'fast vpn'],
    replacement: '[ExpressVPN](https://expressvpn.com/ref/YOURCODE)'
  },
  
  // Password Managers
  'lastpass': {
    link: 'https://lastpass.com/ref/YOURCODE',
    keywords: ['lastpass', 'password manager', 'password vault'],
    replacement: '[LastPass](https://lastpass.com/ref/YOURCODE)'
  },
  '1password': {
    link: 'https://1password.com/ref/YOURCODE',
    keywords: ['1password', 'onepassword', 'password manager'],
    replacement: '[1Password](https://1password.com/ref/YOURCODE)'
  },
  'bitwarden': {
    link: 'https://bitwarden.com/ref/YOURCODE',
    keywords: ['bitwarden', 'open source password manager'],
    replacement: '[Bitwarden](https://bitwarden.com/ref/YOURCODE)'
  },
  
  // Antivirus Software
  'norton': {
    link: 'https://norton.com/ref/YOURCODE',
    keywords: ['norton', 'norton antivirus', 'norton security'],
    replacement: '[Norton Security](https://norton.com/ref/YOURCODE)'
  },
  'mcafee': {
    link: 'https://mcafee.com/ref/YOURCODE',
    keywords: ['mcafee', 'mcafee antivirus', 'mcafee security'],
    replacement: '[McAfee](https://mcafee.com/ref/YOURCODE)'
  },
  
  // Backup Services
  'backblaze': {
    link: 'https://backblaze.com/ref/YOURCODE',
    keywords: ['backblaze', 'cloud backup', 'online backup'],
    replacement: '[Backblaze](https://backblaze.com/ref/YOURCODE)'
  },
  'carbonite': {
    link: 'https://carbonite.com/ref/YOURCODE',
    keywords: ['carbonite', 'backup service', 'data backup'],
    replacement: '[Carbonite](https://carbonite.com/ref/YOURCODE)'
  },
  
  // Security Tools
  'malwarebytes': {
    link: 'https://malwarebytes.com/ref/YOURCODE',
    keywords: ['malwarebytes', 'malware protection', 'anti-malware'],
    replacement: '[Malwarebytes](https://malwarebytes.com/ref/YOURCODE)'
  }
};

// Cron auth (R8). Same check as R7 generate-blog.js / system-monitor.js: the caller must send the header
//   Authorization: Bearer <CRON_SECRET>
// (exact match, compared in constant time). Missing or wrong -> 401 before any GitHub call.
// CRON_SECRET env var unset -> fail closed (500, logged), nothing runs.
const crypto = require('crypto');
function cronAuthFailure(event) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('affiliate-injector: CRON_SECRET env var is not set; refusing to run (fail closed). Set CRON_SECRET in Netlify env vars.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: CRON_SECRET not set' }) };
  }
  const h = (event && event.headers) || {};
  const auth = h.authorization || h.Authorization || '';
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
  if (!auth || !crypto.timingSafeEqual(digest(auth), digest(`Bearer ${secret}`))) {
    console.warn('affiliate-injector: unauthorized request (missing or wrong Authorization header)');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  return null;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🔗 Starting affiliate link injection...');
    
    // Check authorization (exact Bearer match, constant time; fails closed if CRON_SECRET is unset)
    const denied = cronAuthFailure(event);
    if (denied) return { ...denied, headers };

    // Get all blog posts from GitHub
    const posts = await getAllBlogPosts();
    console.log(`Found ${posts.length} posts to process`);

    let updatedPosts = 0;
    let totalLinksAdded = 0;

    // Process each post
    for (const post of posts) {
      const result = await processPost(post);
      if (result.updated) {
        updatedPosts++;
        totalLinksAdded += result.linksAdded;
        
        // Wait a bit between updates to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Completed: ${updatedPosts} posts updated, ${totalLinksAdded} links added`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Affiliate links injected successfully',
        postsProcessed: posts.length,
        postsUpdated: updatedPosts,
        linksAdded: totalLinksAdded,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

async function getAllBlogPosts() {
  const token = process.env.GITHUB_TOKEN;
  const repo = 'CyberDad2025/CyberDad2025.github.io';
  
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/_posts`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.status}`);
  }

  const files = await response.json();
  return files.filter(file => file.name.endsWith('.md'));
}

async function processPost(post) {
  const token = process.env.GITHUB_TOKEN;
  const repo = 'CyberDad2025/CyberDad2025.github.io';
  
  // Get the current file content
  const response = await fetch(post.url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch post ${post.name}: ${response.status}`);
  }

  const fileData = await response.json();
  const originalContent = Buffer.from(fileData.content, 'base64').toString('utf8');
  
  // Check if post already has affiliate links
  if (originalContent.includes('[affiliate-processed]')) {
    console.log(`⏭️ Skipping ${post.name} - already processed`);
    return { updated: false, linksAdded: 0 };
  }

  // Inject affiliate links
  const { content: newContent, linksAdded } = injectAffiliateLinks(originalContent);
  
  if (linksAdded === 0) {
    console.log(`⏭️ No affiliate opportunities in ${post.name}`);
    return { updated: false, linksAdded: 0 };
  }

  // Add processing marker
  const finalContent = newContent + '\n\n<!-- [affiliate-processed] -->';

  // Update the file
  const updateResponse = await fetch(`https://api.github.com/repos/${repo}/contents/_posts/${post.name}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `💰 Auto-inject affiliate links: ${post.name}`,
      content: Buffer.from(finalContent).toString('base64'),
      sha: fileData.sha,
      branch: 'main'
    })
  });

  if (!updateResponse.ok) {
    throw new Error(`Failed to update ${post.name}: ${updateResponse.status}`);
  }

  console.log(`✅ Updated ${post.name} - ${linksAdded} links added`);
  return { updated: true, linksAdded };
}

function injectAffiliateLinks(content) {
  let updatedContent = content;
  let totalLinksAdded = 0;

  // Process each affiliate product
  for (const [productKey, product] of Object.entries(AFFILIATE_PRODUCTS)) {
    
    // Check each keyword for this product
    for (const keyword of product.keywords) {
      // Create regex to find keyword mentions (case insensitive)
      const regex = new RegExp(`\\b${keyword}\\b(?![^\\[]*\\])`, 'gi');
      
      // Count matches
      const matches = [...updatedContent.matchAll(regex)];
      
      if (matches.length > 0) {
        // Replace first occurrence with affiliate link
        updatedContent = updatedContent.replace(regex, product.replacement);
        totalLinksAdded++;
        
        console.log(`🔗 Added affiliate link for "${keyword}" in content`);
        
        // Only replace first occurrence to avoid over-linking
        break;
      }
    }
  }

  return {
    content: updatedContent,
    linksAdded: totalLinksAdded
  };
}

// Alternative: Manual trigger for specific post
async function processSpecificPost(filename) {
  const token = process.env.GITHUB_TOKEN;
  const repo = 'CyberDad2025/CyberDad2025.github.io';
  
  const post = {
    name: filename,
    url: `https://api.github.com/repos/${repo}/contents/_posts/${filename}`
  };
  
  return await processPost(post);
}
