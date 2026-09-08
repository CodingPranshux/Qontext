import clsx from 'clsx';
import { motion } from 'framer-motion';

const BASE_CLASSES = 'bg-surface-container border border-outline-variant rounded-xl shadow-sm';
const HOVER_CLASSES = 'transition-all duration-200 hover:border-outline/50 hover:shadow-card';

/**
 * The "layered surface" pattern shared by every card-like element: a surface
 * background sitting visibly above the page (border + shadow), not just a
 * flat color shift. Exported as a class-builder too, for elements that need
 * the same surface treatment but a different shape (chat bubbles, dropzone).
 */
export function cardClasses({ hover = false, className } = {}) {
  return clsx(BASE_CLASSES, hover && HOVER_CLASSES, className);
}

function Card({ hover = false, motionProps, className, children, ...props }) {
  if (motionProps) {
    return (
      <motion.div className={cardClasses({ hover, className })} {...motionProps} {...props}>
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cardClasses({ hover, className })} {...props}>
      {children}
    </div>
  );
}

export default Card;
