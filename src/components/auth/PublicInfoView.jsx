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
    eyebrow: 'PRIVACY',
    title: 'Your information in the HRMS',
    description:
      'Kevalon Technology provides HR and operations tools that organizations use to manage their workforce. The information available to you depends on your organization and assigned role.',
    icon: LockKeyhole,
    sections: [
      {
        title: 'Information the workspace may use',
        paragraphs: [
          'Depending on your organization’s setup and the features you use, this may include account and profile details, contact information, attendance and check-in records (including location when enabled), leave and task activity, documents, and payroll or deduction records.'
        ]
      },
      {
        title: 'How information is used',
        paragraphs: [
          'Workspace information is used to provide HRMS features such as account access, attendance tracking, employee and team administration, leave workflows, and payroll operations. Access is presented according to the roles and permissions configured for your organization.'
        ]
      },
      {
        title: 'Questions or privacy requests',
        paragraphs: [
          'Your employer or workspace administrator manages organization-specific settings and employment records. For questions about a specific record, its use, or a privacy request, contact your HR or administrator. You can also contact Kevalon support for help using the platform.'
        ]
      },
      {
        title: 'Organization-specific policies',
        paragraphs: [
          'The applicable retention periods, legal basis, and procedures for handling privacy requests are determined by your organization and applicable requirements. Please consult your organization’s privacy notice or HR team for those details.'
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

          <footer className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-xs text-slate-500 sm:px-10">
            Kevalon Technology HRMS Suite
          </footer>
        </article>
      </div>
    </main>
  );
};

export default PublicInfoView;
