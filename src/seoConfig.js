export const siteUrl = 'https://crm.kevalontechnology.com';

const defaultSeo = {
  title: 'Kevalon CRM - Smart Business CRM Software | Kevalon Technology',
  description: 'Discover Kevalon CRM by Kevalon Technology. Simplify business operations, manage customer relationships, track leads and improve productivity with smart CRM solutions.',
  keywords: 'Kevalon CRM, CRM software India, business CRM software, customer relationship management software, online CRM software, lead management software, sales management software, customer management system',
  robots: 'index,follow',
  type: 'website',
  image: '/kevalon-logo.png',
  canonical: '/'
};

const seoPages = {
  '/': {
    ...defaultSeo,
    title: 'Kevalon CRM - Smart Business CRM Software | Kevalon Technology',
    canonical: '/'
  },
  '/crm-software': {
    title: 'Kevalon CRM Software for Growing Businesses | Kevalon Technology',
    description: 'Manage leads, automate sales workflows and improve customer relationships with Kevalon CRM software designed for Indian businesses.',
    keywords: 'Kevalon CRM software, CRM software for small businesses, online CRM software, customer management software, sales management software',
    canonical: '/crm-software',
    robots: 'index,follow'
  },
  '/features': {
    title: 'CRM Features & Business Automation | Kevalon CRM',
    description: 'Explore the powerful features of Kevalon CRM, including lead management, workflow automation, customer tracking, reporting and sales pipeline control.',
    keywords: 'CRM features, lead management software, customer database management, sales pipeline management, business management software',
    canonical: '/features',
    robots: 'index,follow'
  },
  '/lead-management': {
    title: 'Lead Management Software for Sales Teams | Kevalon CRM',
    description: 'Capture, qualify and nurture leads with Kevalon CRM lead management tools that improve conversion rates and sales visibility.',
    keywords: 'lead management software, business CRM with lead management, sales management software, customer relationship management software',
    canonical: '/lead-management',
    robots: 'index,follow'
  },
  '/customer-management': {
    title: 'Customer Management System for Better Retention | Kevalon CRM',
    description: 'Streamline customer communication, track engagement and deliver better service with Kevalon customer management software.',
    keywords: 'customer management system, online customer management software, customer database management, customer relationship management software',
    canonical: '/customer-management',
    robots: 'index,follow'
  },
  '/sales-management': {
    title: 'Sales Management Software for Business Growth | Kevalon CRM',
    description: 'Shorten sales cycles, monitor performance and close more deals with affordable sales management software from Kevalon Technology.',
    keywords: 'sales management software, CRM software for sales and customer management, affordable CRM software India, sales pipeline management',
    canonical: '/sales-management',
    robots: 'index,follow'
  },
  '/about': {
    title: 'About Kevalon Technology | CRM Software Company in India',
    description: 'Learn about Kevalon Technology and how our CRM solutions support growth for modern businesses across India.',
    keywords: 'about Kevalon Technology, CRM software company India, business management software, Gujarat CRM software',
    canonical: '/about',
    robots: 'index,follow'
  },
  '/contact': {
    title: 'Contact Kevalon Technology | CRM Consultation',
    description: 'Talk to Kevalon Technology about your CRM needs, sales automation requirements and digital growth plans.',
    keywords: 'contact Kevalon, CRM consultation, sales management software, business CRM software',
    canonical: '/contact',
    robots: 'index,follow'
  },
  '/blog': {
    title: 'CRM Insights & Business Growth Blog | Kevalon Technology',
    description: 'Read practical CRM and business growth insights from Kevalon Technology to improve customer engagement and sales performance.',
    keywords: 'CRM blog, business CRM insights, customer management software, sales pipeline management, CRM software India',
    canonical: '/blog',
    robots: 'index,follow'
  },
  '/security-policy': {
    title: 'Security Policy | Kevalon Technology',
    description: 'Learn how Kevalon Technology protects account security and supports safe workspace use for HRMS and business operations.',
    canonical: '/security-policy',
    robots: 'index,follow'
  },
  '/privacy': {
    title: 'Privacy Policy | Kevalon Technology',
    description: 'Review how Kevalon Technology handles information in the HRMS and workplace platform across different business use cases.',
    canonical: '/privacy',
    robots: 'index,follow'
  },
  '/support': {
    title: 'Support | Kevalon Technology',
    description: 'Find support information for Kevalon HRMS, help with account access and guidance for workspace questions.',
    canonical: '/support',
    robots: 'index,follow'
  },
  '/terms-of-service': {
    title: 'Terms of Service | Kevalon Technology',
    description: 'Read the terms for using the Kevalon HRMS and workplace platform within your organization.',
    canonical: '/terms-of-service',
    robots: 'index,follow'
  },
  '/login': {
    title: 'Kevalon HRMS Login | Kevalon Technology',
    description: 'Secure sign in to the Kevalon HRMS workspace for attendance, payroll, employee management and operations.',
    canonical: '/login',
    robots: 'noindex,nofollow'
  },
  '/forgot-password': {
    title: 'Reset Your Password | Kevalon HRMS',
    description: 'Recover access to your Kevalon HRMS account with a secure password reset flow.',
    canonical: '/forgot-password',
    robots: 'noindex,nofollow'
  },
  '/reset-password': {
    title: 'Create a New Password | Kevalon HRMS',
    description: 'Set a new password to regain access to your Kevalon HRMS account.',
    canonical: '/reset-password',
    robots: 'noindex,nofollow'
  }
};

export function getSeoConfig(pathname) {
  const normalizedPath = pathname && pathname !== '/' ? pathname.split('?')[0].split('#')[0] : '/';
  return seoPages[normalizedPath] || defaultSeo;
}

export const seoRoutes = Object.keys(seoPages);
