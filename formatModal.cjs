const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

// Isolate LeadDetailsModal to replace specific typography
const startIndex = content.indexOf('function LeadDetailsModal(');
const endIndex = content.indexOf('function SettingsView(', startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not isolate LeadDetailsModal');
  process.exit(1);
}

let before = content.slice(0, startIndex);
let modalContent = content.slice(startIndex, endIndex);
let after = content.slice(endIndex);

// 1. Labels and Small headers: remove uppercase, tracking-widest/tight, change font-black to font-medium/semibold
// e.g. text-[10px] font-black text-gray-600 uppercase mb-2 block tracking-widest
modalContent = modalContent.replace(/text-\[10px\] font-black text-gray-600 uppercase mb-2 block tracking-widest/g, 'text-xs font-semibold text-gray-600 mb-1 block');
modalContent = modalContent.replace(/text-\[10px\] font-black uppercase tracking-\[0.2em\] text-neutral-600 mb-3 block/g, 'text-xs font-semibold text-gray-600 mb-1 block');
modalContent = modalContent.replace(/text-xs font-bold text-gray-500 uppercase mb-2 block tracking-\[0.16em\]/g, 'text-sm font-semibold text-gray-700 mb-2 block');

// 2. Headings:
// "Editar Cadastro"
modalContent = modalContent.replace(/text-2xl font-black text-gray-900 uppercase tracking-tighter/g, 'text-xl font-bold text-gray-900 mb-4');
// Lead Name
modalContent = modalContent.replace(/text-4xl font-black text-gray-900 mb-2 leading-none tracking-tighter/g, 'text-3xl font-bold text-gray-900 mb-2');

// 3. Small context text
// Contexto do cadastro
modalContent = modalContent.replace(/text-\[11px\] font-black text-blue-500 uppercase tracking-\[0.18em\]/g, 'text-sm font-semibold text-blue-600');
modalContent = modalContent.replace(/text-\[15px\] text-gray-800 font-medium leading-7/g, 'text-sm text-gray-700 leading-6 mt-2');

// 4. Send CSAT Title
modalContent = modalContent.replace(/text-\[10px\] font-black uppercase tracking-\[0.3em\] text-blue-400 border-b border-gray-200 pb-4/g, 'text-sm font-semibold text-blue-600 border-b border-gray-200 pb-3');
// CSAT Status
modalContent = modalContent.replace(/text-\[10px\] text-gray-400 font-black uppercase tracking-widest/g, 'text-xs font-semibold text-gray-500');

// 5. Action Buttons (Matricular, Perda, WhatsApp)
// Matricular: "bg-green-500 hover:bg-green-600 text-white p-3.5 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-green-500/20 active:scale-95"
modalContent = modalContent.replace(/text-\[9px\] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-green-500\/20 active:scale-95/g, 'text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95');
// Perda
modalContent = modalContent.replace(/text-\[9px\] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-red-500\/20 active:scale-95/g, 'text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95');
// WhatsApp
modalContent = modalContent.replace(/text-\[10px\] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 shadow-xl shadow-blue-500\/20 active:scale-95/g, 'text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95');

// Registrar Atividade section
modalContent = modalContent.replace(/text-\[11px\] font-black uppercase tracking-\[0.22em\] text-blue-500 border-b border-gray-200 pb-3/g, 'text-base font-bold text-gray-900 border-b border-gray-200 pb-3');

// Histórico de ações (Timeline)
modalContent = modalContent.replace(/text-xl md:text-2xl font-black text-gray-900 flex items-center gap-3 uppercase tracking-tight/g, 'text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-3');

// Generic replacements for tracking and font-black in timeline
modalContent = modalContent.replace(/text-\[11px\] font-black text-gray-900 uppercase tracking-\[0.16em\]/g, 'text-sm font-semibold text-gray-900');
modalContent = modalContent.replace(/text-\[10px\] font-black uppercase tracking-\[0.14em\]/g, 'text-xs font-medium text-gray-500');
modalContent = modalContent.replace(/text-\[9px\] font-black uppercase tracking-widest/g, 'text-xs font-medium');
modalContent = modalContent.replace(/text-\[15px\] leading-7 font-semibold/g, 'text-sm text-gray-700 leading-6 mt-1');

// Follow up toggle
modalContent = modalContent.replace(/text-xs font-black text-gray-700 cursor-pointer uppercase tracking-\[0.16em\]/g, 'text-sm font-medium text-gray-700 cursor-pointer');
modalContent = modalContent.replace(/text-\[11px\] font-black text-gray-400 uppercase tracking-\[0.16em\] mb-3/g, 'text-xs font-medium text-gray-500 mb-2');

// Fix buttons text (e.g. REGISTRAR ATIVIDADE -> Registrar Atividade)
// For text-transform, tailwind doesn't uppercase natively unless we have `uppercase` class. So we remove uppercase.
modalContent = modalContent.replace(/uppercase tracking-\[0.18em\] text-\[11px\]/g, 'text-sm');
modalContent = modalContent.replace(/uppercase tracking-\[0.2em\] text-\[10px\]/g, 'text-sm');
// Buttons texts replace
modalContent = modalContent.replace(/>REGISTRAR ATIVIDADE</g, '>Registrar Atividade<');
modalContent = modalContent.replace(/>ENVIAR CSAT POR WHATSAPP</g, '>Enviar CSAT por WhatsApp<');
modalContent = modalContent.replace(/>GERANDO LINK...</g, '>Gerando Link...<');
modalContent = modalContent.replace(/>EXECUTAR MUDANÇA</g, '>Executar Mudança<');

// Border and padding fixes
// The modal outer div has a very gamer style rounded-[2.5rem] (40px). Standard CRM modals use rounded-xl or rounded-2xl (16px).
modalContent = modalContent.replace(/rounded-\[2\.5rem\]/g, 'rounded-2xl');
modalContent = modalContent.replace(/rounded-\[1\.5rem\]/g, 'rounded-xl');
modalContent = modalContent.replace(/rounded-\[2rem\]/g, 'rounded-xl');
modalContent = modalContent.replace(/rounded-\[1\.25rem\]/g, 'rounded-xl');
// The inputs and textareas have huge paddings "p-4" or "p-5". Make it p-3
modalContent = modalContent.replace(/className="w-full bg-\[#eaedf2\] p-4/g, 'className="w-full bg-gray-50 p-3 text-sm');
modalContent = modalContent.replace(/className="w-full bg-white p-4/g, 'className="w-full bg-white p-3 text-sm');

// Remove some specific borders and shadows
modalContent = modalContent.replace(/shadow-inner/g, 'shadow-sm');

fs.writeFileSync('src/App.jsx', before + modalContent + after);
console.log('Formatted LeadDetailsModal typography');
