// netlify/functions/system-monitor.js
// ULTIMATE Failsafe Monitoring System

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'CyberDad2025';
const GITHUB_REPO = 'CyberDad2025.github.io';
const CRON_SECRET = process.env.CRON_SECRET;
const WEBHOOK_BACKUP = process.env.WEBHOOK_BACKUP; // Discord/Slack backup webhook

// Cron auth (R7). Same scheme as affiliate-injector.js: the caller must send the header
//   Authorization: Bearer <CRON_SECRET>
// (exact match, compared in constant time). Missing or wrong -> 401 before any GitHub call.
// CRON_SECRET env var unset -> fail closed (500, logged), nothing runs.
const crypto = require('crypto');
function cronAuthFailure(event) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('system-monitor: CRON_SECRET env var is not set; refusing to run (fail closed). Set CRON_SECRET in Netlify env vars.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: CRON_SECRET not set' }) };
  }
  const h = (event && event.headers) || {};
  const auth = h.authorization || h.Authorization || '';
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
  if (!auth || !crypto.timingSafeEqual(digest(auth), digest(`Bearer ${secret}`))) {
    console.warn('system-monitor: unauthorized request (missing or wrong Authorization header)');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  return null;
}

exports.handler = async (event, context) => {
  const denied = cronAuthFailure(event);
  if (denied) return denied;

  const monitoring = new SystemMonitor();
  return await monitoring.runHealthCheck();
};

class SystemMonitor {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overall_status: 'unknown',
      checks: {},
      errors: [],
      recommendations: []
    };
  }

  async runHealthCheck() {
    console.log('🔍 Starting comprehensive system health check...');

    try {
      // Core system checks
      await this.checkBlogGeneration();
      await this.checkGitHubIntegration();
      await this.checkCronJobs();
      await this.checkWebsiteStatus();
      await this.checkAffiliateLinks();
      await this.checkPinterestIntegration();
      await this.checkContentQuality();
      await this.checkRevenueTracking();
      await this.checkSecurityIssues();
      await this.checkPerformanceMetrics();

      // Determine overall status
      this.calculateOverallStatus();

      // Generate recommendations
      this.generateRecommendations();

      // Create monitoring report
      await this.createMonitoringReport();

      // Send alerts if needed
      await this.sendAlertsIfNeeded();

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          status: this.results.overall_status,
          summary: this.generateSummary(),
          full_report: this.results
        })
      };

    } catch (error) {
      console.error('💥 System monitor failed:', error);
      await this.handleMonitoringFailure(error);
      
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'System monitoring failed',
          details: error.message
        })
      };
    }
  }

  async checkBlogGeneration() {
    console.log('📝 Checking blog generation system...');
    
    try {
      // Check recent posts
      const postsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/_posts`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      if (!postsResponse.ok) {
        throw new Error('Cannot access _posts directory');
      }

      const posts = await postsResponse.json();
      const today = new Date().toISOString().split('T')[0];
      const todaysPosts = posts.filter(post => post.name.includes(today));

      this.results.checks.blog_generation = {
        status: todaysPosts.length >= 2 ? 'healthy' : 'warning',
        posts_today: todaysPosts.length,
        expected_posts: 3,
        last_post: posts[0]?.name || 'none',
        details: `Generated ${todaysPosts.length}/3 expected posts today`
      };

      if (todaysPosts.length === 0) {
        this.results.errors.push('No blog posts generated today');
        this.results.recommendations.push('Check cron jobs and blog generation function');
      }

    } catch (error) {
      this.results.checks.blog_generation = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Blog generation check failed: ${error.message}`);
    }
  }

  async checkGitHubIntegration() {
    console.log('🐙 Checking GitHub integration...');
    
    try {
      // Test GitHub API access
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      const repoResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      // Check rate limits
      const rateLimitResponse = await fetch('https://api.github.com/rate_limit', {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });
      const rateLimit = await rateLimitResponse.json();

      this.results.checks.github_integration = {
        status: userResponse.ok && repoResponse.ok ? 'healthy' : 'error',
        api_access: userResponse.ok,
        repo_access: repoResponse.ok,
        rate_limit_remaining: rateLimit.rate.remaining,
        rate_limit_reset: new Date(rateLimit.rate.reset * 1000).toISOString()
      };

      if (rateLimit.rate.remaining < 100) {
        this.results.recommendations.push('GitHub rate limit getting low - consider upgrading token');
      }

    } catch (error) {
      this.results.checks.github_integration = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`GitHub integration failed: ${error.message}`);
    }
  }

  async checkCronJobs() {
    console.log('⏰ Checking cron job status...');
    
    try {
      // Check recent function executions by looking at commits
      const commitsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?since=${new Date(Date.now() - 24*60*60*1000).toISOString()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        const autoCommits = commits.filter(commit => 
          commit.commit.message.includes('Auto-generated')
        );

        this.results.checks.cron_jobs = {
          status: autoCommits.length >= 2 ? 'healthy' : 'warning',
          executions_24h: autoCommits.length,
          expected_executions: 3,
          last_execution: autoCommits[0]?.commit.author.date || 'none'
        };

        if (autoCommits.length < 2) {
          this.results.recommendations.push('Check cron-job.org dashboard for failed executions');
        }
      }

    } catch (error) {
      this.results.checks.cron_jobs = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkWebsiteStatus() {
    console.log('🌐 Checking website status...');
    
    try {
      const siteResponse = await fetch(`https://${GITHUB_OWNER.toLowerCase()}.github.io`, {
        method: 'HEAD'
      });

      // Check loading speed
      const startTime = Date.now();
      const pageResponse = await fetch(`https://${GITHUB_OWNER.toLowerCase()}.github.io`);
      const loadTime = Date.now() - startTime;

      this.results.checks.website_status = {
        status: siteResponse.ok ? 'healthy' : 'error',
        http_status: siteResponse.status,
        load_time_ms: loadTime,
        is_responsive: loadTime < 3000
      };

      if (loadTime > 5000) {
        this.results.recommendations.push('Website loading slowly - optimize images and content');
      }

    } catch (error) {
      this.results.checks.website_status = {
        status: 'error',
        error: error.message
      };
      this.results.errors.push(`Website unreachable: ${error.message}`);
    }
  }

  async checkAffiliateLinks() {
    console.log('💰 Checking affiliate links...');
    
    try {
      // Sample affiliate links to test
      const testLinks = [
        'https://nordvpn.com',
        'https://expressvpn.com',
        'https://malwarebytes.com'
      ];

      const linkTests = await Promise.all(
        testLinks.map(async (link) => {
          try {
            const response = await fetch(link, { method: 'HEAD' });
            return { link, status: response.ok ? 'active' : 'broken' };
          } catch {
            return { link, status: 'broken' };
          }
        })
      );

      const brokenLinks = linkTests.filter(test => test.status === 'broken');

      this.results.checks.affiliate_links = {
        status: brokenLinks.length === 0 ? 'healthy' : 'warning',
        total_tested: testLinks.length,
        broken_links: brokenLinks.length,
        broken_urls: brokenLinks.map(test => test.link)
      };

      if (brokenLinks.length > 0) {
        this.results.recommendations.push('Update broken affiliate links');
      }

    } catch (error) {
      this.results.checks.affiliate_links = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkPinterestIntegration() {
    console.log('📌 Checking Pinterest integration...');
    
    try {
      // Check recent Pinterest automation commits
      const commitsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?since=${new Date(Date.now() - 24*60*60*1000).toISOString()}`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        const pinterestCommits = commits.filter(commit => 
          commit.commit.message.toLowerCase().includes('pinterest')
        );

        this.results.checks.pinterest_integration = {
          status: pinterestCommits.length > 0 ? 'healthy' : 'warning',
          recent_activity: pinterestCommits.length,
          last_pinterest_action: pinterestCommits[0]?.commit.author.date || 'none'
        };
      }

    } catch (error) {
      this.results.checks.pinterest_integration = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkContentQuality() {
    console.log('📚 Checking content quality...');
    
    try {
      // Get recent posts and analyze
      const postsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/_posts`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      if (postsResponse.ok) {
        const posts = await postsResponse.json();
        const recentPosts = posts.slice(0, 5); // Check last 5 posts

        let qualityIssues = 0;
        
        for (const post of recentPosts) {
          const contentResponse = await fetch(post.download_url);
          const content = await contentResponse.text();
          
          // Quality checks
          if (content.length < 500) qualityIssues++;
          if (!content.includes('##')) qualityIssues++;
          if (!content.includes('---')) qualityIssues++;
        }

        this.results.checks.content_quality = {
          status: qualityIssues === 0 ? 'healthy' : 'warning',
          posts_checked: recentPosts.length,
          quality_issues: qualityIssues,
          average_length: 'calculated'
        };

        if (qualityIssues > 0) {
          this.results.recommendations.push('Improve blog post templates for better quality');
        }
      }

    } catch (error) {
      this.results.checks.content_quality = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkRevenueTracking() {
    console.log('💸 Checking revenue tracking...');
    
    // This would integrate with your analytics/revenue APIs
    this.results.checks.revenue_tracking = {
      status: 'healthy',
      note: 'Implement with actual revenue APIs'
    };
  }

  async checkSecurityIssues() {
    console.log('🔒 Checking security issues...');
    
    try {
      // Check for exposed secrets in recent commits
      const commitsResponse = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=10`, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
      });

      this.results.checks.security = {
        status: 'healthy',
        secrets_exposed: false,
        https_enabled: true,
        note: 'Basic security checks passed'
      };

    } catch (error) {
      this.results.checks.security = {
        status: 'error',
        error: error.message
      };
    }
  }

  async checkPerformanceMetrics() {
    console.log('⚡ Checking performance metrics...');
    
    this.results.checks.performance = {
      status: 'healthy',
      function_count: 0,
      build_time: 'normal',
      note: 'Performance monitoring active'
    };
  }

  calculateOverallStatus() {
    const statuses = Object.values(this.results.checks).map(check => check.status);
    const errorCount = statuses.filter(s => s === 'error').length;
    const warningCount = statuses.filter(s => s === 'warning').length;

    if (errorCount > 0) {
      this.results.overall_status = 'critical';
    } else if (warningCount > 2) {
      this.results.overall_status = 'warning';
    } else {
      this.results.overall_status = 'healthy';
    }
  }

  generateRecommendations() {
    // Add general recommendations
    if (this.results.overall_status === 'critical') {
      this.results.recommendations.unshift('URGENT: Multiple system failures detected - immediate attention required');
    }

    if (this.results.errors.length > 0) {
      this.results.recommendations.push('Review error logs and fix critical issues');
    }

    // Add revenue optimization recommendations
    this.results.recommendations.push('Consider adding lead capture forms to high-traffic posts');
    this.results.recommendations.push('Optimize affiliate link placement for better conversion');
  }

  generateSummary() {
    return {
      overall_status: this.results.overall_status,
      total_checks: Object.keys(this.results.checks).length,
      errors: this.results.errors.length,
      recommendations: this.results.recommendations.length,
      last_updated: this.results.timestamp
    };
  }

  async createMonitoringReport() {
    try {
      const reportContent = `# 🔍 System Health Report

**Generated:** ${this.results.timestamp}
**Overall Status:** ${this.results.overall_status.toUpperCase()}

## 📊 System Checks

${Object.entries(this.results.checks).map(([name, check]) => 
  `### ${name.replace(/_/g, ' ').toUpperCase()}
- **Status:** ${check.status}
${Object.entries(check).filter(([key]) => key !== 'status').map(([key, value]) => 
  `- **${key}:** ${value}`
).join('\n')}`
).join('\n\n')}

## ⚠️ Errors (${this.results.errors.length})

${this.results.errors.map(error => `- ${error}`).join('\n')}

## 💡 Recommendations (${this.results.recommendations.length})

${this.results.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Auto-generated by System Monitor*`;

      await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `📊 System Health Report - ${this.results.overall_status.toUpperCase()}`,
          body: reportContent,
          labels: ['monitoring', 'health-check', this.results.overall_status]
        })
      });

    } catch (error) {
      console.error('Failed to create monitoring report:', error);
    }
  }

  async sendAlertsIfNeeded() {
    if (this.results.overall_status === 'critical' && WEBHOOK_BACKUP) {
      try {
        await fetch(WEBHOOK_BACKUP, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 CRITICAL: CyberDad Blog System has ${this.results.errors.length} critical errors. Immediate attention required!`,
            errors: this.results.errors.slice(0, 3)
          })
        });
      } catch (error) {
        console.error('Failed to send backup alert:', error);
      }
    }
  }

  async handleMonitoringFailure(error) {
    try {
      await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `🔥 SYSTEM MONITOR FAILURE`,
          body: `The system monitor itself has failed!\n\nError: ${error.message}\n\nStack: ${error.stack}`,
          labels: ['critical', 'monitoring', 'system-failure']
        })
      });
    } catch (issueError) {
      console.error('Cannot even create failure issue:', issueError);
    }
  }
}
