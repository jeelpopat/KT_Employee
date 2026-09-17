export const currentUser = {
  id: 'emp-8492',
  employeeId: 'EMP-8492',
  name: 'Alex Morgan',
  email: 'alex.morgan@enterprise.com',
  phone: '+1 (555) 234-8900',
  designation: 'Senior Full Stack Developer',
  department: 'Software Engineering',
  joiningDate: '15 Jan 2023',
  photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  status: 'active'
};

export const assignedProjects = [
  {
    id: 'prj-01',
    name: 'Kevalon CRM Platform',
    code: 'KEV-CRM',
    assignedEmployeeIds: ['emp-8492', 'emp-1024']
  },
  {
    id: 'prj-02',
    name: 'Tapzy Mobile Application',
    code: 'TAP-MOB',
    assignedEmployeeIds: ['emp-8492']
  },
  {
    id: 'prj-03',
    name: 'Enterprise HRMS Portal v2.0',
    code: 'HRM-V2',
    assignedEmployeeIds: ['emp-8492', 'emp-2048']
  }
];

export const assignedTasks = [
  {
    id: 'tsk-101',
    title: 'Design & Implement Employee Dashboard UI',
    description: 'Build modern SaaS dashboard cards, dark sidebar, header with notification bell, and responsive container layout.',
    projectId: 'prj-03',
    projectName: 'Enterprise HRMS Portal v2.0',
    assignedToId: 'emp-8492',
    assignedBy: 'Sarah Jenkins (Tech Lead)',
    priority: 'urgent',
    status: 'in_progress',
    startDate: '2026-08-18',
    dueDate: '2026-08-22',
    estimatedHours: 24,
    spentHours: 16,
    progressPercentage: 70,
    attachments: [
      { id: 'att-1', name: 'UI_Wireframe_v2.pdf', size: '2.4 MB', type: 'application/pdf', uploadedAt: '2026-08-18 10:30 AM' },
      { id: 'att-2', name: 'Color_Palette_Guide.png', size: '850 KB', type: 'image/png', uploadedAt: '2026-08-19 02:15 PM' }
    ],
    comments: [
      { id: 'c-1', author: 'Sarah Jenkins', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', text: 'Please ensure we have dark mode support for the sidebar!', date: '18 Aug 2026, 11:00 AM' },
      { id: 'c-2', author: 'Alex Morgan', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', text: 'Sidebar implemented with dark slate theme and WordPress-style collapsible navigation.', date: '19 Aug 2026, 04:30 PM' }
    ],
    activity: [
      { id: 'act-1', date: '18 Aug 2026 09:00 AM', user: 'Sarah Jenkins', text: 'Created task and assigned to Alex Morgan' },
      { id: 'act-2', date: '19 Aug 2026 02:00 PM', user: 'Alex Morgan', text: 'Updated progress to 70%' }
    ]
  },
  {
    id: 'tsk-102',
    title: 'Integrate Real-Time Screenshot Capture Feed',
    description: 'Implement frontend heartbeat ticker, pause on break triggers, and lightbox history viewer.',
    projectId: 'prj-03',
    projectName: 'Enterprise HRMS Portal v2.0',
    assignedToId: 'emp-8492',
    assignedBy: 'Sarah Jenkins (Tech Lead)',
    priority: 'high',
    status: 'in_progress',
    startDate: '2026-08-19',
    dueDate: '2026-08-23',
    estimatedHours: 16,
    spentHours: 10,
    progressPercentage: 60,
    attachments: [],
    comments: [],
    activity: []
  },
  {
    id: 'tsk-103',
    title: 'Kevalon CRM REST API Authentication Flow',
    description: 'OAuth2 bearer token refresh mechanism and local session storage fallback handler.',
    projectId: 'prj-01',
    projectName: 'Kevalon CRM Platform',
    assignedToId: 'emp-8492',
    assignedBy: 'David Miller (Product Manager)',
    priority: 'medium',
    status: 'todo',
    startDate: '2026-08-21',
    dueDate: '2026-08-25',
    estimatedHours: 12,
    spentHours: 0,
    progressPercentage: 0,
    attachments: [],
    comments: [],
    activity: []
  },
  {
    id: 'tsk-104',
    title: 'Tapzy Push Notification Gateway Setup',
    description: 'Configure FCM push notification triggers for transaction updates and daily summaries.',
    projectId: 'prj-02',
    projectName: 'Tapzy Mobile Application',
    assignedToId: 'emp-8492',
    assignedBy: 'David Miller (Product Manager)',
    priority: 'low',
    status: 'review',
    startDate: '2026-08-15',
    dueDate: '2026-08-20',
    estimatedHours: 8,
    spentHours: 8,
    progressPercentage: 90,
    attachments: [],
    comments: [],
    activity: []
  },
  {
    id: 'tsk-105',
    title: 'Refactor Attendance Timeline Horizontal Canvas',
    description: 'Create responsive color-coded timeline bars (Blue/Yellow/Grey) supporting First Half and Second Half shifts.',
    projectId: 'prj-03',
    projectName: 'Enterprise HRMS Portal v2.0',
    assignedToId: 'emp-8492',
    assignedBy: 'Sarah Jenkins (Tech Lead)',
    priority: 'urgent',
    status: 'completed',
    startDate: '2026-08-16',
    dueDate: '2026-08-19',
    estimatedHours: 14,
    spentHours: 14,
    progressPercentage: 100,
    attachments: [],
    comments: [],
    activity: []
  }
];

export const initialAttendanceRecords = [
  {
    id: 'att-10',
    date: '2026-08-20',
    formattedDate: '20 Aug 2026',
    dayName: 'Thursday',
    checkIn: '10:00 AM',
    checkOut: '07:00 PM',
    breakStart: '01:30 PM',
    breakEnd: '02:30 PM',
    totalWorkingHours: '8 hrs 00 mins',
    breakDuration: '1 hr 00 min',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '01:30 PM', startPercent: 0, widthPercent: 38.8, label: 'Working (3.5 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:30 PM', endTime: '02:30 PM', startPercent: 38.8, widthPercent: 11.1, label: 'Break (1 hr)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:30 PM', endTime: '07:00 PM', startPercent: 49.9, widthPercent: 50.1, label: 'Working (4.5 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-09',
    date: '2026-08-19',
    formattedDate: '19 Aug 2026',
    dayName: 'Wednesday',
    checkIn: '10:00 AM',
    checkOut: '07:00 PM',
    breakStart: '01:00 PM',
    breakEnd: '02:00 PM',
    totalWorkingHours: '8 hrs 00 mins',
    breakDuration: '1 hr 00 min',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '01:00 PM', startPercent: 0, widthPercent: 33.3, label: 'Working (3 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:00 PM', endTime: '02:00 PM', startPercent: 33.3, widthPercent: 11.1, label: 'Break (1 hr)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:00 PM', endTime: '07:00 PM', startPercent: 44.4, widthPercent: 55.6, label: 'Working (5 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-08',
    date: '2026-08-18',
    formattedDate: '18 Aug 2026',
    dayName: 'Tuesday',
    checkIn: '10:00 AM',
    checkOut: '02:00 PM',
    breakStart: 'N/A',
    breakEnd: 'N/A',
    totalWorkingHours: '4 hrs 00 mins',
    breakDuration: '0 mins',
    status: 'half_day_first',
    isHalfDay: true,
    halfDayType: 'first_half',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '02:00 PM', startPercent: 0, widthPercent: 44.4, label: 'First Half Working (4 hrs)', color: 'blue' },
      { id: 's2', type: 'inactive', startTime: '02:00 PM', endTime: '07:00 PM', startPercent: 44.4, widthPercent: 55.6, label: 'First Half Leave (Non-working)', color: 'grey' }
    ]
  },
  {
    id: 'att-07',
    date: '2026-08-17',
    formattedDate: '17 Aug 2026',
    dayName: 'Monday',
    checkIn: '02:00 PM',
    checkOut: '07:00 PM',
    breakStart: 'N/A',
    breakEnd: 'N/A',
    totalWorkingHours: '5 hrs 00 mins',
    breakDuration: '0 mins',
    status: 'half_day_second',
    isHalfDay: true,
    halfDayType: 'second_half',
    segments: [
      { id: 's1', type: 'inactive', startTime: '10:00 AM', endTime: '02:00 PM', startPercent: 0, widthPercent: 44.4, label: 'Second Half Leave (Non-working)', color: 'grey' },
      { id: 's2', type: 'working', startTime: '02:00 PM', endTime: '07:00 PM', startPercent: 44.4, widthPercent: 55.6, label: 'Second Half Working (5 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-06',
    date: '2026-08-15',
    formattedDate: '15 Aug 2026',
    dayName: 'Saturday',
    checkIn: '10:15 AM',
    checkOut: '06:45 PM',
    breakStart: '01:15 PM',
    breakEnd: '02:00 PM',
    totalWorkingHours: '7 hrs 45 mins',
    breakDuration: '45 mins',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:15 AM', endTime: '01:15 PM', startPercent: 2.7, widthPercent: 33.3, label: 'Working (3 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:15 PM', endTime: '02:00 PM', startPercent: 36.0, widthPercent: 8.3, label: 'Break (45 mins)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:00 PM', endTime: '06:45 PM', startPercent: 44.3, widthPercent: 52.8, label: 'Working (4.75 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-05',
    date: '2026-08-14',
    formattedDate: '14 Aug 2026',
    dayName: 'Friday',
    checkIn: '10:00 AM',
    checkOut: '07:00 PM',
    breakStart: '01:00 PM',
    breakEnd: '02:00 PM',
    totalWorkingHours: '8 hrs 00 mins',
    breakDuration: '1 hr 00 min',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '01:00 PM', startPercent: 0, widthPercent: 33.3, label: 'Working (3 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:00 PM', endTime: '02:00 PM', startPercent: 33.3, widthPercent: 11.1, label: 'Break (1 hr)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:00 PM', endTime: '07:00 PM', startPercent: 44.4, widthPercent: 55.6, label: 'Working (5 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-04',
    date: '2026-08-13',
    formattedDate: '13 Aug 2026',
    dayName: 'Thursday',
    checkIn: '10:30 AM',
    checkOut: '07:00 PM',
    breakStart: '01:30 PM',
    breakEnd: '02:15 PM',
    totalWorkingHours: '7 hrs 45 mins',
    breakDuration: '45 mins',
    status: 'late',
    segments: [
      { id: 's1', type: 'inactive', startTime: '10:00 AM', endTime: '10:30 AM', startPercent: 0, widthPercent: 5.5, label: 'Late Arrival (30 mins)', color: 'grey' },
      { id: 's2', type: 'working', startTime: '10:30 AM', endTime: '01:30 PM', startPercent: 5.5, widthPercent: 33.3, label: 'Working (3 hrs)', color: 'blue' },
      { id: 's3', type: 'break', startTime: '01:30 PM', endTime: '02:15 PM', startPercent: 38.8, widthPercent: 8.3, label: 'Break (45 mins)', color: 'yellow' },
      { id: 's4', type: 'working', startTime: '02:15 PM', endTime: '07:00 PM', startPercent: 47.1, widthPercent: 52.9, label: 'Working (4.75 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-03',
    date: '2026-08-12',
    formattedDate: '12 Aug 2026',
    dayName: 'Wednesday',
    checkIn: '10:00 AM',
    checkOut: '07:00 PM',
    breakStart: '01:00 PM',
    breakEnd: '02:00 PM',
    totalWorkingHours: '8 hrs 00 mins',
    breakDuration: '1 hr 00 min',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '01:00 PM', startPercent: 0, widthPercent: 33.3, label: 'Working (3 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:00 PM', endTime: '02:00 PM', startPercent: 33.3, widthPercent: 11.1, label: 'Break (1 hr)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:00 PM', endTime: '07:00 PM', startPercent: 44.4, widthPercent: 55.6, label: 'Working (5 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-02',
    date: '2026-08-11',
    formattedDate: '11 Aug 2026',
    dayName: 'Tuesday',
    checkIn: '10:00 AM',
    checkOut: '07:00 PM',
    breakStart: '01:30 PM',
    breakEnd: '02:30 PM',
    totalWorkingHours: '8 hrs 00 mins',
    breakDuration: '1 hr 00 min',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '01:30 PM', startPercent: 0, widthPercent: 38.8, label: 'Working (3.5 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:30 PM', endTime: '02:30 PM', startPercent: 38.8, widthPercent: 11.1, label: 'Break (1 hr)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:30 PM', endTime: '07:00 PM', startPercent: 49.9, widthPercent: 50.1, label: 'Working (4.5 hrs)', color: 'blue' }
    ]
  },
  {
    id: 'att-01',
    date: '2026-08-10',
    formattedDate: '10 Aug 2026',
    dayName: 'Monday',
    checkIn: '10:00 AM',
    checkOut: '07:00 PM',
    breakStart: '01:00 PM',
    breakEnd: '02:00 PM',
    totalWorkingHours: '8 hrs 00 mins',
    breakDuration: '1 hr 00 min',
    status: 'present',
    segments: [
      { id: 's1', type: 'working', startTime: '10:00 AM', endTime: '01:00 PM', startPercent: 0, widthPercent: 33.3, label: 'Working (3 hrs)', color: 'blue' },
      { id: 's2', type: 'break', startTime: '01:00 PM', endTime: '02:00 PM', startPercent: 33.3, widthPercent: 11.1, label: 'Break (1 hr)', color: 'yellow' },
      { id: 's3', type: 'working', startTime: '02:00 PM', endTime: '07:00 PM', startPercent: 44.4, widthPercent: 55.6, label: 'Working (5 hrs)', color: 'blue' }
    ]
  }
];

export const initialDailyReports = [
  {
    id: 'rep-01',
    date: '2026-08-19',
    projectId: 'prj-03',
    projectName: 'Enterprise HRMS Portal v2.0',
    taskId: 'tsk-101',
    taskName: 'Design & Implement Employee Dashboard UI',
    workingTimeHours: 5,
    workUpdate: 'Completed WordPress Admin style sidebar navigation, header notifications, and responsiveness layout.',
    status: 'in_progress',
    submittedAt: '19 Aug 2026, 06:50 PM'
  },
  {
    id: 'rep-02',
    date: '2026-08-19',
    projectId: 'prj-03',
    projectName: 'Enterprise HRMS Portal v2.0',
    taskId: 'tsk-102',
    taskName: 'Integrate Real-Time Screenshot Capture Feed',
    workingTimeHours: 3,
    workUpdate: 'Built client session ticker with 10s auto capture frequency and pause on break condition handler.',
    status: 'completed',
    submittedAt: '19 Aug 2026, 06:55 PM'
  },
  {
    id: 'rep-03',
    date: '2026-08-18',
    projectId: 'prj-03',
    projectName: 'Enterprise HRMS Portal v2.0',
    taskId: 'tsk-105',
    taskName: 'Refactor Attendance Timeline Horizontal Canvas',
    workingTimeHours: 4,
    workUpdate: 'Implemented blue/yellow/grey horizontal timeline bar chart supporting first-half and second-half options.',
    status: 'completed',
    submittedAt: '18 Aug 2026, 01:55 PM'
  }
];

export const initialLeaveRequests = [
  {
    id: 'lvr-101',
    leaveType: 'casual',
    startDate: '2026-09-02',
    endDate: '2026-09-03',
    totalDays: 2,
    isHalfDay: false,
    reason: 'Family event out of town.',
    status: 'pending',
    appliedDate: '18 Aug 2026'
  },
  {
    id: 'lvr-100',
    leaveType: 'sick',
    startDate: '2026-08-04',
    endDate: '2026-08-04',
    totalDays: 0.5,
    isHalfDay: true,
    halfDayType: 'second_half',
    reason: 'Dental appointment in afternoon.',
    status: 'approved',
    appliedDate: '03 Aug 2026'
  },
  {
    id: 'lvr-099',
    leaveType: 'annual',
    startDate: '2026-07-10',
    endDate: '2026-07-14',
    totalDays: 5,
    isHalfDay: false,
    reason: 'Summer vacation trip.',
    status: 'approved',
    appliedDate: '01 Jul 2026'
  }
];

export const upcomingHolidays = [
  { id: 'hol-1', name: 'Labor Day', date: '07 Sep 2026', day: 'Monday', daysRemaining: 18 },
  { id: 'hol-2', name: 'Thanksgiving Break', date: '26 Nov 2026', day: 'Thursday', daysRemaining: 98 },
  { id: 'hol-3', name: 'Christmas Day', date: '25 Dec 2026', day: 'Friday', daysRemaining: 127 }
];

export const upcomingBirthdays = [
  {
    id: 'bth-1',
    name: 'Rahul Patel',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    designation: 'UI/UX Designer',
    date: '24 Aug 2026',
    daysRemaining: 4
  },
  {
    id: 'bth-2',
    name: 'Priya Sharma',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    designation: 'QA Lead',
    date: '29 Aug 2026',
    daysRemaining: 9
  }
];

export const teamMembersOnLeave = [
  {
    id: 'tml-1',
    name: 'David Miller',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    designation: 'Product Manager',
    leaveType: 'Casual Leave',
    duration: '20 Aug – 21 Aug'
  }
];

export const initialNotifications = [
  {
    id: 'notif-1',
    title: 'Attendance Checked In',
    message: 'Work session SES-20260820-001 started at 10:00 AM.',
    time: '1 hr ago',
    isRead: false,
    type: 'attendance'
  },
  {
    id: 'notif-2',
    title: 'New Task Assigned',
    message: 'Integrate Real-Time Screenshot Capture Feed assigned by Sarah Jenkins.',
    time: '3 hrs ago',
    isRead: false,
    type: 'task'
  },
  {
    id: 'notif-3',
    title: 'Leave Request Status',
    message: 'Your leave application for Sep 02 – Sep 03 is pending lead review.',
    time: 'Yesterday',
    isRead: true,
    type: 'leave'
  }
];

export const initialScreenshots = [
  {
    id: 'scr-105',
    employeeId: 'EMP-8492',
    employeeName: 'Alex Morgan',
    designation: 'Senior Full Stack Developer',
    date: '2026-08-20',
    captureTime: '11:35:10 AM',
    sessionId: 'SES-20260820-001',
    checkInTime: '10:00:00 AM',
    sequenceNo: 145,
    thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80',
    activityLevel: 94,
    activeWindow: 'VS Code - EmployeeView.jsx'
  },
  {
    id: 'scr-104',
    employeeId: 'EMP-8492',
    employeeName: 'Alex Morgan',
    designation: 'Senior Full Stack Developer',
    date: '2026-08-20',
    captureTime: '11:35:00 AM',
    sessionId: 'SES-20260820-001',
    checkInTime: '10:00:00 AM',
    sequenceNo: 144,
    thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
    activityLevel: 88,
    activeWindow: 'Chrome - Kevalon CRM Spec'
  },
  {
    id: 'scr-103',
    employeeId: 'EMP-8492',
    employeeName: 'Alex Morgan',
    designation: 'Senior Full Stack Developer',
    date: '2026-08-20',
    captureTime: '11:34:50 AM',
    sessionId: 'SES-20260820-001',
    checkInTime: '10:00:00 AM',
    sequenceNo: 143,
    thumbnailUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&auto=format&fit=crop&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&auto=format&fit=crop&q=80',
    activityLevel: 91,
    activeWindow: 'VS Code - mockData.js'
  },
  {
    id: 'scr-102',
    employeeId: 'EMP-8492',
    employeeName: 'Alex Morgan',
    designation: 'Senior Full Stack Developer',
    date: '2026-08-20',
    captureTime: '11:34:40 AM',
    sessionId: 'SES-20260820-001',
    checkInTime: '10:00:00 AM',
    sequenceNo: 142,
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
    activityLevel: 79,
    activeWindow: 'Terminal - vite dev'
  },
  {
    id: 'scr-101',
    employeeId: 'EMP-1024',
    employeeName: 'Rahul Patel',
    designation: 'UI/UX Designer',
    date: '2026-08-20',
    captureTime: '11:30:10 AM',
    sessionId: 'SES-20260820-002',
    checkInTime: '10:15:00 AM',
    sequenceNo: 72,
    thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&auto=format&fit=crop&q=80',
    fullUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=80',
    activityLevel: 96,
    activeWindow: 'Figma - HRMS UI Redesign'
  }
];
