import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const publicPages = {
  '/security-policy': {
    eyebrow: 'SECURITY POLICY',
    title: 'Protecting your Kevalon workspace',
    description:
      'Security is a shared responsibility. These guidelines explain how to help protect your Kevalon Technology HRMS account and workplace information.',
    icon: ShieldCheck,
    sections: [
      {
        title: 'Keep your account secure',
        paragraphs: [
          'Use your own account, choose a strong password, and never share your password or sign-in codes. Sign out when using a shared device.',
          'Contact your HR or workspace administrator promptly if you notice an unfamiliar sign-in or believe your account may be compromised.'
        ]
      },
      {
        title: 'Access and workplace data',
        paragraphs: [
          'The HRMS supports role-based access for employees, team leads, HR, and administrators. Only access information needed for your assigned work, and do not share employee records outside approved channels.',
          'Depending on the features enabled by your organization, the workspace may process attendance, check-in location, payroll, deductions, and work-related records.'
        ]
      },
      {
        title: 'Report a security concern',
        paragraphs: [
          'Report suspected unauthorized access, lost devices, or accidental disclosure to your organization administrator and contact Kevalon support for assistance.'
        ]
      }
    ]
  },
  '/privacy': {
    eyebrow: 'PRIVACY POLICY',
    title: 'How your information is used',
    description:
      'This policy explains how information may be handled when you use the Kevalon Technology HRMS. Your employer or workspace administrator configures the service and determines many of the purposes, permissions, and retention settings for your organization.',
    icon: LockKeyhole,
    sections: [
      {
        title: 'Information processed by the workspace',
        paragraphs: [
          'Depending on your organization’s setup and the features you use, the HRMS may process account and profile details such as your name, work email, phone number, role, and authentication information; employment and team details; attendance and check-in records; leave, task, and work activity; documents; and payroll, payslip, or deduction records.',
          'If your organization enables location-based attendance, the service may process location information when you use the related check-in feature and grant the necessary device or browser permission. Location access depends on your device settings and the feature configuration.'
        ]
      },
      {
        title: 'Why information is used',
        paragraphs: [
          'Information is used to authenticate users, provide the HR and operations features enabled by your organization, record attendance and work activity, support leave and team workflows, prepare payroll-related information, maintain security, and respond to support requests.'
        ]
      },
      {
        title: 'Who can access information',
        paragraphs: [
          'Information may be available to authorized users in your organization according to their assigned roles and permissions. Kevalon Technology may process information to provide and support the service. Your organization is responsible for configuring access and deciding which HRMS features to use.'
        ]
      },
      {
        title: 'Retention and your privacy requests',
        paragraphs: [
          'Your employer or workspace administrator manages organization-specific employment records and determines applicable retention settings and procedures. Contact your HR team or administrator to ask about a record, request a correction, or make a privacy request. Kevalon support can help with platform-related questions, but may need to refer employment-record requests to your organization.'
        ]
      },
      {
        title: 'Security and device choices',
        paragraphs: [
          'The HRMS uses account access and role permissions to support controlled access. Protect your sign-in details, sign out on shared devices, and contact your administrator if you suspect unauthorized access. No online service can guarantee absolute security.',
          'You can manage location permissions through your browser or device settings. Turning off a permission may prevent location-dependent attendance features from working.'
        ]
      },
      {
        title: 'Organization-specific notices and contact',
        paragraphs: [
          'Your organization may provide additional notices that explain its specific use of employee information and applicable procedures. For questions about this policy or the platform, contact support@kevalon.com; for employment-record requests, contact your HR team or workspace administrator.'
        ]
      }
    ]
  },
  '/terms-of-service': {
    eyebrow: 'TERMS OF SERVICE',
    title: 'Terms for using the Kevalon HRMS',
    description:
      'These terms describe the basic conditions for accessing and using the Kevalon Technology HRMS. Your employer or workspace administrator may also set organization-specific policies for your use of its workspace.',
    icon: ShieldCheck,
    sections: [
      {
        title: 'Using the service',
        paragraphs: [
          'The HRMS provides online tools for workforce administration, attendance, leave, tasks, employee records, and payroll-related workflows. The features available to you depend on your organization’s subscription, configuration, and assigned role.',
          'By creating an account or using the service, you agree to use it in accordance with these terms and any applicable policies provided by your organization.'
        ]
      },
      {
        title: 'Accounts and access',
        paragraphs: [
          'Provide accurate account information and keep your sign-in credentials confidential. You are responsible for activity performed through your account and should promptly notify your workspace administrator if you believe it has been accessed without authorization.',
          'Your organization manages invitations, roles, permissions, and access to its workspace. Do not attempt to access information or features that your role does not authorize.'
        ]
      },
      {
        title: 'Acceptable use',
        paragraphs: [
          'Use the service only for lawful, authorized work purposes. Do not misuse the service, interfere with its operation or security, submit knowingly false records, or attempt to access another user’s account or data.',
          'Treat employee, attendance, location, and payroll information as confidential. Access or share it only as permitted by your role and your organization’s policies.'
        ]
      },
      {
        title: 'Organization data and workplace decisions',
        paragraphs: [
          'Your organization is responsible for the information it enters, its workspace configuration, and decisions made using HRMS records. Questions about employment records, attendance decisions, leave, compensation, or payroll should be directed to your HR team or workspace administrator.',
          'If location-based attendance is enabled, using the related feature may require location permission from your device or browser. Follow your organization’s instructions for using that feature.'
        ]
      },
      {
        title: 'Service availability and changes',
        paragraphs: [
          'Features may be updated, changed, or temporarily unavailable for maintenance or operational reasons. Kevalon Technology will work to maintain the service, but uninterrupted availability cannot be guaranteed.'
        ]
      },
      {
        title: 'Suspension or ending access',
        paragraphs: [
          'Your organization may change or remove your workspace access, including when your role or employment changes. Access may also be restricted when needed to protect the service, users, or organization data. Contact your workspace administrator if you believe access was removed in error.'
        ]
      },
      {
        title: 'Service ownership and feedback',
        paragraphs: [
          'The HRMS software, branding, and related materials belong to Kevalon Technology or its licensors. These terms allow you to use the service for authorized workspace purposes; they do not transfer ownership of the service or grant rights to misuse its materials.',
          'Your organization retains responsibility for the data it provides to the workspace. Do not upload content unless you are authorized to do so.'
        ]
      },
      {
        title: 'Questions',
        paragraphs: [
          'For help using the platform, contact support@kevalon.com. For organization-specific rules or workplace matters, contact your HR team or workspace administrator. These platform terms do not replace policies or notices provided by your organization.'
        ]
      }
    ]
  },
  '/support': {
    eyebrow: 'SUPPORT',
    title: 'How can we help?',
    description:
      'Kevalon Technology support can help with access to the HRMS and issues using its attendance, HR, and payroll features.',
    icon: Mail,
    sections: [
      {
        title: 'Contact the support team',
        paragraphs: [
          'Email support@kevalon.com with a short description of the issue, the page or feature involved, and the steps needed to reproduce it.'
        ],
        email: true
      },
      {
        title: 'For account and employee-record changes',
        paragraphs: [
          'For password or sign-in help, use the Forgot Password option on the login screen. For changes to your role, attendance, leave, payroll, or employee records, contact your HR or workspace administrator.'
        ]
      },
      {
        title: 'Keep your request safe',
        paragraphs: [
          'Do not include your password, one-time codes, or unnecessary sensitive employee or payroll information in a support email.'
        ]
      }
    ]
  }
};

export const PublicInfoView = ({ page }) => {
  const content = publicPages[page];

  if (!content) {
    return null;
  }

  const PageIcon = content.icon;

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 font-poppins text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-slate-600 transition hover:text-[#0088cc] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0088cc]"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <article className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:mt-8">
          <header className="bg-brand-gradient px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <PageIcon size={22} />
            </div>
            <p className="text-xs font-semibold tracking-[0.16em] text-sky-100">{content.eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{content.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50/90">{content.description}</p>
          </header>

          <div className="divide-y divide-slate-100 px-6 sm:px-10">
            {content.sections.map((section) => (
              <section key={section.title} className="py-6 first:pt-7 last:pb-7 sm:py-7">
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-sm leading-6 text-slate-600">
                    {paragraph}
                  </p>
                ))}
                {section.email && (
                  <a
                    href="mailto:support@kevalon.com"
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-50 px-4 py-2.5 text-sm font-semibold text-[#034665] transition hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0088cc]"
                  >
                    <Mail size={16} />
                    support@kevalon.com
                  </a>
                )}
              </section>
            ))}
          </div>

          <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <span>Kevalon Technology HRMS Suite</span>
            <nav aria-label="Legal and support links" className="flex flex-wrap gap-x-4 gap-y-2">
              <Link to="/terms-of-service" className="transition hover:text-[#0088cc]">Terms of Service</Link>
              <Link to="/privacy" className="transition hover:text-[#0088cc]">Privacy Policy</Link>
              <Link to="/support" className="transition hover:text-[#0088cc]">Support</Link>
            </nav>
          </footer>
        </article>
      </div>
    </main>
  );
};

export default PublicInfoView;
