'use client';

import React, { createContext, useContext } from 'react';
import { Task, Statistics, TestPeriod } from '@/types';

interface DashboardContextType {
  dashboardData: {
    todayTasks: Task[];
    upcomingTasks: Task[];
    statistics: Statistics;
    totalUpcomingTasksCount: number;
  } | null;
  currentTestPeriod: TestPeriod | null;
  isLoading: boolean;
  onTaskUpdate: () => void;
  testPeriods: TestPeriod[];
  selectedTestPeriodId: string;
  onTestPeriodChange: (testPeriodId: string) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: React.ReactNode;
  value: DashboardContextType;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children, value }) => {
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};