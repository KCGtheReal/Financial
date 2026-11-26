import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number | string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 18, className = '', ...props }) => {
  const cleanName = typeof name === 'string' ? name.split('::__apex__:')[0] : 'CircleDollarSign';
  // Find icon in Lucide collection or fallback to CircleDollarSign
  const IconComponent = (LucideIcons as any)[cleanName] || LucideIcons.CircleDollarSign;
  return <IconComponent size={size} className={className} {...props} />;
};
