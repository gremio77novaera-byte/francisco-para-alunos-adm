const SUPABASE_URL="https://ngsusjppshcxhdukwmga.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_GnXxWCZhoX5HZtkjd06E_g_2bzuzVgp";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

let grades=[],classes=[],notices=[],playlists=[],games=[],roles=[],permissions=[],profile=null,allProfiles=[];
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function errorText(e){return e?.message||e?.details||e?.hint||String(e||"Erro desconhecido.");}
function notify(t){const e=$("#message");e.textContent=t;e.classList.remove("hidden");setTimeout(()=>e.classList.add("hidden"),3500)}
function hasPermission(key){return profile?.role==="management"||profile?.permissions?.includes("manage_all")||profile?.permissions?.includes(key)}

async function loadProfile(){
  const {data:{user},error}=await sb.auth.getUser();
  if(error)throw error;
  if(!user)throw new Error("Sessão não encontrada.");
  const {data:p,error:pe}=await sb.from("profiles").select("id,full_name,role,role_id,enabled").eq("id",user.id).maybeSingle();
  if(pe)throw pe;
  if(!p)throw new Error("Seu usuário entrou no Supabase, mas ainda não existe em public.profiles. Verifique o cadastro do administrador.");
  if(!p.enabled)throw new Error("Este usuário está bloqueado.");
  if(p.role==="management"){p.permissions=["manage_all"];return p;}
  if(!p.role_id)throw new Error("O usuário ainda não possui um cargo vinculado.");
  const {data:rps,error:re}=await sb.from("role_permissions").select("permission_id").eq("role_id",p.role_id);
  if(re)throw re;
  const ids=(rps||[]).map(x=>x.permission_id).filter(Boolean);
  if(ids.length){
    const {data:ps,error:ppe}=await sb.from("permissions").select("permission_key").in("id",ids);
    if(ppe)throw ppe;
    p.permissions=(ps||[]).map(x=>x.permission_key);
  }else p.permissions=[];
  return p;
}

function applyPermissions(){
  document.querySelectorAll("[data-permission]").forEach(el=>el.classList.toggle("hidden",!hasPermission(el.dataset.permission)));
  const first=[...document.querySelectorAll(".tab")].find(x=>!x.classList.contains("hidden"));
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));
  if(first){first.classList.add("active");$("#tab-"+first.dataset.tab).classList.add("active");}
}

async function loadData(){
 const reqs=await Promise.all([
  sb.from("grades").select("*").eq("enabled",true).order("sort_order"),
  sb.from("school_classes").select("*").eq("enabled",true).order("name"),
  sb.from("notices").select("*").order("created_at",{ascending:false}),
  sb.from("playlists").select("*").eq("enabled",true),
  sb.from("weekly_games").select("*").eq("enabled",true),
  sb.from("roles").select("*").order("name"),
  sb.from("permissions").select("*").order("name"),
  sb.from("profiles").select("id,full_name,role,role_id,enabled,grade_id,class_id").order("full_name")
 ]);
 const bad=reqs.find(x=>x.error);if(bad)throw bad.error;
 grades=reqs[0].data||[];classes=reqs[1].data||[];notices=reqs[2].data||[];playlists=reqs[3].data||[];games=reqs[4].data||[];roles=reqs[5].data||[];permissions=reqs[6].data||[];allProfiles=reqs[7].data||[];
 renderAll();
}

async function startApp(){
 try{
  profile=await loadProfile();
  $("#loginView").classList.remove("active");$("#appView").classList.add("active");
  $("#adminName").textContent=profile.full_name||"Administrador";$("#adminFullName").value=profile.full_name||"";
  await loadData();applyPermissions();
 }catch(e){
  $("#loginView").classList.add("active");$("#appView").classList.remove("active");
  $("#loginError").textContent=errorText(e);
 }
}

$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("#loginError").textContent="";$("#loginButton").disabled=true;$("#loginButton").textContent="Entrando...";
 try{
  const {error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
  if(error)throw error;
  await startApp();
 }catch(err){$("#loginError").textContent=errorText(err)}
 finally{$("#loginButton").disabled=false;$("#loginButton").textContent="Entrar";}
});
$("#logoutBtn").onclick=async()=>{await sb.auth.signOut();location.reload()};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#tab-"+b.dataset.tab).classList.add("active")});

function openModal(html,onSave){$("#modalBody").innerHTML=html;$("#modal").classList.remove("hidden");$("#modalBody form").onsubmit=async e=>{e.preventDefault();try{await onSave(new FormData(e.target));$("#modal").classList.add("hidden")}catch(err){alert(errorText(err))}}}
$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");

$("#addGradeBtn").onclick=()=>openModal(`<h3>Adicionar ano/série</h3><form class="form-grid"><label>Nome<input name="name" placeholder="Ex.: 1ª série" required></label><label>Ordem<input name="sort_order" type="number" value="${grades.length+1}" min="0"></label><button class="primary">Adicionar</button></form>`,async fd=>{const {error}=await sb.from("grades").insert({name:fd.get("name").trim(),sort_order:Number(fd.get("sort_order")||0),enabled:true});if(error)throw error;await loadData();notify("Ano/série criado.")});
window.addClass=gid=>{const g=grades.find(x=>x.id===gid);openModal(`<h3>Adicionar turma em ${esc(g.name)}</h3><form class="form-grid"><label>Nome<input name="name" placeholder="Ex.: 6º A" required></label><label class="check"><input name="login_enabled" type="checkbox"> Mostrar/usar login específico no portal</label><label>Identificador<input name="username" placeholder="Ex.: 6a"></label><button class="primary">Adicionar</button></form>`,async fd=>{const {error}=await sb.from("school_classes").insert({grade_id:gid,name:fd.get("name").trim(),enabled:true,login_enabled:fd.get("login_enabled")==="on",login_username:fd.get("username").trim()||null});if(error)throw error;await loadData();notify("Turma criada.")})};
window.editGrade=id=>{const g=grades.find(x=>x.id===id);openModal(`<h3>Editar ano/série</h3><form class="form-grid"><label>Nome<input name="name" value="${esc(g.name)}" required></label><label>Ordem<input name="sort_order" type="number" value="${g.sort_order}"></label><button class="primary">Salvar</button></form>`,async fd=>{const {error}=await sb.from("grades").update({name:fd.get("name").trim(),sort_order:Number(fd.get("sort_order")||0)}).eq("id",id);if(error)throw error;await loadData();notify("Ano/série atualizado.")})};
window.deleteGrade=async id=>{if(!confirm("Excluir este ano/série e suas turmas?"))return;const {error}=await sb.from("grades").delete().eq("id",id);if(error)return alert(errorText(error));await loadData();notify("Ano/série excluído.")};
window.editClass=id=>{const c=classes.find(x=>x.id===id);openModal(`<h3>Editar turma</h3><form class="form-grid"><label>Nome<input name="name" value="${esc(c.name)}" required></label><label class="check"><input name="login_enabled" type="checkbox" ${c.login_enabled?"checked":""}> Mostrar/usar login específico no portal</label><label>Identificador<input name="username" value="${esc(c.login_username||"")}"></label><button class="primary">Salvar</button></form>`,async fd=>{const {error}=await sb.from("school_classes").update({name:fd.get("name").trim(),login_enabled:fd.get("login_enabled")==="on",login_username:fd.get("username").trim()||null}).eq("id",id);if(error)throw error;await loadData();notify("Turma atualizada.")})};
window.deleteClass=async id=>{if(!confirm("Excluir esta turma?"))return;const {error}=await sb.from("school_classes").delete().eq("id",id);if(error)return alert(errorText(error));await loadData();notify("Turma excluída.")};
function renderGrades(){$("#gradesList").innerHTML=grades.map(g=>{const cs=classes.filter(c=>c.grade_id===g.id);return `<article class="grade"><div class="grade-head"><div><h3>${esc(g.name)}</h3><span class="meta">${cs.length} turma(s)</span></div><div class="actions"><button class="mini" onclick="addClass('${g.id}')">+ Turma</button><button class="mini" onclick="editGrade('${g.id}')">Editar</button><button class="mini danger" onclick="deleteGrade('${g.id}')">Excluir</button></div></div><div class="subclasses">${cs.length?cs.map(c=>`<div class="subclass"><span><strong>${esc(c.name)}</strong> ${c.login_enabled?"🔐 login ligado":"— sem login específico"}</span><span class="actions"><button class="mini" onclick="editClass('${c.id}')">Editar</button><button class="mini danger" onclick="deleteClass('${c.id}')">Excluir</button></span></div>`).join(""):`<span class="muted">Nenhuma turma específica cadastrada.</span>`}</div></article>`}).join("")||`<p class="muted">Nenhum ano/série cadastrado.</p>`}

function targetOptions(){let o=`<option value="SCHOOL">Toda a escola</option>`;grades.forEach(g=>{o+=`<option value="G:${g.id}">${esc(g.name)} (todas as turmas)</option>`;classes.filter(c=>c.grade_id===g.id).forEach(c=>o+=`<option value="C:${c.id}">${esc(c.name)}</option>`)});return o}
function targetLabel(n){if(n.target_type==="SCHOOL")return"Toda a escola";if(n.target_type==="GRADE")return grades.find(g=>g.id===n.target_id)?.name||"Ano/série";return classes.find(c=>c.id===n.target_id)?.name||"Turma"}
function renderNotices(){$("#noticeTarget").innerHTML=targetOptions();$("#noticesList").innerHTML=notices.length?notices.map(n=>`<article class="item"><span class="meta">${esc(targetLabel(n))}</span><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>${n.image_url?`<a href="${esc(n.image_url)}" target="_blank" rel="noopener">Abrir imagem</a>`:""}<div class="actions"><button class="mini danger" onclick="deleteNotice('${n.id}')">Excluir</button></div></article>`).join(""):`<p class="muted">Nenhum aviso.</p>`}
$("#noticeForm").addEventListener("submit",async e=>{e.preventDefault();const [kind,id]=$("#noticeTarget").value.split(":");const payload={title:$("#noticeTitle").value.trim(),body:$("#noticeText").value.trim(),image_url:$("#noticeImage").value.trim()||null,published:true,target_type:kind==="SCHOOL"?"SCHOOL":kind==="G"?"GRADE":"CLASS",target_id:kind==="SCHOOL"?null:id};const {error}=await sb.from("notices").insert(payload);if(error)return alert(errorText(error));e.target.reset();await loadData();notify("Aviso publicado.")});
window.deleteNotice=async id=>{if(!confirm("Excluir este aviso?"))return;const {error}=await sb.from("notices").delete().eq("id",id);if(error)return alert(errorText(error));await loadData();notify("Aviso excluído.")};

function renderPlaylist(){$("#playlistList").innerHTML=grades.map(g=>{const p=playlists.find(x=>x.grade_id===g.id)||{};return `<article class="item"><h3>${esc(g.name)}</h3><form class="form-grid" onsubmit="savePlaylist(event,'${g.id}')"><label>Aplicativo/serviço<input name="app" value="${esc(p.app_name||"")}" placeholder="Spotify, YouTube, etc."></label><label>Link da playlist<input name="link" value="${esc(p.playlist_url||"")}" placeholder="https://..."></label><button class="primary">Salvar playlist</button></form></article>`}).join("")}
window.savePlaylist=async(e,id)=>{e.preventDefault();const fd=new FormData(e.target),existing=playlists.find(x=>x.grade_id===id),payload={grade_id:id,app_name:fd.get("app").trim(),playlist_url:fd.get("link").trim(),enabled:true,updated_at:new Date().toISOString()};const r=existing?await sb.from("playlists").update(payload).eq("id",existing.id):await sb.from("playlists").insert(payload);if(r.error)return alert(errorText(r.error));await loadData();notify("Playlist salva.")};
function renderGames(){$("#gamesList").innerHTML=grades.map(g=>{const w=games.find(x=>x.grade_id===g.id);return `<article class="item"><h3>${esc(g.name)}</h3><form class="form-grid" onsubmit="saveGames(event,'${g.id}')"><label class="full">Jogos da semana<textarea name="games" rows="6">${esc(w?.content||"")}</textarea></label><button class="primary">Salvar jogos</button></form></article>`}).join("")}
window.saveGames=async(e,id)=>{e.preventDefault();const fd=new FormData(e.target),existing=games.find(x=>x.grade_id===id),payload={grade_id:id,content:fd.get("games"),enabled:true,updated_at:new Date().toISOString()};const r=existing?await sb.from("weekly_games").update(payload).eq("id",existing.id):await sb.from("weekly_games").insert(payload);if(r.error)return alert(errorText(r.error));await loadData();notify("Jogos salvos.")};
function renderUsers(){const ps=allProfiles;$("#userCount").textContent=ps.length;$("#studentCount").textContent=ps.filter(p=>p.role==="student").length;$("#usersList").innerHTML=ps.map(p=>`<article class="item"><span class="meta">${esc(p.role||"sem cargo")}</span><h3>${esc(p.full_name||"Sem nome")}</h3><p class="muted">${p.enabled?"Ativo":"Bloqueado"}</p></article>`).join("")||`<p class="muted">Nenhum perfil encontrado.</p>`}

function rolePermissionHtml(selected=[]){return permissions.map(p=>`<label class="permission-option"><input type="checkbox" name="perm" value="${esc(p.id)}" ${selected.includes(p.id)?"checked":""}><span><strong>${esc(p.name)}</strong><br><small>${esc(p.description||"")}</small></span></label>`).join("")}
$("#addRoleBtn").onclick=()=>openModal(`<h3>Criar cargo</h3><form class="form-grid"><label>Nome do cargo<input name="name" placeholder="Ex.: Agente Escolar" required></label><label>Descrição<textarea name="description" rows="2"></textarea></label><div><strong>Permissões</strong><div class="permission-grid">${rolePermissionHtml()}</div></div><button class="primary">Criar cargo</button></form>`,async fd=>{
 const {data:r,error}=await sb.from("roles").insert({name:fd.get("name").trim(),description:fd.get("description").trim(),is_system:false,enabled:true}).select().single();if(error)throw error;
 const ids=fd.getAll("perm");if(ids.length){const {error:pe}=await sb.from("role_permissions").insert(ids.map(permission_id=>({role_id:r.id,permission_id})));if(pe)throw pe}
 await loadData();notify("Cargo criado.");
});
window.editRole=async id=>{
 const r=roles.find(x=>x.id===id);const {data:rps,error}=await sb.from("role_permissions").select("permission_id").eq("role_id",id);if(error)return alert(errorText(error));const selected=(rps||[]).map(x=>x.permission_id);
 openModal(`<h3>Editar cargo</h3><form class="form-grid"><label>Nome<input name="name" value="${esc(r.name)}" required></label><label>Descrição<textarea name="description" rows="2">${esc(r.description||"")}</textarea></label><label class="check"><input name="enabled" type="checkbox" ${r.enabled?"checked":""}> Cargo ativo</label><div><strong>Permissões</strong><div class="permission-grid">${rolePermissionHtml(selected)}</div></div><button class="primary">Salvar</button></form>`,async fd=>{
  const {error}=await sb.from("roles").update({name:fd.get("name").trim(),description:fd.get("description").trim(),enabled:fd.get("enabled")==="on"}).eq("id",id);if(error)throw error;
  const {error:de}=await sb.from("role_permissions").delete().eq("role_id",id);if(de)throw de;
  const ids=fd.getAll("perm");if(ids.length){const {error:ie}=await sb.from("role_permissions").insert(ids.map(permission_id=>({role_id:id,permission_id})));if(ie)throw ie}
  await loadData();notify("Cargo atualizado.");
 });
};
window.deleteRole=async id=>{const r=roles.find(x=>x.id===id);if(r.is_system)return alert("Este cargo do sistema é protegido.");if(!confirm("Excluir este cargo?"))return;const {error}=await sb.from("roles").delete().eq("id",id);if(error)return alert(errorText(error));await loadData();notify("Cargo excluído.")};
function renderRoles(){$("#rolesList").innerHTML=roles.map(r=>`<article class="role"><div class="role-head"><div><h3>${esc(r.name)}</h3><span class="meta">${r.is_system?"Cargo do sistema":"Cargo criado pela escola"} • ${r.enabled?"ativo":"desativado"}</span></div><div class="actions"><button class="mini" onclick="editRole('${r.id}')">Editar</button>${!r.is_system?`<button class="mini danger" onclick="deleteRole('${r.id}')">Excluir</button>`:""}</div></div><p class="muted">${esc(r.description||"Sem descrição")}</p></article>`).join("")}
$("#adminForm").addEventListener("submit",async e=>{e.preventDefault();const name=$("#adminFullName").value.trim(),pass=$("#adminPassword").value;const {data:{user}}=await sb.auth.getUser();const {error}=await sb.from("profiles").update({full_name:name}).eq("id",user.id);if(error)return alert(errorText(error));if(pass){const {error:pe}=await sb.auth.updateUser({password:pass});if(pe)return alert(errorText(pe))}profile.full_name=name;$("#adminName").textContent=name;$("#adminPassword").value="";notify("Configurações salvas.")});
function renderAll(){renderGrades();renderNotices();renderPlaylist();renderGames();renderUsers();renderRoles();renderConfig()}
function renderConfig(){$("#adminFullName").value=profile?.full_name||""}
sb.auth.getSession().then(async({data})=>{if(data.session)await startApp()});
