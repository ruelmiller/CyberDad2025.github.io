// netlify/functions/analytics-reporter.js
// Daily analytics report via GitHub Issues (FREE VERSION)

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'CyberDad2025';
const GITHUB_REPO = 'CyberDad2025.github.io';
const CRON_SECRET = process.env.CRON_SECRET;

// Cron auth (R8). Same check as R7 generate-blog.js / system-monitor.js: the caller must send the header
//   Authorization: Bearer <CRON_SECRET>
// (exact match, compared in constant time). Missing or wrong -> 401 before any GitHub call.
// CRON_SECRET env var unset -> fail closed (500, logged), nothing runs.
const crypto = require('crypto');
function cronAuthFailure(event) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('analytics-reporter: CRON_SECRET env var is not set; refusing to run (fail closed). Set CRON_SECRET in Netlify env vars.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: CRON_SECRET not set' }) };
  }
  const h = (event && event.headers) || {};
  const auth = h.authorization || h.Authorization || '';
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
  if (!auth || !crypto.timingSafeEqual(digest(auth), digest(`Bearer ${secret}`))) {
    console.warn('analytics-reporter: unauthorized request (missing or wrong Authorization header)');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  return null;
}

exports.handler = async (event, context) => {
  // Verify cron secret (exact Bearer match, constant time; fails closed if CRON_SECRET is unset)
  const denied = cronAuthFailure(event);
  if (denied) return denied;

  try {
    console.log('Generating daily analytics report...');
    
    // Get today's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // 1. Check GitHub commits (blog posts published)
    const commitsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?since=${yesterdayStr}T00:00:00Z&until=${todayStr}T23:59:59Z`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const commits = await commitsResponse.json();
    const blogPosts = commits.filter(commit => 
      commit.commit.message.includes('Auto-generated blog post') ||
      commit.commit.message.includes('blog post')
    );

    const affiliatePosts = commits.filter(commit => 
      commit.commit.message.includes('Add affiliate links') ||
      commit.commit.message.includes('affiliate')
    );

    // 2. Get total post count
    const postsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/_posts`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const allPosts = await postsResponse.json();
    const totalPosts = Array.isArray(allPosts) ? allPosts.filter(file => file.name.endsWith('.md')).length : 0;

    // 3. Check website uptime
    let websiteStatus = 'Unknown';
    let statusEmoji = '❓';
    try {
      const siteResponse = await fetch(`https://${GITHUB_OWNER.toLowerCase()}.github.io`, {
        method: 'HEAD'
      });
      if (siteResponse.ok) {
        websiteStatus = 'Online';
        statusEmoji = '✅';
      } else {
        websiteStatus = 'Issues Detected';
        statusEmoji = '⚠️';
      }
    } catch (error) {
      websiteStatus = 'Connection Error';
      statusEmoji = '❌';
    }

    // 4. Calculate growth metrics
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    
    const postsThisWeek = commits.filter(commit => {
      const commitDate = new Date(commit.commit.author.date);
      return commitDate >= weekAgo && 
             (commit.commit.message.includes('Auto-generated blog post') ||
              commit.commit.message.includes('blog post'));
    }).length;

    // 5. Calculate performance metrics
    const dailyAverage = (totalPosts / 30).toFixed(1); // Estimate based on 30 days
    const weeklyProgress = Math.round((postsThisWeek / 21) * 100); // Target: 21 posts per week
    const annualProjection = Math.round((postsThisWeek * 52) / 7);

    // 6. Generate automation health status
    const automationHealth = [];
    if (blogPosts.length >= 2) {
      automationHealth.push('✅ Blog Generator: Working');
    } else {
      automationHealth.push('⚠️ Blog Generator: Below Target');
    }

    if (affiliatePosts.length > 0) {
      automationHealth.push('✅ Affiliate Injector: Active');
    } else {
      automationHealth.push('ℹ️ Affiliate Injector: No Activity');
    }

    automationHealth.push('✅ Analytics Reporter: Working');

    // 7. Generate GitHub Issue content
    const issueTitle = `📊 Daily Analytics Report - ${todayStr}`;
    
    const issueBody = `# 🚀 Cyber Dad Analytics Report

**Date:** ${today.toLocaleDateString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}

---

## 📊 Daily Performance

### 📝 Content Production
- **Posts Published Yesterday:** ${blogPosts.length} ${blogPosts.length >= 3 ? '✅' : '⚠️'}
- **Target:** 3 posts per day
- **Status:** ${blogPosts.length >= 3 ? 'Target achieved!' : 'Below target'}

### 📚 Content Library
- **Total Blog Posts:** ${totalPosts}
- **Daily Average:** ${dailyAverage} posts/day (estimated)
- **Growth:** Building your content empire! 📈

---

## 📈 Weekly & Long-term Metrics

### 🎯 This Week's Progress
- **Posts This Week:** ${postsThisWeek}/21 (${weeklyProgress}%)
- **Weekly Target:** 21 posts (3 per day × 7 days)
- **Annual Projection:** ${annualProjection} posts this year

### 📊 Performance Insights
${weeklyProgress >= 100 ? '🎉 **Exceeding weekly targets!**' : 
  weeklyProgress >= 80 ? '💪 **On track for weekly goals**' : 
  '⚡ **Opportunity to boost production**'}

---

## 🤖 Automation Health Check

${automationHealth.map(status => `- ${status}`).join('\n')}

---

## 🌐 System Status

### Website Uptime
- **Status:** ${statusEmoji} ${websiteStatus}
- **URL:** https://cyberdad2025.github.io
- **Check Time:** ${new Date().toLocaleTimeString()}

---

## 📋 Recent Activity

${blogPosts.length > 0 ? '### ✅ Posts Published Yesterday:' : '### ⚠️ No Posts Published Yesterday'}
${blogPosts.slice(0, 5).map(commit => 
  `- ${commit.commit.message}\n  *${new Date(commit.commit.author.date).toLocaleString()}*`
).join('\n') || '- No blog posts found for yesterday'}

${affiliatePosts.length > 0 ? '\n### 💰 Affiliate Updates:' : ''}
${affiliatePosts.slice(0, 3).map(commit => 
  `- ${commit.commit.message}\n  *${new Date(commit.commit.author.date).toLocaleString()}*`
).join('\n')}

---

## 🎯 Action Items

${blogPosts.length < 3 ? '- ⚠️ **Blog production below target** - Check cron jobs' : '- ✅ Blog production on target'}
${websiteStatus !== 'Online' ? '- 🔧 **Website issues detected** - Investigate uptime' : '- ✅ Website running smoothly'}
${postsThisWeek < 15 ? '- 📈 **Weekly goal tracking** - Aim for 21 posts this week' : '- 🎉 Weekly goals looking strong'}

---

## 📊 Quick Stats Summary

| Metric | Value | Status |
|--------|-------|--------|
| Posts Yesterday | ${blogPosts.length} | ${blogPosts.length >= 3 ? '✅' : '⚠️'} |
| Total Posts | ${totalPosts} | 📈 |
| Weekly Progress | ${postsThisWeek}/21 | ${weeklyProgress >= 80 ? '✅' : '⚠️'} |
| Website Status | ${websiteStatus} | ${statusEmoji} |
| Annual Pace | ${annualProjection} posts | 🚀 |

---

*🤖 Generated automatically by Cyber Dad Analytics Reporter*
*Stay secure, stay automated! 🔒*

---

### 🏷️ Labels
\`analytics\` \`daily-report\` \`automation\` \`performance\``;

    // 8. Create GitHub Issue
    const issueResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ['analytics', 'daily-report', 'automation']
      })
    });

    const issueResult = await issueResponse.json();

    if (issueResponse.ok) {
      console.log('Analytics report created as GitHub issue:', issueResult.html_url);
    } else {
      console.error('Failed to create GitHub issue:', issueResult);
    }

    // 9. Return summary
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Analytics report generated and posted as GitHub issue',
        issueUrl: issueResult.html_url,
        metrics: {
          postsYesterday: blogPosts.length,
          totalPosts: totalPosts,
          postsThisWeek: postsThisWeek,
          websiteStatus: websiteStatus,
          issueCreated: issueResponse.ok
        }
      })
    };

  } catch (error) {
    console.error('Error generating analytics report:', error);
    
    // Create error report as GitHub issue
    try {
      const errorIssue = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `🚨 Analytics Reporter Error - ${new Date().toISOString().split('T')[0]}`,
          body: `# Analytics Reporter Error\n\n**Error:** ${error.message}\n\n**Time:** ${new Date().toLocaleString()}\n\n**Stack:** \`\`\`\n${error.stack}\n\`\`\``,
          labels: ['bug', 'analytics', 'error']
        })
      });
    } catch (e) {
      console.error('Failed to create error issue:', e);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
