import React from 'react';
import { AttendanceView } from './AttendanceView.jsx';
import { DashboardView } from '../dashboard/DashboardView.jsx';

export const MyAttendanceView = () => (
  <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Attendance</h1>
      <p className="mt-1 text-sm text-slate-500">Manage today&apos;s attendance and review your attendance history.</p>
    </div>
    <DashboardView attendanceOnly />
    <section aria-labelledby="attendance-history-heading" className="space-y-4">
      <h2 id="attendance-history-heading" className="text-base font-semibold text-slate-900">Attendance History</h2>
      <AttendanceView />
    </section>
  </div>
);
