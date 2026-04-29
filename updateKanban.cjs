const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add searchTerm state
content = content.replace(
  "const [lossModalLeadId, setLossModalLeadId] = useState(null);",
  "const [lossModalLeadId, setLossModalLeadId] = useState(null);\n  const [searchTerm, setSearchTerm] = useState('');"
);

// 2. Update kanbanLeads useMemo
content = content.replace(
  "const kanbanLeads = useMemo(() => {\n    return consultantFilter\n      ? (leads || []).filter(l => l.consultantId === consultantFilter)\n      : (leads || []);\n  }, [leads, consultantFilter]);",
  `const kanbanLeads = useMemo(() => {
    let filtered = leads || [];
    if (consultantFilter) {
      filtered = filtered.filter(l => l.consultantId === consultantFilter);
    }
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(l => 
        (l.name && l.name.toLowerCase().includes(lowerSearch)) || 
        (l.whatsapp && l.whatsapp.includes(searchTerm)) ||
        (l.observation && l.observation.toLowerCase().includes(lowerSearch))
      );
    }
    return filtered;
  }, [leads, consultantFilter, searchTerm]);`
);

// 3. Add search input UI
const searchUIReplacement = `          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quadro Kanban
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">
              Arraste os leads entre as etapas
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-center">
            <div className="relative w-full md:w-[320px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar leads por nome, telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
            {isAdminUser(appUser) && (
              <div className="w-full md:w-[280px]">
                <select
                  value={consultantFilter}
                  onChange={(e) => setConsultantFilter(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white outline-none shadow-sm cursor-pointer"
                >
                  <option value="">Todos os consultores</option>
                  {(usersList || []).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>`;

content = content.replace(
  /<div>\s*<h3 className="text-lg font-semibold text-gray-900 dark:text-white">\s*Quadro Kanban\s*<\/h3>[\s\S]*?<\/div>\s*\{isAdminUser\(appUser\) && \([\s\S]*?<\/div>\s*\)\}/,
  searchUIReplacement
);

// 4. Update getLeadsByStatus
const newGetLeads = `const getLeadsByStatus = (statusName) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTomorrow = startOfToday + 86400000;

    const getPriority = (lead) => {
      if (!lead.nextFollowUp || !(lead.nextFollowUp instanceof Date) || isNaN(lead.nextFollowUp.getTime())) {
        return 4; // Lowest priority
      }
      const time = lead.nextFollowUp.getTime();
      if (time < now.getTime()) return 1; // Overdue
      if (time >= startOfToday && time < startOfTomorrow) return 2; // Today
      return 3; // Future
    };

    return (kanbanLeads || [])
      .filter(l => l.status === statusName)
      .sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        if (pA !== 4 && a.nextFollowUp && b.nextFollowUp) {
          return a.nextFollowUp.getTime() - b.nextFollowUp.getTime();
        }
        return (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0);
      });
  };`;

content = content.replace(
  /const getLeadsByStatus = \(statusName\) => \{[\s\S]*?\}\);[\s\S]*?\};/,
  newGetLeads
);

fs.writeFileSync('src/App.jsx', content);
console.log('Successfully updated KanbanView');
