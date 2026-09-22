// --- SKELETON LOADING ---
function Skeleton({ className = '', rounded = 'rounded-2xl' }) {
  return (
    <div
      className={`animate-pulse bg-gray-200/70 dark:bg-neutral-800/70 ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-12 w-[260px]" />
        <Skeleton className="h-12 w-[360px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" rounded="rounded-[2.5rem]" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" rounded="rounded-[2.5rem]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="lg:col-span-2 h-96" rounded="rounded-[2.5rem]" />
        <Skeleton className="h-96" rounded="rounded-[2.5rem]" />
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <Skeleton className="h-6 w-48 mb-2" rounded="rounded-lg" />
            <Skeleton className="h-3 w-40" rounded="rounded-md" />
          </div>
          <Skeleton className="h-12 w-[280px]" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 w-[320px]" />
          <Skeleton className="h-12 w-[280px]" />
        </div>
      </div>
      <div className="flex gap-5 min-w-max h-full pb-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[320px] rounded-[2rem] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-5 flex flex-col gap-3">
            <Skeleton className="h-6 w-28 mb-2" rounded="rounded-full" />
            {Array.from({ length: 2 + (i % 3) }).map((_, j) => (
              <Skeleton key={j} className="h-28" rounded="rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadsSkeleton() {
  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-5 rounded-[2rem] shadow-xl">
        <Skeleton className="h-12 w-[280px]" />
        <Skeleton className="h-12 flex-1" />
        <Skeleton className="h-12 w-12" />
        <Skeleton className="h-12 w-28" />
        <Skeleton className="h-12 w-32" />
      </div>
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden flex-1 shadow-2xl p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16" rounded="rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function DailyGoalSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-32" rounded="rounded-[2.5rem]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-[500px]" rounded="rounded-[2.5rem]" />
        <Skeleton className="h-[500px]" rounded="rounded-[2.5rem]" />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="h-full flex flex-col md:flex-row gap-6 animate-fade-in max-w-7xl mx-auto w-full">
      <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
        <Skeleton className="h-8 w-40 mb-4" rounded="rounded-lg" />
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-2 rounded-2xl shadow-xl space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11" rounded="rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <Skeleton className="h-[600px]" rounded="rounded-[2rem]" />
      </div>
    </div>
  );
}

// Esqueleto da ficha, no desenho da LeadProfileView (Voltar, cartão do
// cabeçalho com avatar e as quatro células, abas e a linha do tempo), para a
// troca não pular. Aparece enquanto o doc do lead ou os catálogos da academia
// ainda não chegaram.
function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" className="animate-fade-in max-w-[1160px] mx-auto w-full">
      <span className="sr-only">Carregando ficha…</span>
      <Skeleton className="h-8 w-20 mb-3" rounded="rounded-lg" />
      <div className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6 mb-5">
        <div className="flex items-start gap-4 sm:gap-5">
          <Skeleton className="size-16 shrink-0" rounded="rounded-full" />
          <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
            <Skeleton className="h-3 w-24" rounded="rounded-md" />
            <Skeleton className="h-7 w-64 max-w-full" rounded="rounded-lg" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-2.5 w-16" rounded="rounded" />
              <Skeleton className="h-4 w-28 max-w-full" rounded="rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 h-11 border-b border-border mb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" rounded="rounded-md" />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card shadow-card p-5 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10" rounded="rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function ViewSkeleton({ activeTab }) {
  switch (activeTab) {
    case 'kanban': return <KanbanSkeleton />;
    case 'dailyGoal': return <DailyGoalSkeleton />;
    case 'leads': return <LeadsSkeleton />;
    case 'aulas':
    case 'visitas': return <LeadsSkeleton />;
    case 'settings': return <SettingsSkeleton />;
    case 'dashboard':
    default:
      return <DashboardSkeleton />;
  }
}
export { Skeleton, DashboardSkeleton, KanbanSkeleton, LeadsSkeleton, DailyGoalSkeleton, SettingsSkeleton, ProfileSkeleton, ViewSkeleton };
