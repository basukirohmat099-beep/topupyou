// Website Top Up Manual - Node.js native HTTP server (tanpa PHP)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const sessions = new Map();

for (const dir of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, {recursive:true});
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({
  installed:false, settings:{storeName:'TopUp Manual', baseUrl:'', paymentInstructions:'Silakan transfer sesuai instruksi admin.'},
  users:[], products:[], orders:[], vouchers:[]
}, null, 2));

function readDB(){ try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); } catch { return {installed:false,settings:{},users:[],products:[],orders:[],vouchers:[]}; } }
function writeDB(db){ const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2)); fs.renameSync(tmp,DB_FILE); }
function id(prefix){ return prefix+crypto.randomBytes(5).toString('hex').toUpperCase(); }
function hashPassword(p,salt=crypto.randomBytes(16).toString('hex')) {
  const hash=crypto.scryptSync(p,salt,64).toString('hex'); return `${salt}:${hash}`;
}
function verifyPassword(p,stored){ const [salt,hash]=String(stored||'').split(':'); if(!salt||!hash)return false; const got=crypto.scryptSync(p,salt,64); return crypto.timingSafeEqual(got,Buffer.from(hash,'hex')); }
function parseCookies(req){ const out={}; for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}return out; }
function currentUser(req){ const sid=parseCookies(req).sid; const uid=sessions.get(sid); if(!uid)return null; return readDB().users.find(u=>u.id===uid)||null; }
function send(res,status,body,type='application/json; charset=utf-8',headers={}){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff',...headers});res.end(body);}
function json(res,status,obj,headers={}){send(res,status,JSON.stringify(obj), 'application/json; charset=utf-8',headers);}
function readBody(req,limit=8*1024*1024){return new Promise((resolve,reject)=>{let chunks=[],size=0;req.on('data',c=>{size+=c.length;if(size>limit){reject(new Error('Ukuran permintaan terlalu besar'));req.destroy();}else chunks.push(c);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});}
function requireUser(req,res,admin=false){const u=currentUser(req);if(!u){json(res,401,{error:'Silakan masuk terlebih dahulu.'});return null;}if(admin&&u.role!=='admin'){json(res,403,{error:'Akses admin ditolak.'});return null;}return u;}
function cleanUser(u){return {id:u.id,username:u.username,email:u.email,telegram:u.telegram||'',role:u.role,createdAt:u.createdAt};}
function money(n){return Math.max(0,Number(n)||0);}
function safeName(s){return String(s||'').replace(/[^a-zA-Z0-9._-]/g,'_');}

async function handle(req,res){
  const url=new URL(req.url,'http://localhost');
  const route=url.pathname;
  if(req.method==='GET' && route==='/api/state'){
    const db=readDB(), u=currentUser(req);
    return json(res,200,{installed:!!db.installed,settings:{storeName:db.settings.storeName||'TopUp Manual',paymentInstructions:db.settings.paymentInstructions||'',bankName:db.settings.bankName||'',bankAccount:db.settings.bankAccount||'',accountName:db.settings.accountName||'',qrisText:db.settings.qrisText||'',contactText:db.settings.contactText||''},user:u?cleanUser(u):null,products:db.products.filter(p=>p.active),categories:['Pulsa','Paket Data','Token PLN','E-Wallet','Voucher Game','PPOB']});
  }
  if(req.method==='POST' && route==='/api/setup'){
    const body=JSON.parse((await readBody(req,100000)).toString()||'{}'), db=readDB();
    if(db.installed)return json(res,400,{error:'Website sudah diinstal.'});
    if(!/^[a-z0-9_]{3,24}$/.test(String(body.username||'')))return json(res,400,{error:'Username admin tidak valid.'});
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email||'')))return json(res,400,{error:'Email tidak valid.'});
    if(String(body.password||'').length<10)return json(res,400,{error:'Password admin minimal 10 karakter.'});
    db.installed=true;db.users=[{id:id('ADM'),username:body.username.toLowerCase(),email:body.email.toLowerCase(),telegram:'',password:hashPassword(body.password),role:'admin',createdAt:new Date().toISOString()}];writeDB(db);
    return json(res,200,{ok:true,message:'Admin berhasil dibuat.'});
  }
  if(req.method==='POST' && route==='/api/register'){
    const b=JSON.parse((await readBody(req,100000)).toString()||'{}'),db=readDB();
    const username=String(b.username||'').toLowerCase(),email=String(b.email||'').toLowerCase();
    if(!/^[a-z0-9_]{3,24}$/.test(username))return json(res,400,{error:'Username 3-24 karakter, huruf kecil, angka, garis bawah.'});
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return json(res,400,{error:'Email tidak valid.'});
    if(String(b.password||'').length<8)return json(res,400,{error:'Password minimal 8 karakter.'});
    if(db.users.some(u=>u.username===username||u.email===email))return json(res,400,{error:'Username atau email sudah digunakan.'});
    db.users.push({id:id('USR'),username,email,telegram:String(b.telegram||'').replace(/^@/,''),password:hashPassword(b.password),role:'customer',createdAt:new Date().toISOString()});writeDB(db);
    return json(res,200,{ok:true,message:'Pendaftaran berhasil. Silakan masuk.'});
  }
  if(req.method==='POST' && route==='/api/login'){
    const b=JSON.parse((await readBody(req,100000)).toString()||'{}'),db=readDB();
    const u=db.users.find(x=>x.username===String(b.username||'').toLowerCase());
    if(!u||!verifyPassword(String(b.password||''),u.password))return json(res,401,{error:'Username atau password salah.'});
    const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);
    return json(res,200,{ok:true,user:cleanUser(u)},{'Set-Cookie':`sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`});
  }
  if(req.method==='POST' && route==='/api/logout'){
    const sid=parseCookies(req).sid;if(sid)sessions.delete(sid);
    return json(res,200,{ok:true},{'Set-Cookie':'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
  }
  if(req.method==='GET' && route==='/api/orders'){
    const u=requireUser(req,res);if(!u)return;const db=readDB();
    return json(res,200,{orders:db.orders.filter(o=>u.role==='admin'||o.userId===u.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
  }
  if(req.method==='POST' && route==='/api/orders'){
    const u=requireUser(req,res);if(!u)return;
    const b=JSON.parse((await readBody(req,100000)).toString()||'{}'),db=readDB();
    const p=db.products.find(x=>x.id===b.productId&&x.active);if(!p)return json(res,404,{error:'Produk tidak tersedia.'});
    const qty=Math.max(1,Math.min(20,Number.parseInt(b.qty,10)||1));if(!String(b.target||'').trim())return json(res,400,{error:'Nomor tujuan / ID pelanggan wajib diisi.'});
    let discount=0,voucherId=null;const code=String(b.voucher||'').trim().toUpperCase();
    if(code){const v=db.vouchers.find(x=>x.code===code&&x.active&&x.uses<x.limit);if(!v)return json(res,400,{error:'Voucher tidak valid atau sudah habis.'});discount=Math.min(p.price*qty,v.discount);voucherId=v.id;v.uses++;}
    const order={id:id('TRX'),userId:u.id,username:u.username,productId:p.id,productName:p.name,category:p.category,target:String(b.target).trim(),qty,unitPrice:p.price,discount,total:Math.max(0,p.price*qty-discount),voucherId,status:'Menunggu pembayaran',proof:'',adminNote:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    db.orders.push(order);writeDB(db);return json(res,200,{ok:true,order});
  }
  if(req.method==='POST' && route==='/api/upload-proof'){
    const u=requireUser(req,res);if(!u)return;
    const raw=await readBody(req,7*1024*1024), boundary=(req.headers['content-type']||'').match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean);
    if(!boundary)return json(res,400,{error:'Format unggahan tidak valid.'});
    const parts=raw.toString('binary').split('--'+boundary);
    let orderId='',fileBuffer=null,ext='';
    for(const part of parts){
      const split=part.indexOf('\r\n\r\n');if(split<0)continue;
      const head=part.slice(0,split),content=part.slice(split+4).replace(/\r\n$/,'');
      if(head.includes('name="orderId"'))orderId=content.trim();
      if(head.includes('name="proof"')){
        const m=head.match(/filename="([^"]*)"/),ct=head.match(/Content-Type:\s*([^\r\n]+)/i);
        const type=(ct?.[1]||'').trim().toLowerCase();const allowed={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
        if(!allowed[type])return json(res,400,{error:'Bukti harus JPG, PNG, atau WEBP.'});
        fileBuffer=Buffer.from(content,'binary');ext=allowed[type];
      }
    }
    if(!fileBuffer||fileBuffer.length>5*1024*1024)return json(res,400,{error:'Pilih gambar bukti maksimal 5 MB.'});
    const db=readDB(),o=db.orders.find(x=>x.id===orderId&&x.userId===u.id);
    if(!o)return json(res,404,{error:'Pesanan tidak ditemukan.'});
    if(!['Menunggu pembayaran','Bukti ditolak'].includes(o.status))return json(res,400,{error:'Bukti tidak dapat diubah pada status ini.'});
    const name=crypto.randomBytes(18).toString('hex')+'.'+ext;fs.writeFileSync(path.join(UPLOAD_DIR,name),fileBuffer);
    o.proof='/uploads/'+name;o.status='Menunggu verifikasi';o.updatedAt=new Date().toISOString();writeDB(db);
    return json(res,200,{ok:true,message:'Bukti pembayaran dikirim.'});
  }
  if(req.method==='GET' && route.startsWith('/uploads/')){
    const name=path.basename(route);const file=path.join(UPLOAD_DIR,name);if(!fs.existsSync(file))return send(res,404,'Not found','text/plain');
    const ext=path.extname(file).toLowerCase(),type={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[ext]||'application/octet-stream';
    return send(res,200,fs.readFileSync(file),type,{'Cache-Control':'private, max-age=300'});
  }
  if(route.startsWith('/api/admin/')){
    const u=requireUser(req,res,true);if(!u)return;const db=readDB();
    if(req.method==='GET'&&route==='/api/admin/data')return json(res,200,{users:db.users.filter(x=>x.role!=='admin').map(cleanUser),orders:db.orders,vouchers:db.vouchers,products:db.products,settings:db.settings});
    if(req.method==='POST'&&route==='/api/admin/product'){
      const b=JSON.parse((await readBody(req,100000)).toString()||'{}');if(!String(b.name||'').trim())return json(res,400,{error:'Nama produk wajib diisi.'});
      const p={id:b.id||id('PRD'),name:String(b.name).trim(),category:String(b.category||'Pulsa'),description:String(b.description||''),price:money(b.price),active:!!b.active};
      const i=db.products.findIndex(x=>x.id===p.id);if(i>=0)db.products[i]=p;else db.products.push(p);writeDB(db);return json(res,200,{ok:true});
    }
    if(req.method==='DELETE'&&route==='/api/admin/product'){
      const b=JSON.parse((await readBody(req,100000)).toString()||'{}');db.products=db.products.filter(p=>p.id!==b.id);writeDB(db);return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&route==='/api/admin/order-status'){
      const b=JSON.parse((await readBody(req,100000)).toString()||'{}'),allowed=['Menunggu pembayaran','Menunggu verifikasi','Diproses','Berhasil','Bukti ditolak','Dibatalkan'];
      const o=db.orders.find(x=>x.id===b.id);if(!o||!allowed.includes(b.status))return json(res,400,{error:'Pesanan atau status tidak valid.'});
      o.status=b.status;o.adminNote=String(b.note||'');o.updatedAt=new Date().toISOString();writeDB(db);return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&route==='/api/admin/voucher'){
      const b=JSON.parse((await readBody(req,100000)).toString()||'{}'),code=String(b.code||'').trim().toUpperCase();
      if(!code)return json(res,400,{error:'Kode voucher wajib diisi.'});
      db.vouchers.push({id:id('VCR'),code,discount:money(b.discount),limit:Math.max(1,Number(b.limit)||1),uses:0,active:!!b.active});writeDB(db);return json(res,200,{ok:true});
    }
    if(req.method==='POST'&&route==='/api/admin/settings'){
      const b=JSON.parse((await readBody(req,100000)).toString()||'{}');
      for(const k of ['storeName','baseUrl','paymentInstructions','bankName','bankAccount','accountName','qrisText','contactText'])db.settings[k]=String(b[k]||'');
      writeDB(db);return json(res,200,{ok:true});
    }
  }
  if(req.method==='GET'){
    let file=route==='/'?path.join(PUBLIC,'index.html'):path.join(PUBLIC,path.normalize(route).replace(/^[/\\]+/,''));
    if(!file.startsWith(PUBLIC))return send(res,403,'Forbidden','text/plain');
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(PUBLIC,'index.html');
    const ext=path.extname(file).toLowerCase(),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
    return send(res,200,fs.readFileSync(file),types[ext]||'application/octet-stream');
  }
  return json(res,404,{error:'Endpoint tidak ditemukan.'});
}

http.createServer((req,res)=>{handle(req,res).catch(err=>{console.error(err);if(!res.headersSent)json(res,500,{error:err.message||'Kesalahan server.'});});}).listen(PORT,HOST,()=>console.log(`TopUp Manual berjalan pada port ${PORT}`));
