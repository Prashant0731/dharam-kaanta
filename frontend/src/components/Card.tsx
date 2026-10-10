import { FC, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: FC<CardProps> = ({ children, className, padding = 'md' }) => {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4 lg:p-6',
    lg: 'p-6 lg:p-8',
  };
  
  return (
    <div className={clsx('bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700', paddings[padding], className)}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

export const CardHeader: FC<CardHeaderProps> = ({ title, description, className }) => (
  <div className={clsx('mb-4', className)}>
    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>}
  </div>
);