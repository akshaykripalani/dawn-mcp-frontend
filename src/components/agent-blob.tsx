"use client";

import { motion } from "framer-motion";

type AgentState = "idle" | "listening" | "thinking" | "speaking";

const blobVariants: any = {
  idle: {
    scale: [1, 1.05, 1],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
  listening: {
    scale: [1.1, 1.2, 1.1],
    transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    scale: [1.05, 1.1, 1.05],
    rotate: [0, 360],
    transition: { duration: 8, repeat: Infinity, ease: "linear" },
  },
  speaking: {
    scale: [1.15, 1.25, 1.15],
    transition: { duration: 0.6, repeat: Infinity, ease: "easeInOut" },
  },
};

const textVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.5 } },
};

const AgentBlob = ({ state }: { state: AgentState }) => {
  return (
    <div className="relative w-96 h-96 flex items-center justify-center overflow-hidden">
      {/* Main animated blob */}
      <motion.div
        className="relative w-80 h-80"
        variants={blobVariants}
        initial="idle"
        animate={state}
      >
        {/* Primary blob - larger and softer gradient */}
        <motion.div
          className="w-full h-full rounded-full shadow-xl"
          style={{
            background: `radial-gradient(circle at 30% 30%, #ffab85 0%, #ffab85 20%, #ff9e77 40%, #ff9169 60%, #ff845b 80%, #ff774d 100%)`,
          }}
          animate={{
            borderRadius: ["50%", "55% 45% 60% 40%", "40% 60% 45% 55%", "50%"],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Secondary overlay blob for extra organic movement */}
        <motion.div
          className="absolute top-8 left-8 w-64 h-64 rounded-full opacity-60"
          style={{
            background: `radial-gradient(circle at 60% 40%, #ffab85cc, #ffc499aa, #ffb085aa)`,
          }}
          animate={{
            x: [-10, 15, -5, 10, -10],
            y: [-5, 10, -15, 5, -5],
            scale: [1, 1.05, 0.98, 1.02, 1],
            borderRadius: ["50%", "45% 55% 50% 50%", "55% 45% 60% 40%", "50%"],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </div>
  );
};

export default AgentBlob;
