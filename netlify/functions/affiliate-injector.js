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
    
    // Check authorization
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

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

// P7: never inject a placeholder or unset affiliate URL (e.g. .../ref/YOURCODE). Fail closed: the product is skipped
// until a real, approved affiliate URL replaces the placeholder in AFFILIATE_PRODUCTS.
function isPlaceholderLink(url) {
  return !url || /YOURCODE|affiliate-link|example\.(?:com|invalid)/i.test(url) || /^\[[A-Z_]+\]$/.test(url);
}
function replacementUrl(md) {
  const m = /\]\(([^)]*)\)/.exec(md || '');
  return m ? m[1] : '';
}

function injectAffiliateLinks(content) {
  let updatedContent = content;
  let totalLinksAdded = 0;

  // Process each affiliate product
  for (const [productKey, product] of Object.entries(AFFILIATE_PRODUCTS)) {
    if (isPlaceholderLink(product.link) || isPlaceholderLink(replacementUrl(product.replacement))) {
      console.log(`⏭️  Skipped ${productKey}: placeholder affiliate URL (P7)`);
      continue;
    }
    
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

exports._test = { injectAffiliateLinks, isPlaceholderLink, AFFILIATE_PRODUCTS };
