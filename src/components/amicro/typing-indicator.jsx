import { motion, useReducedMotion } from "motion/react";

export function TypingIndicator({ className = "" }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={`amicro-typing-indicator ${className}`.trim()}
      role="status"
      aria-label="正在思考"
    >
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="amicro-typing-dot"
          animate={shouldReduceMotion ? { y: 0 } : { y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: index * 0.15,
            ease: "easeInOut",
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
