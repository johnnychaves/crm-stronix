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
export { Skeleton, DashboardSkeleton, KanbanSkeleton, LeadsSkeleton, DailyGoalSkeleton, SettingsSkeleton, ViewSkeleton };
