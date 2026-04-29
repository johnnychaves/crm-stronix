const fs = require('fs');

let content = fs.readFileSync('src/App.jsx', 'utf8');

const targetStart = '           ) : (\n             <div className="animate-fade-in mt-12 md:mt-0">';
const targetEnd = '             </div>\n           )}\n        </div>\n\n        {/* RIGHT COLUMN: Alternating Timeline */}';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries");
  process.exit(1);
}

const newLeftColumn = `           ) : (
             <div className="animate-fade-in mt-12 md:mt-0">
               {/* Header Info */}
               <div className="mb-8">
                 <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{lead.name}</h2>
                 <div className="flex flex-wrap gap-2 mb-4"> {(lead.tags || []).map(tName => <TagBadge key={tName} tagName={tName} tagsArray={tags} />)} </div>
                 <div className="text-sm font-semibold text-gray-500 dark:text-neutral-400 flex items-center gap-2 mt-2">
                   <Phone className="w-4 h-4" /> {lead.whatsapp}
                 </div>
               </div>

               {/* Clean Action Buttons */}
               <div className="flex gap-3 mb-8 border-b border-gray-200 dark:border-neutral-800 pb-8">
                 <button onClick={handleWin} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-500 dark:hover:border-green-500 text-gray-700 dark:text-neutral-300 hover:text-green-600 dark:hover:text-green-400 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"><Trophy className="w-4 h-4"/> Ganho</button>
                 <button onClick={()=>setLossModalOpen(true)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-500 dark:hover:border-red-500 text-gray-700 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"><ThumbsDown className="w-4 h-4"/> Perda</button>
                 <button onClick={handleWhatsApp} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-500 dark:hover:border-blue-500 text-gray-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"><MessageCircle className="w-4 h-4"/> WhatsApp</button>
               </div>

               {/* Lead Lost Banner */}
               {lead.status === 'Perda' && lead.lossReason && (
                 <div className="mb-8 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 flex items-start gap-3">
                   <ThumbsDown className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                   <div><p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Motivo da Perda</p><p className="text-sm font-semibold text-red-800 dark:text-red-300">{lead.lossReason}</p></div>
                 </div>
               )}

               {/* Contexto Minimalista */}
               <div className="mb-8">
                 <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Contexto Inicial</h4>
                 <p className="text-sm text-gray-800 dark:text-neutral-200 leading-relaxed font-medium">
                   {lead.observation || "Nenhuma observação registrada no momento do cadastro."}
                 </p>
               </div>

               {/* Registrar Atividade Minimalista */}
               <div className="mb-8 border-t border-gray-200 dark:border-neutral-800 pt-8">
                 <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Clock className="w-4 h-4"/> Registrar Atividade</h4>
                 
                 <div className="space-y-4">
                   <div>
                     <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5 block">Fase do Funil</label>
                     <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 transition-all appearance-none font-semibold shadow-sm">
                       {(statuses || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                     </select>
                   </div>
                   
                   <div>
                     <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1.5 block">Anotações da Conversa</label>
                     <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white h-24 outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 font-medium resize-none transition-all shadow-sm" placeholder="O que foi discutido?" />
                   </div>

                   <div className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/30">
                     <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-neutral-200 cursor-pointer">
                       <input type="checkbox" checked={enableFollowUp} onChange={e => setEnableFollowUp(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-neutral-700 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
                       Agendar Próximo Contato
                     </label>
                     {enableFollowUp && (
                       <div className="mt-4 space-y-4 animate-fade-in border-t border-gray-200 dark:border-neutral-800 pt-4">
                         <div className="grid grid-cols-2 gap-2">
                           {['Mensagem', 'Ligação', 'Visita', 'Aula Experimental'].map(t => (
                             <button key={t} type="button" onClick={() => setFollowUpType(t)} className={\`py-2 px-3 rounded-lg text-xs font-semibold transition-all border \${followUpType === t ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'}\`}>{t}</button>
                           ))}
                         </div>
                         <div>
                           <label className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 mb-1.5 block uppercase tracking-widest">Data e Hora</label>
                           <div className="flex items-center gap-3">
                             <Calendar className="w-5 h-5 text-gray-400 dark:text-neutral-500 shrink-0" />
                             <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="w-full bg-transparent p-3 text-sm rounded-xl text-gray-900 dark:text-white outline-none border border-gray-300 dark:border-neutral-700 focus:border-blue-500 transition-all font-semibold" />
                           </div>
                         </div>
                       </div>
                     )}
                   </div>
                   
                   <button onClick={saveInteraction} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-widest uppercase py-4 rounded-xl shadow-md text-xs transition-all active:scale-95">Salvar Atividade</button>
                 </div>
               </div>

               {/* CSAT Minimalista */}
               <div className="border-t border-gray-200 dark:border-neutral-800 pt-8 pb-4">
                 <div className="flex items-center justify-between mb-5">
                   <h4 className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Pesquisa CSAT</h4>
                   <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                     {lead.csatStatus === 'answered' ? 'Respondido' : lead.csatStatus === 'pending' ? 'Aguardando' : 'Não enviado'}
                   </span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 mb-4">
                   <button type="button" onClick={() => setCsatStage('pos_agendamento')} className={\`py-3 px-3 rounded-xl text-xs font-semibold transition-all border \${csatStage === 'pos_agendamento' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'}\`}>Pós-Agendamento</button>
                   <button type="button" onClick={() => setCsatStage('cliente_novo')} className={\`py-3 px-3 rounded-xl text-xs font-semibold transition-all border \${csatStage === 'cliente_novo' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300 shadow-sm' : 'bg-transparent border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'}\`}>Pós-Matrícula</button>
                 </div>
                 
                 <button type="button" onClick={handleSendCsat} disabled={sendingCsat} className="w-full bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-200 font-bold py-3 rounded-xl shadow-sm text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-95">
                   {sendingCsat ? 'Gerando...' : <><MessageCircle className="w-4 h-4"/> Enviar Link por WhatsApp</>}
                 </button>
               </div>

`;

content = content.slice(0, startIndex) + newLeftColumn + content.slice(endIndex);
fs.writeFileSync('src/App.jsx', content);
console.log('Successfully updated left column');
