const KEY='aw139_companion_shared_context_v1';
const box=document.getElementById('ctxBox');
const clearBtn=document.getElementById('clearContextBtn');
function render(){
  try{const raw=localStorage.getItem(KEY); box.textContent=raw?JSON.stringify(JSON.parse(raw),null,2):'Sem contexto salvo ainda.';}catch(e){box.textContent='Erro lendo contexto.'}
}
clearBtn?.addEventListener('click',()=>{localStorage.removeItem(KEY);render();});
render();