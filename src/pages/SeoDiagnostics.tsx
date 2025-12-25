import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, FileText, Globe, Link2 } from "lucide-react";

interface DiagnosticResult {
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: string;
}

interface DiagnosticResults {
  robotsTxt: DiagnosticResult;
  sitemapXml: DiagnosticResult;
  canonicalUrl: DiagnosticResult;
  metaTags: DiagnosticResult;
  ogTags: DiagnosticResult;
}

const SeoDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResults>({
    robotsTxt: { status: 'pending', message: 'Not checked yet' },
    sitemapXml: { status: 'pending', message: 'Not checked yet' },
    canonicalUrl: { status: 'pending', message: 'Not checked yet' },
    metaTags: { status: 'pending', message: 'Not checked yet' },
    ogTags: { status: 'pending', message: 'Not checked yet' },
  });

  const productionUrl = 'https://quickfollowers.online';

  const checkRobotsTxt = async (): Promise<DiagnosticResult> => {
    try {
      const response = await fetch(`${productionUrl}/robots.txt`);
      if (!response.ok) {
        return { status: 'error', message: 'robots.txt not accessible', details: `HTTP ${response.status}` };
      }
      const content = await response.text();
      
      const hasUserAgent = content.includes('User-agent:');
      const hasSitemap = content.includes('Sitemap:');
      const blocksGoogle = content.includes('Disallow: /') && !content.includes('Allow:');
      
      if (blocksGoogle) {
        return { status: 'error', message: 'robots.txt is blocking crawlers', details: 'Found blanket Disallow rule' };
      }
      
      if (!hasUserAgent) {
        return { status: 'warning', message: 'robots.txt missing User-agent directive', details: content.substring(0, 200) };
      }
      
      if (!hasSitemap) {
        return { status: 'warning', message: 'robots.txt missing Sitemap reference', details: 'Add Sitemap: directive' };
      }
      
      return { status: 'success', message: 'robots.txt is properly configured', details: content.substring(0, 300) };
    } catch (error) {
      return { status: 'error', message: 'Failed to fetch robots.txt', details: String(error) };
    }
  };

  const checkSitemapXml = async (): Promise<DiagnosticResult> => {
    try {
      const response = await fetch(`${productionUrl}/sitemap.xml`);
      if (!response.ok) {
        return { status: 'error', message: 'sitemap.xml not accessible', details: `HTTP ${response.status}` };
      }
      const content = await response.text();
      
      const isXml = content.includes('<?xml') || content.includes('<urlset');
      const hasUrls = content.includes('<url>') && content.includes('<loc>');
      const urlCount = (content.match(/<url>/g) || []).length;
      
      if (!isXml) {
        return { status: 'error', message: 'sitemap.xml is not valid XML', details: 'File does not appear to be XML format' };
      }
      
      if (!hasUrls) {
        return { status: 'warning', message: 'sitemap.xml has no URL entries', details: 'Add <url> entries with <loc> tags' };
      }
      
      return { 
        status: 'success', 
        message: `sitemap.xml is valid with ${urlCount} URL(s)`, 
        details: content.substring(0, 400) 
      };
    } catch (error) {
      return { status: 'error', message: 'Failed to fetch sitemap.xml', details: String(error) };
    }
  };

  const checkCanonicalUrl = (): DiagnosticResult => {
    const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    
    if (!canonicalLink) {
      return { status: 'warning', message: 'No canonical URL found', details: 'Add <link rel="canonical"> to prevent duplicate content issues' };
    }
    
    const canonicalHref = canonicalLink.href;
    const isProduction = canonicalHref.includes('quickfollowers.online');
    
    if (!isProduction) {
      return { 
        status: 'warning', 
        message: 'Canonical URL points to non-production domain', 
        details: `Current: ${canonicalHref}` 
      };
    }
    
    return { status: 'success', message: 'Canonical URL is set correctly', details: canonicalHref };
  };

  const checkMetaTags = (): DiagnosticResult => {
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    const metaKeywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
    
    const issues: string[] = [];
    
    if (!title || title.length < 10) {
      issues.push('Title tag is missing or too short');
    } else if (title.length > 60) {
      issues.push(`Title is too long (${title.length} chars, recommended: <60)`);
    }
    
    if (!metaDescription || !metaDescription.content) {
      issues.push('Meta description is missing');
    } else if (metaDescription.content.length > 160) {
      issues.push(`Description is too long (${metaDescription.content.length} chars, recommended: <160)`);
    }
    
    if (!metaKeywords || !metaKeywords.content) {
      issues.push('Meta keywords are missing');
    }
    
    if (issues.length === 0) {
      return { 
        status: 'success', 
        message: 'All essential meta tags are present', 
        details: `Title: "${title.substring(0, 50)}..."` 
      };
    }
    
    if (issues.length <= 1) {
      return { status: 'warning', message: issues[0], details: issues.join('\n') };
    }
    
    return { status: 'error', message: `${issues.length} meta tag issues found`, details: issues.join('\n') };
  };

  const checkOgTags = (): DiagnosticResult => {
    const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement;
    const ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement;
    const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
    const twitterCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement;
    
    const missing: string[] = [];
    
    if (!ogTitle?.content) missing.push('og:title');
    if (!ogDescription?.content) missing.push('og:description');
    if (!ogImage?.content) missing.push('og:image');
    if (!ogUrl?.content) missing.push('og:url');
    if (!twitterCard?.content) missing.push('twitter:card');
    
    if (missing.length === 0) {
      return { 
        status: 'success', 
        message: 'All Open Graph & Twitter tags are present', 
        details: `OG Image: ${ogImage?.content?.substring(0, 60) || 'N/A'}` 
      };
    }
    
    if (missing.length <= 2) {
      return { 
        status: 'warning', 
        message: `Missing ${missing.length} social meta tag(s)`, 
        details: `Missing: ${missing.join(', ')}` 
      };
    }
    
    return { 
      status: 'error', 
      message: `Missing ${missing.length} social meta tags`, 
      details: `Missing: ${missing.join(', ')}` 
    };
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    
    // Reset all to pending
    setResults({
      robotsTxt: { status: 'pending', message: 'Checking...' },
      sitemapXml: { status: 'pending', message: 'Checking...' },
      canonicalUrl: { status: 'pending', message: 'Checking...' },
      metaTags: { status: 'pending', message: 'Checking...' },
      ogTags: { status: 'pending', message: 'Checking...' },
    });

    // Run all checks
    const [robotsResult, sitemapResult] = await Promise.all([
      checkRobotsTxt(),
      checkSitemapXml(),
    ]);
    
    const canonicalResult = checkCanonicalUrl();
    const metaResult = checkMetaTags();
    const ogResult = checkOgTags();

    setResults({
      robotsTxt: robotsResult,
      sitemapXml: sitemapResult,
      canonicalUrl: canonicalResult,
      metaTags: metaResult,
      ogTags: ogResult,
    });

    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Pass</Badge>;
      case 'error':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Warning</Badge>;
      default:
        return <Badge variant="secondary">Checking</Badge>;
    }
  };

  const diagnosticItems = [
    { key: 'robotsTxt', title: 'robots.txt', icon: FileText, result: results.robotsTxt },
    { key: 'sitemapXml', title: 'sitemap.xml', icon: Globe, result: results.sitemapXml },
    { key: 'canonicalUrl', title: 'Canonical URL', icon: Link2, result: results.canonicalUrl },
    { key: 'metaTags', title: 'Meta Tags', icon: FileText, result: results.metaTags },
    { key: 'ogTags', title: 'Open Graph & Twitter', icon: ExternalLink, result: results.ogTags },
  ];

  const passCount = Object.values(results).filter(r => r.status === 'success').length;
  const failCount = Object.values(results).filter(r => r.status === 'error').length;
  const warnCount = Object.values(results).filter(r => r.status === 'warning').length;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">SEO Diagnostics</h1>
              <p className="text-muted-foreground mt-1">
                Check your site's SEO readiness for search engine indexing
              </p>
            </div>
            <Button onClick={runDiagnostics} disabled={isRunning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running...' : 'Run Diagnostics'}
            </Button>
          </div>

          {/* Summary */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 justify-center">
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{passCount} Passed</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  <span className="font-medium">{warnCount} Warnings</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-lg">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="font-medium">{failCount} Failed</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diagnostic Results */}
          <div className="space-y-4">
            {diagnosticItems.map((item) => (
              <Card key={item.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.result.status)}
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                      </div>
                    </div>
                    {getStatusBadge(item.result.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{item.result.message}</p>
                  {item.result.details && (
                    <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                      {item.result.details}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Links */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Quick Links</CardTitle>
              <CardDescription>Direct links to your SEO files</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href={`${productionUrl}/robots.txt`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View robots.txt
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`${productionUrl}/sitemap.xml`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View sitemap.xml
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Google Search Console
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SeoDiagnostics;
