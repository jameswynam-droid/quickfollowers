import { useEffect } from 'react';

/**
 * Hook to add noindex/nofollow meta tags to prevent search engines from indexing the page
 * Used for authenticated/private pages that shouldn't appear in search results
 */
export function useNoIndex() {
  useEffect(() => {
    // Create meta robots tag
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    const originalContent = metaRobots?.getAttribute('content') || null;
    
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    
    metaRobots.content = 'noindex, nofollow';

    // Create googlebot specific tag for extra protection
    let metaGooglebot = document.querySelector('meta[name="googlebot"]') as HTMLMetaElement;
    const originalGooglebotContent = metaGooglebot?.getAttribute('content') || null;
    
    if (!metaGooglebot) {
      metaGooglebot = document.createElement('meta');
      metaGooglebot.name = 'googlebot';
      document.head.appendChild(metaGooglebot);
    }
    
    metaGooglebot.content = 'noindex, nofollow';

    // Cleanup on unmount - restore original or remove
    return () => {
      if (originalContent) {
        metaRobots.content = originalContent;
      } else {
        metaRobots.remove();
      }
      
      if (originalGooglebotContent) {
        metaGooglebot.content = originalGooglebotContent;
      } else {
        metaGooglebot.remove();
      }
    };
  }, []);
}
