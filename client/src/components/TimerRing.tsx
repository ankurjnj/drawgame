interface Props {
  value: number;
  max: number;
  size?: number;
}

export default function TimerRing({ value, max, size = 80 }: Props) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? value / max : 0;
  const offset = circumference * (1 - progress);

  const color = value <= 3 ? '#ef4444' : value <= 6 ? '#f59e0b' : '#7B2FFF';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="timer-ring absolute">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="timer-ring-progress"
          style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className="text-white font-bold relative z-10"
        style={{ fontSize: size * 0.28, fontFamily: 'Rajdhani', color }}
      >
        {value}
      </span>
    </div>
  );
}
