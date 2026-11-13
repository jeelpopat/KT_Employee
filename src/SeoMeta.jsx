import { useEffect } from 'react';
import { getSeoConfig, siteUrl } from './seoConfig.js';

const setMetaTag = (selector, attributes) => {
  let meta = document.head.querySelector(selector);

  if (!meta) {
    meta = document.createElement('meta');
    document.head.appendChild(meta);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    meta.setAttribute(key, value);
  });

  return meta;
};

export default function SeoMeta({ pathname = window.location.pathname }) {
  const seo = getSeoConfig(pathname);

  useEffect(() => {
    document.title = seo.title;
    document.documentElement.lang = 'en';

    setMetaTag('meta[name="description"]', {
      name: 'description',
      content: seo.description
    });

    setMetaTag('meta[name="keywords"]', {
      name: 'keywords',
      content: seo.keywords || ''
    });

    setMetaTag('meta[name="robots"]', {
      name: 'robots',
      content: seo.robots || 'index,follow'
    });

    setMetaTag('meta[name="author"]', {
      name: 'author',
      content: 'Kevalon Technology'
    });

    setMetaTag('meta[property="og:type"]', {
      property: 'og:type',
      content: seo.type || 'website'
    });

    setMetaTag('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: 'Kevalon Technology'
    });

    setMetaTag('meta[property="og:title"]', {
      property: 'og:title',
      content: seo.title
    });

    setMetaTag('meta[property="og:description"]', {
      property: 'og:description',
      content: seo.description
    });

    setMetaTag('meta[property="og:url"]', {
      property: 'og:url',
      content: `${siteUrl}${seo.canonical || '/'}`
    });

    setMetaTag('meta[property="og:image"]', {
      property: 'og:image',
      content: `${siteUrl}${seo.image || '/kevalon-logo.png'}`
    });

    setMetaTag('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image'
    });

    setMetaTag('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: seo.title
    });

    setMetaTag('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: seo.description
    });

    setMetaTag('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: `${siteUrl}${seo.image || '/kevalon-logo.png'}`
    });

    setMetaTag('link[rel="canonical"]', {
      rel: 'canonical',
      href: `${siteUrl}${seo.canonical || '/'}`
    });
  }, [seo, pathname]);

  return null;
}
