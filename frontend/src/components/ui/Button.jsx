import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const VARIANT_CLASSES = {
  primary: 'bg-accent text-bg hover:bg-accent-hover',
  secondary: 'bg-surface border border-border text-text hover:bg-surface-2 hover:border-accent/40',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text',
};

/**
 * Shared button primitive: consistent radius/spacing/focus-ring/hover-transition
 * baked in once, plus a tap micro-interaction, so no button in the app has to
 * redefine these by hand.
 */
const Button = forwardRef(function Button(
  { variant = 'primary', icon = false, className, children, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold leading-none',
        'transition-colors duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:opacity-50 disabled:pointer-events-none',
        icon ? 'p-2' : 'px-4 py-2.5',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export default Button;
