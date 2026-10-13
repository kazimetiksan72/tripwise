import { useCallback, useEffect, useMemo, useState } from "react";

function initials(user) {
  const name = user?.name?.trim();
  if (name) return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR");
  return user?.email?.[0]?.toLocaleUpperCase("tr-TR") || "F";
}
function dateLabel(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function formatMoney(value, currency) {
  if (!value) return "—";
  const normalized = typeof value === "number" ? value : Number(String(value).replaceAll(".", "").replace(",", "."));
  const amount = normalized;
  if (!Number.isFinite(amount)) return `${value} ${currency || ""}`;
  try { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: currency || "TRY" }).format(amount); }
  catch { return `${value} ${currency || ""}`; }
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [section, setSection] = useState("home");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [files, setFiles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userPages, setUserPages] = useState(1);
  const [receipts, setReceipts] = useState([]);
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiptPages, setReceiptPages] = useState(1);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => response.json()).then((body) => setUser(body.user || null)).catch(() => setUser(null));
  }, []);

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/users?page=${page}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Kullanıcı listesi alınamadı.");
      setUsers(body.users); setUserPage(body.page); setUserPages(body.pages || 1); setUserTotal(body.total);
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }, []);

  const loadReceipts = useCallback(async (page = 1) => {
    setLoading(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/receipts?page=${page}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Fiş listesi alınamadı.");
      setReceipts(body.receipts); setReceiptPage(body.page); setReceiptPages(body.pages || 1); setReceiptTotal(body.total);
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === "admin" && section === "users") loadUsers(userPage); }, [user, section, userPage, loadUsers]);
  useEffect(() => { if (user?.role === "admin" && section === "receipts") loadReceipts(receiptPage); }, [user, section, receiptPage, loadReceipts]);

  async function signInWithPassword(email, password) {
    setLoading(true); setNotice("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "E-posta veya şifre hatalı.");
      setUser(body.user); setSection("home"); setNotice("");
    } catch (error) { setNotice(error.message || "Giriş tamamlanamadı."); }
    finally { setLoading(false); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null); setSection("home"); setAnalysis(null); setFiles([]);
  }

  function appendFiles(fileList) {
    const selected = Array.from(fileList || []).filter((file) => file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp");
    const remaining = Math.max(0, 8 - files.length);
    setFiles((current) => [...current, ...selected.slice(0, remaining)]);
    if (selected.length > remaining) setNotice("En fazla 8 sayfa eklenebilir.");
    setAnalysis(null);
  }

  async function prepareImage(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let quality = 0.68;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    while (blob && blob.size > 400_000 && quality > 0.4) {
      quality -= 0.08; blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    }
    if (!blob || blob.size > 450_000) throw new Error("Bir görüntü küçültülemedi; daha küçük bir fotoğraf seç.");
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob);
    });
    return { mimeType: "image/jpeg", base64 };
  }

  async function analyze() {
    if (!files.length) return;
    setLoading(true); setNotice(""); setAnalysis(null);
    try {
      const images = await Promise.all(files.map(prepareImage));
      const totalBytes = images.reduce((sum, image) => sum + image.base64.length, 0);
      if (totalBytes > 3_250_000) throw new Error("Toplam fotoğraf boyutu sunucu sınırını aşıyor. Daha az veya daha küçük görüntü seç.");
      const response = await fetch("/api/analyze-receipt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ images }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Belge analizi yapılamadı.");
      setAnalysis(body);
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }

  const activeLabel = useMemo(() => section === "users" ? "Kullanıcılar" : section === "receipts" ? "Fişler" : "Ana sayfa", [section]);
  if (user === undefined) return <div className="boot"><div className="brand-mark"><span>F</span></div><p>FişGaranti açılıyor…</p></div>;
  if (!user) return <Login loading={loading} notice={notice} onSignIn={signInWithPassword} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setSection("home"); }}><span className="brand-mark"><span>F</span></span><span><b>fişgaranti</b><small>ALIŞVERİŞ ARŞİVİN</small></span></a>
      <div className="nav-label">ÇALIŞMA ALANI</div>
      <button className={`nav-item ${section === "home" ? "selected" : ""}`} onClick={() => setSection("home")}><Icon name="grid" />Genel bakış</button>
      {user.role === "admin" && <><div className="nav-label admin-label">YÖNETİM</div><button className={`nav-item ${section === "receipts" ? "selected" : ""}`} onClick={() => setSection("receipts")}><Icon name="receipt" />Fişler<span className="nav-count">{receiptTotal || "—"}</span></button><button className={`nav-item ${section === "users" ? "selected" : ""}`} onClick={() => setSection("users")}><Icon name="users" />Kullanıcılar<span className="nav-count">{userTotal || "—"}</span></button></>}
      <div className="sidebar-bottom"><div className="privacy"><Icon name="shield" /><div><b>Gizliliğin önceliğimiz</b><span>Belgeleriniz izniniz olmadan analiz edilmez.</span></div></div><button className="profile" onClick={signOut}><span className="avatar">{initials(user)}</span><span className="profile-copy"><b>{user.name || "Hesabım"}</b><small>{user.email}</small></span><Icon name="logout" /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="eyebrow">FİŞGARANTİ / {activeLabel.toLocaleUpperCase("tr-TR")}</span><h1>{activeLabel}</h1></div><div className="top-actions"><span className="secure-pill"><Icon name="lock" /> Güvenli oturum</span><button className="avatar top-avatar" title="Çıkış yap" onClick={signOut}>{initials(user)}</button></div></header>
      {notice && <div className="notice" role="status"><Icon name="info" />{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {section === "users" && user.role === "admin" ? <UserManagement users={users} total={userTotal} page={userPage} pages={userPages} loading={loading} onPage={setUserPage} onReload={() => loadUsers(userPage)} /> : section === "receipts" && user.role === "admin" ? <ReceiptManagement receipts={receipts} total={receiptTotal} page={receiptPage} pages={receiptPages} loading={loading} onPage={setReceiptPage} onReload={() => loadReceipts(receiptPage)} /> : <>
        <section className="welcome-panel"><div className="welcome-copy"><div className="welcome-tag"><span className="sparkle">✳</span> ALIŞVERİŞLERİN GÜVENDE</div><h2>Fişler kaybolmasın,<br /><em>hakların</em> unutulmasın.</h2><p>Belgelerini tek yerde topla. Garanti ve alışveriş bilgilerini kolayca takip et.</p><div className="welcome-stat"><span className="stat-dot" /><span><b>Hesabın hazır</b><small>E-posta ve şifreyle yönetici girişi</small></span></div></div><div className="hero-art" aria-hidden="true"><div className="art-glow" /><div className="art-paper back-paper" /><div className="art-paper main-paper"><div className="paper-brand"><span>F</span><b>fişgaranti</b><i>✓</i></div><div className="paper-rule" /><div className="paper-line wide" /><div className="paper-line" /><div className="paper-product"><span>Ürün kaydı</span><b>₺ 2.499,90</b></div><div className="paper-pill"><span>●</span> Belge güvende</div></div><div className="art-float float-star">✳</div><div className="art-float float-check">✓</div><div className="art-caption">HER BELGE<br /><b>YENİ BİR GÜVENCE</b></div></div></section>
        <section className="section-heading"><div><span className="eyebrow">BELGE MERKEZİ</span><h2>Alışverişini arşivle</h2><p>Fiş veya faturanın fotoğrafını seçerek başla.</p></div><span className="step-indicator"><b>01</b><i>/</i> 03</span></section>
        <section className={`upload-card ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); appendFiles(event.dataTransfer.files); }}>
          <div className="upload-icon"><Icon name="receipt" /></div><div className="upload-main"><h3>Fişini veya faturanı ekle</h3><p>Görüntüleriniz yalnız siz onayladıktan sonra OpenAI ile analiz edilir.</p><label className="file-button"><Icon name="plus" /> Fotoğraf seç<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { appendFiles(event.target.files); event.target.value = ""; }} /></label><span className="file-help">PNG, JPG veya WEBP · En fazla 8 sayfa</span></div><div className="upload-side"><Icon name="scan" /><span>Belgeyi<br />otomatik oku</span></div>
          {files.length > 0 && <div className="selected-files">{files.map((file, index) => <div className="selected-file" key={`${file.name}-${index}`}><Icon name="image" /><span>{file.name}</span><button aria-label="Belgeyi kaldır" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>×</button></div>)}</div>}
          {files.length > 0 && <div className="analyze-row"><div className="consent-note"><Icon name="shield" /><span>Devam ederek fotoğrafları OpenAI’a göndermeyi onaylarsın.</span></div><button className="primary-button" onClick={analyze} disabled={loading}>{loading ? <><span className="spinner" /> Analiz ediliyor</> : <>OpenAI ile analiz et <Icon name="arrow" /></>}</button></div>}
        </section>
        {analysis && <AnalysisResult result={analysis} />}
        <section className="steps-row"><MiniStep number="01" title="Belgeyi ekle" text="Fişini veya e-faturanı yükle." /><span className="step-connector" /><MiniStep number="02" title="Bilgileri kontrol et" text="Okunan alanları doğrula." /><span className="step-connector" /><MiniStep number="03" title="Güvenceye al" text="Ürün kayıtlarını takip et." /></section>
        <footer className="page-footer"><span>© 2026 FişGaranti</span><span><Icon name="lock" /> Bilgilerin güvende</span></footer>
      </>}
    </main>
  </div>;
}

function Login({ loading, notice, onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  function submit(event) {
    event.preventDefault();
    onSignIn(email, password);
  }
  return <main className="login-shell"><div className="login-card"><a className="brand login-brand" href="#"><span className="brand-mark"><span>F</span></span><span><b>fişgaranti</b><small>YÖNETİM PANELİ</small></span></a><div className="login-visual"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><div className="login-receipt"><div className="receipt-check">✓</div><b>Fişin güvende.</b><span>Hakların aklında.</span><div className="receipt-lines"><i /><i /><i /></div></div><span className="login-star star-one">✳</span><span className="login-star star-two">✳</span></div><div className="login-content"><span className="eyebrow">YÖNETİCİ GİRİŞİ</span><h1>FişGaranti<br /><em>yönetim paneli</em></h1><p>Yönetim hesabınızın e-posta adresi ve şifresiyle giriş yapın.</p>{notice && <div className="notice login-notice"><Icon name="info" />{notice}</div>}<form className="admin-login-form" onSubmit={submit}><label>E-posta<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@ornek.com" /></label><label>Şifre<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Şifreniz" /></label><button className="apple-button" type="submit" disabled={loading}>{loading ? "Giriş yapılıyor…" : "E-posta ile giriş yap"}</button></form><div className="login-privacy"><Icon name="lock" /><span>Yönetici hesabı sunucu tarafında doğrulanır.<br />Şifreniz tarayıcıda saklanmaz.</span></div></div></div><div className="login-foot">YALNIZCA YETKİLİ YÖNETİCİ HESAPLARI</div></main>;
}
function UserManagement({ users, total, page, pages, loading, onPage, onReload }) {
  return <section className="users-page"><div className="users-intro"><div><span className="eyebrow">HESAP YÖNETİMİ</span><h2>Kullanıcılar</h2><p>Apple ile giriş yapmış hesaplar ve son aktivite bilgileri.</p></div><button className="secondary-button" onClick={onReload} disabled={loading}><Icon name="refresh" /> Yenile</button></div><div className="users-stats"><div><span>TOPLAM HESAP</span><b>{total}</b><small>kayıtlı kullanıcı</small></div><div><span>BU SAYFA</span><b>{users.length}</b><small>hesap gösteriliyor</small></div><div><span>GİRİŞ SAĞLAYICISI</span><b>Apple</b><small>doğrulanmış kimlik</small></div></div><div className="table-card"><div className="table-heading"><div><b>Kullanıcı listesi</b><span>Apple hesabı ve kayıt geçmişi</span></div><span className="table-total">{total} hesap</span></div><div className="table-scroll"><table><thead><tr><th>KULLANICI</th><th>APPLE E-POSTASI</th><th>KAYIT TARİHİ</th><th>SON GİRİŞ</th></tr></thead><tbody>{loading && users.length === 0 ? <tr><td colSpan="4" className="empty-table">Liste yükleniyor…</td></tr> : users.length === 0 ? <tr><td colSpan="4" className="empty-table">Henüz kullanıcı kaydı bulunmuyor.</td></tr> : users.map((item) => <tr key={item.appleSub}><td><div className="table-user"><span className="avatar">{initials(item)}</span><span><b>{item.name || "İsim paylaşılmadı"}</b><small>Apple hesabı</small></span></div></td><td><span className="email-cell">{item.email || "—"}</span>{item.isPrivateEmail && <span className="relay-chip">Özel e-posta</span>}</td><td>{dateLabel(item.createdAt)}</td><td><span className="last-login"><i />{dateLabel(item.lastLoginAt)}</span></td></tr>)}</tbody></table></div><div className="table-footer"><span>{total ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, total)} / ${total} hesap` : "0 hesap"}</span><div><button disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>←</button><span>{page} / {pages}</span><button disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>→</button></div></div></div><p className="admin-hint"><Icon name="shield" /> Bu görünüm yalnızca yetkili yönetici hesabına açıktır. Kullanıcı parolası veya Apple token’ı saklanmaz.</p></section>;
}

function ReceiptManagement({ receipts, total, page, pages, loading, onPage, onReload }) {
  return <section className="receipt-admin-page"><div className="receipt-admin-intro"><div><span className="eyebrow">MOBİL KULLANICI KAYITLARI</span><h2>Fişler ve faturalar</h2><p>OpenAI tarafından analiz edilip kullanıcı hesabına kaydedilen belgeler.</p></div><button className="secondary-button" onClick={onReload} disabled={loading}><Icon name="refresh" /> Yenile</button></div><div className="receipt-admin-table"><div className="receipt-admin-row receipt-admin-head"><span>SATICI / BELGE</span><span>TÜR</span><span>TARİH</span><span>TUTAR</span></div>{loading && receipts.length === 0 ? <div className="receipt-admin-empty">Fişler yükleniyor…</div> : receipts.length === 0 ? <div className="receipt-admin-empty">Henüz kaydedilmiş fiş yok.</div> : receipts.map((item) => <div className="receipt-admin-row" key={item.id}><b>{item.merchantName || item.analysis?.seller?.name || "İsimsiz işletme"}</b><span>{item.documentType === "invoice" ? "Fatura" : item.documentType === "receipt" ? "Fiş" : "Belge"}</span><span>{dateLabel(item.issuedAt || item.createdAt)}</span><b>{item.total != null ? formatMoney(item.total, item.currency) : "—"}</b></div>)}</div><div className="receipt-admin-pager"><span>{total} kayıt · {page} / {pages}</span><div><button disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>Önceki</button> <button disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>Sonraki</button></div></div></section>;
}

function AnalysisResult({ result }) {
  return <section className="analysis-result"><div className="analysis-title"><div className="upload-icon"><Icon name="spark" /></div><div><span className="eyebrow">OPENAI BELGE ANALİZİ</span><h3>Kontrol etmen için bulunan bilgiler</h3></div><span className="draft-pill">TASLAK</span></div><div className="analysis-fields"><Field label="Satıcı" value={result.seller?.legal_name || result.seller?.name} /><Field label="Platform" value={result.platform} /><Field label="Belge türü" value={result.document_type} /><Field label="Sipariş no" value={result.order_number} /><Field label="Alışveriş tarihi" value={result.purchase_date} /><Field label="Teslim tarihi" value={result.delivery_date} /></div>{result.products?.length > 0 && <div className="product-table"><div className="product-head"><span>ÜRÜN</span><span>ADET</span><span>ÖDENEN</span></div>{result.products.map((product, index) => <div className="product-line" key={`${product.name}-${index}`}><b>{product.name || "İsimsiz satır"}</b><span>{product.quantity || 1}</span><span>{formatMoney(product.paid_line_total || product.unit_price, result.currency)}</span></div>)}</div>}<p className="analysis-disclaimer">Bilgiler görüntüden otomatik çıkarılmıştır; kaydetmeden önce doğrula.</p></section>;
}
function Field({ label, value }) { return <div className="analysis-field"><span>{label}</span><b>{value || "Belgede bulunamadı"}</b></div>; }
function MiniStep({ number, title, text }) { return <div className="mini-step"><span>{number}</span><div><b>{title}</b><small>{text}</small></div></div>; }
function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    receipt: <><path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Z"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.64 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.36-3"/></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z"/></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>;
}
