import { useNavigate } from 'react-router-dom';
import { Lock, Zap } from 'lucide-react';
import { usePlanStore } from '@/lib/store';
import { PlanFeatures, PLAN_CONFIGS } from '@/types';
import clsx from 'clsx';

interface PlanGateProps {
  feature: keyof PlanFeatures;
  children: React.ReactNode;
  /** Show an inline locked overlay instead of replacing children */
  overlay?: boolean;
  /** Small compact badge mode */
  compact?: boolean;
  upgradeLabel?: string;
}

export function PlanGate({ feature, children, overlay = false, compact = false, upgradeLabel }: PlanGateProps) {
  const can = usePlanStore(s => s.can);
  const navigate = useNavigate();

  if (can(feature)) return <>{children}</>;

  // Find minimum plan that includes this feature
  const minPlan = (['starter', 'growth', 'pro', 'enterprise'] as const).find(
    p => PLAN_CONFIGS[p].features[feature]
  );
  const planLabel = minPlan ? PLAN_CONFIGS[minPlan].label : 'Pro';
  const label = upgradeLabel ?? `${planLabel} feature`;

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer select-none"
        style={{ background: 'rgba(255,209,102,0.12)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.25)' }}
        onClick={() => navigate('/settings/plan')}
        title={`Upgrade to ${planLabel} to unlock`}
      >
        <Lock size={9} /> {planLabel}
      </span>
    );
  }

  if (overlay) {
    return (
      <div className="relative">
        <div className="opacity-30 pointer-events-none select-none">{children}</div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[12px] cursor-pointer"
          style={{ background: 'rgba(13,14,20,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={() => navigate('/settings/plan')}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,209,102,0.15)', border: '1px solid rgba(255,209,102,0.3)' }}>
            <Lock size={14} style={{ color: '#FFD166' }} />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: '#FFD166' }}>{label}</span>
          <span className="text-[10px]" style={{ color: 'var(--text3)' }}>Upgrade to unlock</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx('rounded-[12px] border flex flex-col items-center gap-3 text-center cursor-pointer transition-all hover:brightness-110', compact ? 'p-4' : 'p-8')}
      style={{ background: 'var(--bg2)', borderColor: 'rgba(255,209,102,0.2)', borderStyle: 'dashed' }}
      onClick={() => navigate('/settings/plan')}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.25)' }}>
        <Lock size={16} style={{ color: '#FFD166' }} />
      </div>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text3)' }}>Available on {planLabel} and above</p>
      </div>
      <button
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all hover:scale-105"
        style={{ background: 'rgba(255,209,102,0.15)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.3)' }}
      >
        <Zap size={11} /> Upgrade Plan
      </button>
    </div>
  );
}
