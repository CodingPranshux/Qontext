import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const VARIANT_CLASSES = {
  // Matches the Stitch reference's filled CTAs (Sign In / Get Started) — an
  // off-white fill with near-black text, not accent-colored. The accent
  // (primary) color is reserved for functional accents: links, focus rings,
  // active nav state, the chat send button.
  primary: 'bg-on-surface text-surface hover:bg-inverse-surface',
  secondary: 'bg-surface-container-lowest border border-outline-variant/50 text-on-surface hover:bg-surface-container-high',
  ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
};

/**
 * Class-builder counterpart to the Button component, for the handful of
 * places that need a button-*styled* element that isn't a real <button> (e.g.
 * a react-router <Link> acting as a CTA) — mirrors Card.jsx's `cardClasses`.
 */
export function buttonClasses({ variant = 'primary', icon = false, className } = {}) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold leading-none',
    'transition-colors duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:opacity-50 disabled:pointer-events-none',
    icon ? 'p-2' : 'px-4 py-2.5',
    VARIANT_CLASSES[variant],
    className
  );
}

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
      className={buttonClasses({ variant, icon, className })}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export default Button;
