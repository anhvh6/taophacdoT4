
import React, { useEffect } from 'react';
import { DateInput } from './DateInput';
import { CheckCircle, AlertCircle } from 'lucide-react';

export const Toast: React.FC<{ message: string; onClose: () => void; variant?: 'success' | 'error' }> = ({ message, onClose, variant = 'success' }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgClass = variant === 'error' ? 'bg-red-600' : 'bg-blue-600';
  const Icon = variant === 'error' ? AlertCircle : CheckCircle;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className={`${bgClass} text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm`}>
        <Icon size={18} />
        {message}
      </div>
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-success',
    warning: 'btn-warning',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
    outline: 'btn-ghost border-2 border-blue-100',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-[10px]',
    md: 'px-6 py-3 text-[12px]',
    lg: 'px-8 py-4 text-[14px]',
  };

  return (
    <button 
      className={`btn-modern ${variantClasses[variant as keyof typeof variantClasses]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  isTextArea?: boolean;
  icon?: React.ReactNode;
}

export const LineInput: React.FC<InputProps> = ({ label, isTextArea, icon, className = '', ...props }) => {
  if (props.type === 'date') {
    return (
      <DateInput
        label={label}
        value={String(props.value || '')}
        onChange={(iso) => {
          if (props.onChange) {
            // Tạo một synthetic event giả lập để tương thích với các handler hiện có
            const syntheticEvent = {
              target: { value: iso, name: props.name },
              currentTarget: { value: iso, name: props.name }
            } as any;
            props.onChange(syntheticEvent);
          }
        }}
        icon={icon}
        className={className}
        disabled={props.disabled}
      />
    );
  }

  const Component = isTextArea ? 'textarea' : 'input';
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">{label}</label>}
      <div className="relative w-full">
        {icon && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none flex items-center">
            {icon}
          </div>
        )}
        <Component 
          className={`line-input w-full ${icon ? 'pl-7' : ''}`} 
          {...(props as any)} 
          value={props.value ?? ''}
        />
      </div>
    </div>
  );
};

export const Card: React.FC<{ children: React.FC | React.ReactNode; className?: string; borderSide?: string; id?: string }> = ({ children, className = '', borderSide, id }) => {
  const borderStyles = borderSide ? `border-l-4 ${borderSide}` : 'border border-blue-100';
  const hasBg = className.includes('bg-');
  return (
    <div id={id} className={`${!hasBg ? 'bg-white' : ''} rounded-3xl p-6 transition-all hover:shadow-[0_10px_30px_rgba(37,99,235,0.06)] ${borderStyles} ${className}`}>
      {typeof children === 'function' ? (children as any)() : children}
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-md" onClick={onClose}></div>
      <div className={`bg-white w-full ${maxWidth} max-h-[90vh] rounded-[2rem] sm:rounded-[2.5rem] relative z-10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col`}>
        <div className="p-6 sm:p-8 border-b border-blue-50 shrink-0">
          <h3 className="text-lg sm:text-xl font-extrabold text-blue-900 uppercase tracking-tight">{title}</h3>
        </div>
        <div className="p-6 sm:p-8 text-sm text-gray-600 leading-relaxed font-medium overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
        {footer && (
          <div className="p-5 sm:p-6 bg-blue-50/50 flex justify-end gap-3 px-6 sm:px-8 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
