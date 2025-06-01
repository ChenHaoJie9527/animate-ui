'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { cn } from '@workspace/ui/lib/utils';

const generateSpringPath = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  springConfig: {
    coilCount?: number;
    amplitudeMin?: number;
    amplitudeMax?: number;
    curveRatioMin?: number;
    curveRatioMax?: number;
    bezierOffset?: number;
  } = {},
) => {
  const {
    coilCount = 8,
    amplitudeMin = 8,
    amplitudeMax = 20,
    curveRatioMin = 0.5,
    curveRatioMax = 1,
    bezierOffset = 8,
  } = springConfig;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2) return `M${x1},${y1}`;
  const d = dist / coilCount;
  const h = Math.max(0.8, 1 - (dist - 40) / 200);
  const amplitude = Math.max(
    amplitudeMin,
    Math.min(amplitudeMax, amplitudeMax * h),
  );
  const curveRatio =
    dist <= 40
      ? curveRatioMax
      : dist <= 120
        ? curveRatioMax - ((dist - 40) / 80) * (curveRatioMax - curveRatioMin)
        : curveRatioMin;
  const ux = dx / dist,
    uy = dy / dist;
  const perpX = -uy,
    perpY = ux;

  let path = [];
  for (let i = 0; i < coilCount; i++) {
    const sx = x1 + ux * (i * d);
    const sy = y1 + uy * (i * d);
    const ex = x1 + ux * ((i + 1) * d);
    const ey = y1 + uy * ((i + 1) * d);

    const mx = x1 + ux * ((i + 0.5) * d) + perpX * amplitude;
    const my = y1 + uy * ((i + 0.5) * d) + perpY * amplitude;

    const c1x = sx + d * curveRatio * ux;
    const c1y = sy + d * curveRatio * uy;
    const c2x = mx + ux * bezierOffset;
    const c2y = my + uy * bezierOffset;
    const c3x = mx - ux * bezierOffset;
    const c3y = my - uy * bezierOffset;
    const c4x = ex - d * curveRatio * ux;
    const c4y = ey - d * curveRatio * uy;

    if (i === 0) path.push(`M${sx},${sy}`);
    else path.push(`L${sx},${sy}`);
    path.push(`C${c1x},${c1y} ${c2x},${c2y} ${mx},${my}`);
    path.push(`C${c3x},${c3y} ${c4x},${c4y} ${ex},${ey}`);
  }
  return path.join(' ');
};

function useMotionValueValue(mv: any) {
  return React.useSyncExternalStore(
    (callback) => {
      const unsub = mv.on('change', callback);
      return unsub;
    },
    () => mv.get(),
    () => mv.get(),
  );
}

type SpringAvatarProps = {
  children: React.ReactElement;
  springClassName?: string;
  dragElastic?: number;
  springConfig?: { stiffness?: number; damping?: number };
  springPathConfig?: {
    coilCount?: number;
    amplitudeMin?: number;
    amplitudeMax?: number;
    curveRatioMin?: number;
    curveRatioMax?: number;
    bezierOffset?: number;
  };
};

function SpringElement({
  children,
  springClassName,
  dragElastic = 0.4,
  springConfig = { stiffness: 200, damping: 16 },
  springPathConfig = {},
}: SpringAvatarProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, {
    stiffness: springConfig.stiffness,
    damping: springConfig.damping,
  });
  const springY = useSpring(y, {
    stiffness: springConfig.stiffness,
    damping: springConfig.damping,
  });

  const sx = useMotionValueValue(springX);
  const sy = useMotionValueValue(springY);

  const childRef = React.useRef<HTMLDivElement>(null);
  const [center, setCenter] = React.useState({ x: 0, y: 0 });

  React.useLayoutEffect(() => {
    function update() {
      if (childRef.current) {
        const rect = childRef.current.getBoundingClientRect();
        setCenter({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  const path = generateSpringPath(
    center.x,
    center.y,
    center.x + sx,
    center.y + sy,
    springPathConfig,
  );

  return (
    <>
      <svg
        width="100vw"
        height="100vh"
        className="fixed inset-0 w-screen h-screen pointer-events-none z-40 inset-0"
      >
        <path
          d={path}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'stroke-2 stroke-neutral-900 fill-none',
            springClassName,
          )}
        />
      </svg>
      <motion.div
        ref={childRef}
        className="z-50"
        style={{
          x: springX,
          y: springY,
        }}
        drag
        dragElastic={dragElastic}
        dragMomentum={false}
        onDrag={(e, info) => {
          x.set(info.offset.x);
          y.set(info.offset.y);
        }}
        onDragEnd={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {children}
      </motion.div>
    </>
  );
}

export { SpringElement };
