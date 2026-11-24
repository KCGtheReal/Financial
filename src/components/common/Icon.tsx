import React from 'react';
import * as LucideIcons from 'lucide-react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: number | string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 18, className = '', ...props }) => {
  // Find icon in Lucide collection or fallback to CircleDollarSign
  const IconComponent = (LucideIcons as any)[name] || LucideIcons.CircleDollarSign;
  return <IconComponent size={size} className={className} {...props} />;
};
